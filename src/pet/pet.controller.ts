// api-gateway/src/pet/pet.controller.ts
import { Controller, Get, Post, Body, Param, UseGuards, Req } from '@nestjs/common';
import { Request } from 'express';
import { PetService } from './pet.service';
import { CreatePetDto } from './dto/create-pet.dto';
import { DIDAuthGuard } from 'src/auth/guard/did-auth-guard';
import { VcProxyService } from 'src/vc/vc.proxy.service';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ethers } from 'ethers';

@ApiTags('Pet')
@ApiBearerAuth()
@Controller('api/pet')
export class PetController {
  constructor(
    private readonly petService: PetService,
    private readonly vcProxyService: VcProxyService,
  ) {}

  /**
   * PetDID 등록 (보호자 인증 필요)
   */
  @Post('register')
  @UseGuards(DIDAuthGuard)
  @ApiOperation({ summary: 'PetDID 등록 - 보호자만 가능' })
  async registerPet(
    @Req() req: Request,
    @Body() dto: CreatePetDto
  ) {
    const guardianAddress = req.user?.address;

    // 1. 보호자 등록 여부 확인 (Guardian Registry 또는 VC Service)
    const guardianInfo = await this.vcProxyService.updateGuardianInfo({
      walletAddress: guardianAddress,
    }).catch(() => null);

    if (!guardianInfo) {
      return {
        success: false,
        error: 'Guardian registration required. Please register as a guardian first.'
      };
    }

    // 2. PetDID 생성 (did:pet:ethereum:{chainId}:{petId})
    const chainId = process.env.CHAIN_ID || '1337';
    const petId = ethers.keccak256(
      ethers.toUtf8Bytes(`${guardianAddress}-${dto.species}-${Date.now()}`)
    ).substring(0, 42); // 20 bytes address format
    const petDID = `did:pet:ethereum:${chainId}:${petId}`;

    // 3. 비문 해시 생성 (실제로는 ML 서버에서 받아야 함)
    const featureVectorHash = dto.biometricData
      ? ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(dto.biometricData)))
      : ethers.keccak256(ethers.toUtf8Bytes('dummy-biometric-data'));

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

    // 5. 트랜잭션 성공 후 VC Service에 펫 메타데이터 저장
    if (txResult.success) {
      try {
        // VC Service에 펫 정보 저장 (필요시 gRPC 메서드 추가)
        // await this.vcProxyService.storePetMetadata({...});

        return {
          success: true,
          petDID,
          txHash: txResult.txHash,
          blockNumber: txResult.blockNumber,
          biometricHash: featureVectorHash,
          message: 'Pet registered successfully'
        };
      } catch (error) {
        console.error('Failed to store pet metadata:', error);
        return {
          success: true,
          petDID,
          txHash: txResult.txHash,
          warning: 'Pet registered on blockchain but metadata storage pending'
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
