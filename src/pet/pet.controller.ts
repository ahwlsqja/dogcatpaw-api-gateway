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
   * Step 2: 펫 등록 준비 - Feature vector 추출 및 서명 데이터 준비 (블록체인 등록 전)
   *
   * 플로우:
   * 1. Nose image → Feature vector 추출 → petDID 계산
   * 2. Pet 등록 tx data + Guardian Link tx data + VC signing data 반환
   * 3. 클라이언트가 세 개 서명
   * 4. POST /pet/register로 서명 제출 → 백그라운드 처리
   */
  @Post('prepare-registration')
  @UseGuards(DIDAuthGuard)
  @UseInterceptors(FileInterceptor('noseImage'))
  @ApiOperation({ summary: '펫 등록 준비 - 서명 데이터 생성 (블록체인 등록 전)' })
  @ApiConsumes('multipart/form-data')
  async prepareRegistration(
    @Req() req: Request,
    @Body() dto: CreatePetDto,
    @UploadedFile() noseImage?: Express.Multer.File
  ) {
    const guardianAddress = req.user?.address;

    // 1. 보호자 등록 여부 확인
    const guardianInfo = await this.vcProxyService.updateGuardianInfo({
      walletAddress: guardianAddress,
    }).catch(() => null);

    if (!guardianInfo) {
      return {
        success: false,
        error: '가디언이 등록되지 않았습니다. 먼저 등록해주세요!'
      };
    }

    // 2. 비문 벡터 추출
    if (!noseImage) {
      throw new BadRequestException('비문 이미지가 필요합니다.');
    }

    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedMimeTypes.includes(noseImage.mimetype)) {
      throw new BadRequestException('Invalid file type. Only JPEG and PNG are allowed');
    }

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (noseImage.size > maxSize) {
      throw new BadRequestException('File size exceeds 10MB limit');
    }

    let featureVector: number[];
    let featureVectorHash: string;

    try {
      const imageFormat = noseImage.mimetype.split('/')[1];
      const mlResult = await this.noseEmbedderService.extractNoseVector(
        noseImage.buffer,
        imageFormat
      );

      if (!mlResult.success) {
        throw new BadRequestException(mlResult.errorMessage || 'Failed to extract nose vector');
      }

      featureVector = mlResult.vector;
      featureVectorHash = ethers.keccak256(
        ethers.toUtf8Bytes(JSON.stringify(featureVector))
      );
    } catch (error) {
      console.error('ML 서버 비문 추출 실패:', error);
      throw new BadRequestException('비문 추출에 실패했습니다. 이미지를 확인해주세요.');
    }

    // 3. PetDID 생성
    const didMethod = process.env.DIDMETHOD || 'ethr';
    const didNetwork = process.env.DIDNETWORK || 'besu';
    const petDID = `did:${didMethod}:${didNetwork}:${featureVectorHash}`;

    // 4. Pet 등록 트랜잭션 데이터 준비
    const petTxData = await this.petService.prepareRegisterPetDIDTx(
      petDID,
      featureVectorHash,
      dto.modelServerReference || 'model-server-ref',
      dto.sampleCount || 1,
      dto.species,
      '0' // metadataURI
    );

    // 5. Guardian Link 트랜잭션 데이터 준비
    const guardianLinkTxData = await this.guardianService.prepareLinkPetTx(
      guardianAddress,
      petDID
    );

    // 6. VC 서명 데이터 준비
    const petData = {
      petName: dto.petName,
      breed: dto.breed?.toString(),
      old: dto.old,
      weight: dto.weight,
      gender: dto.gender?.toString(),
      color: dto.color,
      feature: dto.feature,
      neutered: dto.neutered,
      species: dto.species,
    };

    const vcSigningData = this.vcService.prepareVCSigning({
      guardianAddress,
      petDID,
      biometricHash: featureVectorHash,
      petData,
    });

    return {
      success: true,
      petDID,
      message: 'Sign all three transactions and submit to POST /pet/register',
      petRegistrationTxData: {
        to: petTxData.to,
        data: petTxData.data,
        from: petTxData.from,
        gasLimit: petTxData.gasLimit,
        gasPrice: petTxData.gasPrice,
        value: petTxData.value,
      },
      guardianLinkTxData: {
        to: guardianLinkTxData.to,
        data: guardianLinkTxData.data,
        from: guardianLinkTxData.from,
        gasLimit: guardianLinkTxData.gasLimit,
        gasPrice: guardianLinkTxData.gasPrice,
        value: guardianLinkTxData.value,
      },
      vcSigningData: {
        message: vcSigningData.message,
        messageHash: vcSigningData.messageHash,
      },
      nextStep: 'Sign petRegistrationTx, guardianLinkTx, and vcMessageHash, then call POST /pet/register with all signatures',
    };
  }

  /**
   * Step 3: PetDID 등록 - 서명 제출 및 백그라운드 처리
   *
   * 플로우:
   * 1. Nose image 재추출 → petDID 검증
   * 2. Pet 등록 signedTx → 블록체인 즉시 전송
   * 3. Guardian Link signedTx → 큐 등록
   * 4. VC signature → 큐 등록
   */
  @Post('register')
  @UseGuards(DIDAuthGuard)
  @UseInterceptors(FileInterceptor('noseImage'))
  @ApiOperation({ summary: 'PetDID 등록 - 서명 제출 및 백그라운드 처리' })
  @ApiConsumes('multipart/form-data')
  async registerPet(
    @Req() req: Request,
    @Body() dto: CreatePetDto,
    @UploadedFile() noseImage?: Express.Multer.File
  ) {
    const guardianAddress = req.user?.address;

    // 1. 보호자 등록 여부 확인
    const guardianInfo = await this.vcProxyService.updateGuardianInfo({
      walletAddress: guardianAddress,
    }).catch(() => null);

    if (!guardianInfo) {
      return {
        success: false,
        error: '가디언이 등록되지 않았습니다. 먼저 등록해주세요!'
      };
    }

    // 2. 비문 벡터 재추출 (검증용)
    if (!noseImage) {
      throw new BadRequestException('비문 이미지가 필요합니다.');
    }

    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedMimeTypes.includes(noseImage.mimetype)) {
      throw new BadRequestException('Invalid file type. Only JPEG and PNG are allowed');
    }

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (noseImage.size > maxSize) {
      throw new BadRequestException('File size exceeds 10MB limit');
    }

    let featureVector: number[];
    let featureVectorHash: string;

    try {
      const imageFormat = noseImage.mimetype.split('/')[1];
      const mlResult = await this.noseEmbedderService.extractNoseVector(
        noseImage.buffer,
        imageFormat
      );

      if (!mlResult.success) {
        throw new BadRequestException(mlResult.errorMessage || 'Failed to extract nose vector');
      }

      featureVector = mlResult.vector;
      featureVectorHash = ethers.keccak256(
        ethers.toUtf8Bytes(JSON.stringify(featureVector))
      );
    } catch (error) {
      console.error('ML 서버 비문 추출 실패:', error);
      throw new BadRequestException('비문 추출에 실패했습니다. 이미지를 확인해주세요.');
    }

    // 3. PetDID 재계산 및 검증
    const didMethod = process.env.DIDMETHOD || 'ethr';
    const didNetwork = process.env.DIDNETWORK || 'besu';
    const petDID = `did:${didMethod}:${didNetwork}:${featureVectorHash}`;

    console.log(`✅ PetDID verified: ${petDID}`);

    // 4. Pet 등록 서명이 없으면 에러
    if (!dto.signedTx) {
      throw new BadRequestException('Pet registration signedTx is required. Call POST /pet/prepare-registration first.');
    }

    // 5. Pet 등록 (블록체인에 즉시 전송)
    const txResult = await this.petService.sendSignedTransaction(dto.signedTx);

    if (!txResult.success) {
      return {
        success: false,
        error: 'Pet registration failed',
        details: txResult
      };
    }

    console.log(`✅ Pet registered on blockchain: ${petDID} - TxHash: ${txResult.txHash}`);

    // 6. S3에 벡터 데이터 저장
    try {
      const s3Result = await this.commonService.savePetFeatureVector(featureVector, petDID);
      console.log(`✅ Feature vector saved to NCP Object Storage: ${s3Result.key}`);
    } catch (error) {
      console.error(`❌ Failed to upload feature vector to S3:`, error);
    }

    // 7. Pet 데이터 준비
    const petData = {
      petName: dto.petName,
      breed: dto.breed?.toString(),
      old: dto.old,
      weight: dto.weight,
      gender: dto.gender?.toString(),
      color: dto.color,
      feature: dto.feature,
      neutered: dto.neutered,
      species: dto.species,
    };

    // 8. Guardian Link 큐 등록
    let guardianLinkJobId = null;
    if (dto.guardianLinkSignedTx) {
      guardianLinkJobId = await this.blockchainService.queueGuardianLinkWithSignature(
        guardianAddress,
        petDID,
        dto.guardianLinkSignedTx
      );
      console.log(`✅ Queued Guardian Link - Job ID: ${guardianLinkJobId}`);
    } else {
      console.log(`⚠️ No Guardian Link signature - skipping Guardian Link`);
    }

    // 9. VC 생성 큐 등록
    let vcJobId = null;
    if (dto.vcSignature && dto.vcMessage) {
      // FormData로 전송된 vcMessage는 문자열이므로 파싱 필요
      let parsedVcMessage = dto.vcMessage;
      if (typeof dto.vcMessage === 'string') {
        try {
          parsedVcMessage = JSON.parse(dto.vcMessage);
        } catch (error) {
          console.error('❌ Failed to parse vcMessage:', error);
          throw new BadRequestException('Invalid vcMessage format');
        }
      }

      vcJobId = await this.vcQueueService.queuePetVCCreation(
        petDID,
        guardianAddress,
        featureVectorHash,
        petData,
        dto.vcSignature,
        parsedVcMessage
      );
      console.log(`✅ Queued VC creation - Job ID: ${vcJobId}`);
    } else {
      console.log(`⚠️ No VC signature - Pet registered without VC`);
    }

    // 10. Spring 서버 동기화 큐 등록
    const springJobId = await this.springService.queuePetRegistration(
      guardianAddress,
      petDID,
      petData
    );
    console.log(`✅ Queued Spring sync - Job ID: ${springJobId}`);

    return {
      success: true,
      petDID,
      txHash: txResult.txHash,
      blockNumber: txResult.blockNumber,
      message: 'Pet registered successfully! Background jobs queued.',
      jobs: {
        guardianLink: guardianLinkJobId || 'not_submitted',
        vc: vcJobId || 'not_submitted',
        spring: springJobId,
      },
    };
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
    @Body() dto: AcceptTransferDto
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

    // 4. Sync GuardianRegistry - Queue for async processing (서버가 adminSigner로 자동 처리)
    const previousGuardian = dto.message.previousGuardian;
    const transferSyncJobId = await this.blockchainService.queueTransferSync(
      petDID,
      previousGuardian,
      newGuardian
      // GuardianRegistry는 서버가 adminSigner로 자동 처리 (보조 매핑이므로 보안상 문제 없음)
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
   * 펫 소유권 이전 히스토리 조회 (uses blockchain-indexer service)
   */
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
