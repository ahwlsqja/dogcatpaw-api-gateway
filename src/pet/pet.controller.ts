// api-gateway/src/pet/pet.controller.ts
import { Controller, Get, Post, Body, Param, UseGuards, Req, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';
import { PetService } from './pet.service';
import { CreatePetDto } from './dto/create-pet.dto';
import { DIDAuthGuard } from 'src/auth/guard/did-auth-guard';
import { VcProxyService } from 'src/vc/vc.proxy.service';
import { VcService } from 'src/vc/vc.service';
import { NoseEmbedderProxyService } from 'src/nose-embedding/nose-embedding.proxy.service';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { ethers } from 'ethers';

@ApiTags('Pet')
@ApiBearerAuth()
@Controller('api/pet')
export class PetController {
  constructor(
    private readonly petService: PetService,
    private readonly vcProxyService: VcProxyService,
    private readonly vcService: VcService,
    private readonly noseEmbedderService: NoseEmbedderProxyService,
  ) {}

  /**
   * PetDID 등록 (보호자 인증 필요)
   */
  @Post('register')
  @UseGuards(DIDAuthGuard)
  @UseInterceptors(FileInterceptor('noseImage'))
  @ApiOperation({ summary: 'PetDID 등록 - 보호자만 가능 (비문 이미지 필수)' })
  @ApiConsumes('multipart/form-data')
  async registerPet(
    @Req() req: Request,
    @Body() dto: CreatePetDto,
    @UploadedFile() noseImage?: Express.Multer.File
  ) {
    const guardianAddress = req.user?.address;

    // 1. 보호자 등록 여부 확인 (Guardian Registry 또는 VC Service)
    const guardianInfo = await this.vcProxyService.updateGuardianInfo({
      walletAddress: guardianAddress,
    }).catch(() => null);

    if (!guardianInfo) {
      return {
        success: false,
        error: '가디언이 등록되지 않았습니다. 먼저 등록해주세요!'
      };
    }

    // 2. 비문 벡터 추출 (ML 서버 통해)
    let featureVector: number[];
    let featureVectorHash: string;

    if (noseImage) {
      // 이미지 파일 유효성 검증
      const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png'];
      if (!allowedMimeTypes.includes(noseImage.mimetype)) {
        throw new BadRequestException('Invalid file type. Only JPEG and PNG are allowed');
      }

      const maxSize = 10 * 1024 * 1024; // 10MB
      if (noseImage.size > maxSize) {
        throw new BadRequestException('File size exceeds 10MB limit');
      }

      try {
        // ML 서버에 비문 벡터 추출 요청
        const imageFormat = noseImage.mimetype.split('/')[1];
        const mlResult = await this.noseEmbedderService.extractNoseVector(
          noseImage.buffer,
          imageFormat
        );

        if (!mlResult.success) {
          throw new BadRequestException(mlResult.errorMessage || 'Failed to extract nose vector');
        }

        featureVector = mlResult.vector;
        // 벡터를 해시로 변환
        featureVectorHash = ethers.keccak256(
          ethers.toUtf8Bytes(JSON.stringify(featureVector))
        );
      } catch (error) {
        console.error('ML 서버 비문 추출 실패:', error);
        throw new BadRequestException('비문 추출에 실패했습니다. 이미지를 확인해주세요.');
      }
    } else if (dto.biometricData) {
      // Fallback: DTO에 직접 벡터가 제공된 경우
      featureVector = dto.biometricData;
      featureVectorHash = ethers.keccak256(
        ethers.toUtf8Bytes(JSON.stringify(dto.biometricData))
      );
    } else {
      throw new BadRequestException('비문 이미지 또는 biometricData가 필요합니다.');
    }

    // 3. PetDID 생성 (did:pet:ethereum:{chainId}:{petId})
    const didMethod = process.env.DIDMETHOD || 'ethr';
    const didNetwork = process.env.DIDNETWORK || 'besu';
    const petDID = `did:${didMethod}:${didNetwork}:${featureVectorHash}`;

    // 4. 블록체인에 PetDID 등록
    const txResult = await this.petService.registerPetDID(
      petDID,
      featureVectorHash,
      dto.modelServerReference || 'model-server-ref',
      dto.sampleCount || 1,
      dto.species,
      '0', // metadataURI는 VC Service ID 사용
      dto.signedTx
    );

    // 5. 트랜잭션 성공 후 VC 생성 준비
    if (txResult.success) {
      try {
        // Pet 데이터 준비
        const petData = {
          name: dto.name,
          species: dto.species,
          age: dto.age,
          gender: dto.gender,
          breed: dto.breed,
          color: dto.color,
          weight: dto.weight,
          microchipId: dto.microchipId,
          registrationNumber: dto.registrationNumber,
          metadata: dto.metadata,
        };

        // VC 서명 준비 데이터 생성
        const vcSigningData = this.vcService.prepareVCSigning({
          guardianAddress,
          petDID,
          biometricHash: featureVectorHash,
          petData,
        });

        return {
          success: true,
          petDID,
          txHash: txResult.txHash,
          blockNumber: txResult.blockNumber,
          biometricHash: featureVectorHash,
          vectorSize: featureVector.length,
          message: 'Pet registered successfully',
          vcSigning: {
            ...vcSigningData,
            nextStep: 'Sign the message and call POST /vc/create-vc-with-signature to create Pet VC',
          },
        };
      } catch (error) {
        console.error('Failed to prepare VC signing:', error);
        return {
          success: true,
          petDID,
          txHash: txResult.txHash,
          blockNumber: txResult.blockNumber,
          biometricHash: featureVectorHash,
          vectorSize: featureVector.length,
          warning: 'Pet registered on blockchain but VC preparation failed',
        };
      }
    }

    return txResult;
  }

  /**
   * 펫 정보 조회
   */
  @Get(':petDID')
  @ApiOperation({ summary: '펫 정보 조회 (DID Document + Biometric Data)' })
  async getPetInfo(@Param('petDID') petDID: string) {
    const [didDoc, biometricData] = await Promise.all([
      this.petService.getDIDDocument(petDID),
      this.petService.getBiometricData(petDID),
    ]);

    if (!didDoc.exists) {
      return {
        success: false,
        error: 'Pet DID not found'
      };
    }

    return {
      success: true,
      petDID,
      ...didDoc,
      biometric: biometricData,
    };
  }

  /**
   * 보호자별 펫 목록 조회
   */
  @Get('by-controller/:address')
  @ApiOperation({ summary: '보호자별 펫 목록 조회' })
  async getPetsByController(@Param('address') address: string) {
    const pets = await this.petService.getPetsByController(address);

    return {
      success: true,
      controller: address,
      pets,
      totalPets: pets.length
    };
  }

  /**
   * 내 펫 목록 조회
   */
  @Get('my/pets')
  @UseGuards(DIDAuthGuard)
  @ApiOperation({ summary: '내 펫 목록 조회' })
  async getMyPets(@Req() req: Request) {
    const guardianAddress = req.user?.address;
    const pets = await this.petService.getPetsByController(guardianAddress);

    return {
      success: true,
      guardian: guardianAddress,
      pets,
      totalPets: pets.length
    };
  }

  /**
   * Controller 변경 (펫 소유권 이전)
   */
  @Post('transfer/:petDID')
  @UseGuards(DIDAuthGuard)
  @ApiOperation({ summary: 'Controller 변경 (펫 소유권 이전)' })
  async transferPet(
    @Param('petDID') petDID: string,
    @Req() req: Request,
    @Body() dto: { newController: string; signedTx?: string }
  ) {
    const currentController = req.user?.address;

    // 현재 Controller 확인
    const didDoc = await this.petService.getDIDDocument(petDID);
    if (didDoc.controller.toLowerCase() !== currentController.toLowerCase()) {
      return {
        success: false,
        error: 'Only current controller can transfer pet ownership'
      };
    }

    const txResult = await this.petService.changeController(
      petDID,
      dto.newController,
      dto.signedTx
    );

    return {
      success: true,
      ...txResult,
      message: 'Pet ownership transferred'
    };
  }

  /**
   * 비문 검증
   */
  @Post('verify-biometric/:petDID')
  @ApiOperation({ summary: '비문 검증' })
  async verifyBiometric(
    @Param('petDID') petDID: string,
    @Body() dto: {
      similarity: number;
      purpose: number;
      modelServerSignature: string;
    }
  ) {
    const isValid = await this.petService.verifyBiometric(
      petDID,
      dto.similarity,
      dto.purpose,
      dto.modelServerSignature
    );

    return {
      success: true,
      isValid,
      petDID,
      similarity: dto.similarity,
      purpose: dto.purpose
    };
  }

  /**
   * 전체 펫 수 조회
   */
  @Get('stats/total')
  @ApiOperation({ summary: '전체 등록된 펫 수 조회' })
  async getTotalPets() {
    const total = await this.petService.getTotalPets();

    return {
      success: true,
      totalPets: total
    };
  }

  /**
   * 펫 등록 여부 확인
   */
  @Get('check/:petDID')
  @ApiOperation({ summary: '펫 등록 여부 확인' })
  async checkPetRegistration(@Param('petDID') petDID: string) {
    const isRegistered = await this.petService.isPetRegistered(petDID);

    return {
      success: true,
      petDID,
      isRegistered
    };
  }
}
