// api-gateway/src/pet/pet.controller.ts
import { Controller, Get, Post, Body, Param, UseGuards, Req, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';
import { PetService } from './pet.service';
import { CreatePetDto } from './dto/create-pet.dto';
import { PrepareTransferDto, AcceptTransferDto, VerifyTransferResponseDto } from './dto/transfer-pet.dto';
import { DIDAuthGuard, IS_PUBLIC_KEY } from 'src/auth/guard/did-auth-guard';
import { VcProxyService } from 'src/vc/vc.proxy.service';
import { VcService } from 'src/vc/vc.service';
import { VcQueueService } from 'src/vc/vc-queue.service';
import { NoseEmbedderProxyService } from 'src/nose-embedding/nose-embedding.proxy.service';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes, ApiResponse } from '@nestjs/swagger';
import { ethers } from 'ethers';
import { PetDataDto } from 'src/vc/dto/pet-data.dto';
import { TranferImageUrlDto } from './dto/transfer-noseprint-validate.dto';
import { CommonService } from 'src/common/common.service';
import { GuardianService } from 'src/guardian/guardian.service';
import { BlockchainService } from 'src/blockchain/blockchain.service';
import { ConfigService } from '@nestjs/config';
import { SpringService } from 'src/spring/spring.service';
import { Public } from '../auth/decorator/public.decorator';
import { IndexerProxyService } from 'src/indexer/indexer.proxy.service';

@ApiTags('Pet')
@ApiBearerAuth()
@Controller('pet')
export class PetController {
  constructor(
    private readonly petService: PetService,
    private readonly vcProxyService: VcProxyService,
    private readonly vcService: VcService,
    private readonly vcQueueService: VcQueueService,
    private readonly noseEmbedderService: NoseEmbedderProxyService,
    private readonly commonService: CommonService,
    private readonly guardianService: GuardianService,
    private readonly blockchainService: BlockchainService,
    private readonly configService: ConfigService,
    private readonly springService: SpringService,
    private readonly indexerProxyService: IndexerProxyService,
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
        // 벡터를 해시로 변환 (ONE-WAY: Cannot decode hash back to vector!)
        // Hash is for blockchain integrity, actual vector must be stored elsewhere (VC)
        featureVectorHash = ethers.keccak256(
          ethers.toUtf8Bytes(JSON.stringify(featureVector))
        );
      } catch (error) {
        console.error('ML 서버 비문 추출 실패:', error);
        throw new BadRequestException('비문 추출에 실패했습니다. 이미지를 확인해주세요.');
      }
    } else {
      throw new BadRequestException('비문 이미지가 필요합니다.');
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

    // 5. 트랜잭션 성공 - Pet 등록 완료
    if (txResult.success) {
      // s3에 벡터 데이터 저장
      let s3VectorUrl = null;
      let s3VectorKey = null;

      try{
        const s3Result = await this.commonService.savePetFeatureVector(featureVector,petDID)
        s3VectorUrl = s3Result.url;
        s3VectorKey = s3Result.key
        console.log(`feature vector saved to NCP Object Storage for ${petDID}: ${s3VectorKey}`)
      } catch (error) {
        console.log(`업로드에 실패했습니다!`)
      }

      // 5b. 펫을 가디언에 매핑 - Queue for async processing
      const linkJobId = await this.blockchainService.queueGuardianLink(
        guardianAddress,
        petDID,
        'link'
      );
      console.log(`📝 Queued guardian link - Job ID: ${linkJobId}`);

      // 5c. Queue pet registration to Spring server (async)
      const petData = {
        petName: dto.petName,
        breed: dto.breed?.toString(), // Convert Enum to string
        old: dto.old,
        weight: dto.weight,
        gender: dto.gender?.toString(), // Convert Enum to string
        color: dto.color,
        feature: dto.feature,
        neutered: dto.neutered,
        species: dto.species,
      };

      const springJobId = await this.springService.queuePetRegistration(
        guardianAddress,
        petDID,
        petData
      );
      console.log(`Queued Spring pet registration - Job ID: ${springJobId}`);

      return {
        success: true,
        petDID,
        message: 'Pet registered successfully. IMPORTANT: Save featureVector and pass it to POST /vc/prepare-vc-signing',
        springJobId,
      };
    }

    return txResult;
  }

  /**
   * 소유권 이전 Step 1: 서명 준비 (현재 보호자가 호출)
   */
  @Post('prepare-transfer/:petDID')
  @UseGuards(DIDAuthGuard)
  @ApiOperation({ summary: '펫 소유권 이전을 위한 서명 데이터 준비' })
  async prepareTransfer(
    @Param('petDID') petDID: string,
    @Req() req: Request,
    @Body() dto: { newGuardianAddress: string; petData: PetDataDto }
  ) {
    const currentGuardian = req.user?.address;

    // 1. Pet DID 존재 여부 확인
    const didDoc = await this.petService.getDIDDocument(petDID);
    if (!didDoc.exists) {
      return {
        success: false,
        error: '펫 DID가 존재하지 않습니다!',
      };
    }

    // 2. 현재 Controller 확인
    if (didDoc.controller.toLowerCase() !== currentGuardian.toLowerCase()) {
      return {
        success: false,
        error: 'Only current controller can initiate transfer',
      };
    }

    // 3. 비문 데이터 가져오기
    const biometricData = await this.petService.getBiometricData(petDID);

    // 5. 이전용 서명 데이터 생성 (새 보호자가 서명해야 함)
    const transferSigningData = this.vcService.prepareTransferVCSigning({
      previousGuardian: currentGuardian,
      newGuardian: dto.newGuardianAddress,
      petDID,
      biometricHash: biometricData.featureVectorHash || '0x0',
      petData: dto.petData,
    });

    return {
      success: true,
      ...transferSigningData,
      nextStep: 'New guardian must sign and call POST /pet/accept-transfer/:petDID',
    };
  }

  /**
   * 소유권 이전 Step 2: 비문 검증 (새 보호자가 비문 사진 업로드)
   */
  @Post('verify-transfer/:petDID')
  @UseGuards(DIDAuthGuard)
  @ApiOperation({ summary: '소유권 이전 시 새 보호자 비문 검증' })
  async verifyTransfer(
    @Param('petDID') petDID: string,
    @Req() req: Request,
    @Body() imageDto: TranferImageUrlDto
  ): Promise<VerifyTransferResponseDto> {
    // 주소
    const newGuardian = req.user?.address;

    // 1. 이미지 이동
    this.commonService.saveNosePrintToPermanentStorage(imageDto.image, petDID)

    // 2. Pet의 기존 controller 가져오기
    const didDoc = await this.petService.getDIDDocument(petDID);
    if (!didDoc.exists) {
      return {
        success: false,
        similarity: 0,
        message: 'Pet DID not found',
        error: 'Pet DID not found',
      };
    }

    const imageKey = `nose-print-photo/${petDID}/${imageDto.image}`

    try {
      const mlResult = await this.noseEmbedderService.compareWithStoredImage(
        imageKey,
        petDID,
      );

      if (!mlResult.success) {
        throw new BadRequestException(mlResult.errorMessage || '추출 및 비교 실패');
      }

      // 6. 유사도 검증 (80% 이상)
      const threshold = 80;
      const similarityPercent = Math.round(mlResult.similarity * 100);

      if (similarityPercent < threshold) {
        return {
          success: false,
          similarity: similarityPercent,
          message: '비문이 일치하지 않습니다. 소유권 이전을 진행할 수 없습니다.',
          error: '비문이 일치하지 않습니다. 소유권 이전을 진행할 수 없습니다.',
          threshold: threshold,
        };
      }

      // 7. 블록체인에 검증 기록 - Queue for async processing (like email)
      const blockchainJobId = await this.blockchainService.queueBiometricVerification(
        petDID,
        similarityPercent,
        2, // purpose: 2 = ownership_transfer
        newGuardian
      );
      console.log(`📝 Queued biometric verification for blockchain recording - Job ID: ${blockchainJobId}`);

      // 8. 검증 성공 - 증명 토큰 생성 (로컬에서 검증함)
      // TODO 나중에 컨트렉트 V3 업그레이드시 온체인로직으로 업그레이드 하는걸로
      const verificationProof = {
        petDID,
        newGuardian,
        similarity: similarityPercent,
        verifiedAt: new Date().toISOString(),
        nonce: Math.random().toString(36).substring(2),
      };

      const proofHash = ethers.keccak256(
        ethers.toUtf8Bytes(JSON.stringify(verificationProof))
      );

      return {
        success: true,
        similarity: similarityPercent,
        message: '비문 검증 성공! 이제 소유권 이전을 완료할 수 있습니다.',
        verificationProof,
        proofHash,
        nextStep: 'Call POST /pet/accept-transfer/:petDID with signature and this proof',
      };
    } catch (error) {
      console.error('ML 서버 비문 검증 실패:', error);
      throw new BadRequestException('비문 검증에 실패했습니다.');
    }
  }

  /**
   * 소유권 이전 Step 3: 새 보호자 수락 (서명 + 비문 검증 증명과 함께)
   */
  @Post('accept-transfer/:petDID')
  @UseGuards(DIDAuthGuard)
  @ApiOperation({ summary: '펫 소유권 이전 수락 (새 보호자)' })
  async acceptTransfer(
    @Param('petDID') petDID: string,
    @Req() req: Request,
    @Body() dto: {
      signature: string;
      message: any;
      petData: PetDataDto;
      verificationProof: any; // 비문 검증 증명
      signedTx?: string;
    }
  ) {
    const newGuardian = req.user?.address;

    // 1. 메시지의 새 보호자가 현재 사용자인지 확인
    if (dto.message.guardian?.toLowerCase() !== newGuardian.toLowerCase()) {
      return {
        success: false,
        error: 'Not the designated new guardian',
      };
    }

    // 2. 비문 검증 증명 확인
    if (!dto.verificationProof || dto.verificationProof.newGuardian !== newGuardian) {
      return {
        success: false,
        error: 'Valid biometric verification proof required',
      };
    }

    // 검증 시간 체크 (10분 이내)
    const verifiedAt = new Date(dto.verificationProof.verifiedAt);
    const now = new Date();
    const diffMinutes = (now.getTime() - verifiedAt.getTime()) / 1000 / 60;
    if (diffMinutes > 10) {
      return {
        success: false,
        error: 'Verification proof expired. Please verify biometric again.',
      };
    }

    // 3. 온체인 Controller 변경 (Critical - must succeed)
    const txResult = await this.petService.changeController(
      petDID,
      newGuardian,
      dto.signedTx
    );

    if (!txResult.success) {
      return txResult;
    }

    // 4. Sync GuardianRegistry - Queue for async processing
    const previousGuardian = dto.message.previousGuardian;
    const transferSyncJobId = await this.blockchainService.queueTransferSync(
      petDID,
      previousGuardian,
      newGuardian
    );
    console.log(`Queued guardian transfer sync - Job ID: ${transferSyncJobId}`);

    // 5. Queue VC transfer processing (invalidate old VC + create new VC)
    // 블록체인 성공 후 즉시 응답, VC는 백그라운드에서 BullMQ로 처리
    const vcTransferJobId = await this.vcQueueService.queueVCTransfer(
      petDID,
      newGuardian,
      previousGuardian,
      dto.signature,
      dto.message,
      dto.petData
    );
    console.log(`📝 Queued VC transfer job - Job ID: ${vcTransferJobId}`);

    return {
      success: true,
      txHash: txResult.txHash,
      blockNumber: txResult.blockNumber,
      similarity: dto.verificationProof.similarity,
      vcTransferJobId,
      message: 'Pet ownership transferred successfully on blockchain. VC processing queued.',
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
   * 펫 소유권 이전 히스토리 조회 (uses blockchain-indexer service)
   */
  @Public()
  @Get('history/:petDID')
  @ApiOperation({ summary: '펫 소유권 이전 히스토리 (입양 기록) 조회' })
  async getPetControllerHistory(@Param('petDID') petDID: string) {
    try {
      // grpc를 통한 블록체인 히스토리 쿼리
      const indexerResponse = await this.indexerProxyService.getPetTransferHistory({
        petDID,
        limit: 100,
        offset: 0,
      });

      if (!indexerResponse.success) {
        // Fallback to blockchain if indexer fails
        console.warn(`Indexer service failed for ${petDID}, falling back to blockchain`);
        try {
          const history = await this.petService.getPetControllerHistory(petDID);
          return {
            success: true,
            ...history,
            source: 'blockchain-fallback',
          };
        } catch (blockchainError) {
          // If blockchain also fails due to RPC range limit
          if (blockchainError.message && blockchainError.message.includes('RPC range limit')) {
            const didDoc = await this.petService.getDIDDocument(petDID);
            return {
              success: true,
              petDID,
              currentController: didDoc.controller,
              totalTransfers: null,
              history: [],
              warning: 'Full history unavailable - indexer offline and RPC range limit exceeded',
              message: 'Only current controller is available.',
              createdDate: didDoc.created ? new Date(didDoc.created * 1000).toISOString() : null,
              source: 'blockchain-fallback-limited',
            };
          }
          throw blockchainError;
        }
      }

      // Return indexed data
      return {
        success: true,
        petDID: indexerResponse.petDID,
        totalTransfers: indexerResponse.totalTransfers,
        currentController: indexerResponse.history.length > 0
          ? indexerResponse.history[indexerResponse.history.length - 1].newController
          : null,
        history: indexerResponse.history.map(event => ({
          previousController: event.previousController,
          newController: event.newController,
          blockNumber: event.blockNumber,
          transactionHash: event.transactionHash,
          timestamp: event.timestamp,
          timestampISO: event.timestampISO,
          transferIndex: event.transferIndex,
        })),
        source: 'blockchain-indexer',
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to fetch pet history',
        message: error.message,
      };
    }
  }
}
