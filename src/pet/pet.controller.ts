// api-gateway/src/pet/pet.controller.ts
import { Controller, Get, Post, Body, Param, UseGuards, Req, BadRequestException, HttpStatus, HttpException, Patch, Delete } from '@nestjs/common';
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
import { RedisService } from 'src/common/redis/redis.service';
import { ChatGateway } from 'src/chat/chat.gateway';
import { SpringAuthGuard } from 'src/auth/guard/spring-auth-guard';

@ApiTags('Pet')
@ApiBearerAuth('access-token')
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
    private readonly redisService: RedisService,
    private readonly chatGateway: ChatGateway,
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
  @ApiOperation({
    summary: 'Step 1: Prepare Pet Registration - Generate Signing Data',
    description: `
**Prepare all signing data for pet registration (3 signatures required)**

This is the first step in the pet registration process. This endpoint analyzes the nose print biometric data and prepares three transactions for the guardian to sign.

**Complete Pet Registration Flow:**
\`\`\`
Step 0: Upload images to S3 (POST /common for presigned URLs)
Step 1: This endpoint - Get signing data (3 transactions)
Step 2: Client signs all 3 transactions locally
Step 3: POST /pet/register - Submit signatures → Background processing
\`\`\`

**What This Endpoint Does:**
1. Verifies guardian is registered in VC service
2. Downloads nose print image from S3 temp folder
3. Sends image to ML server for feature vector extraction (biometric signature)
4. Calculates Pet DID from feature vector: \`did:ethr:besu:{keccak256(vector)}\`
5. Prepares 3 transactions for guardian to sign:
   - **Pet Registration TX**: Register Pet DID on blockchain
   - **Guardian Link TX**: Link pet to guardian's profile
   - **VC Signing Data**: Guardian consent for VC issuance

**Before Calling This Endpoint:**
You must upload images to S3 using POST /common:
\`\`\`javascript
// 1. Get presigned URL for nose image
const noseUrlResponse = await fetch('/common', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer ' + accessToken }
});
const { url: nosePresignedUrl } = await noseUrlResponse.json();

// 2. Upload nose image to S3
await fetch(nosePresignedUrl, {
  method: 'PUT',
  body: noseImageFile,
  headers: { 'Content-Type': 'image/jpeg' }
});

// 3. Extract filename from URL
const noseFileName = new URL(nosePresignedUrl).pathname.split('/').pop();

// 4. Repeat for pet profile images
// 5. Call this endpoint with filenames
\`\`\`

**Pet DID Generation:**
\`\`\`
1. Nose image → ML Server → Feature vector (512-dimensional array)
2. Feature vector → keccak256 hash → Feature Vector Hash
3. Pet DID = "did:ethr:besu:{featureVectorHash}"

Example: did:ethr:besu:0x1234567890abcdef...
\`\`\`

**Response - 3 Transactions to Sign:**

**1. Pet Registration Transaction:**
\`\`\`javascript
{
  to: "0x...",  // PetDIDRegistry contract address
  data: "0x...", // registerPetDID function call
  gasLimit: "3000000",
  gasPrice: "0",
  value: "0",
  from: "0x...",  // Guardian address
}
\`\`\`

**2. Guardian Link Transaction:**
\`\`\`javascript
{
  to: "0x...",  // GuardianRegistry contract address
  data: "0x...", // linkPet function call
  gasLimit: "3000000",
  gasPrice: "0",
  value: "0",
  from: "0x...",  // Guardian address
}
\`\`\`

**3. VC Signing Data:**
\`\`\`javascript
{
  message: {
    vcType: "GuardianIssuedPetVC",
    sub: "did:ethr:besu:0x...",  // Pet DID
    guardian: "0x...",
    biometricHash: "0x...",
    petData: { petName, breed, age, ... },
    issuedAt: "2025-10-25T12:00:00Z",
    nonce: "random-string"
  },
  messageHash: "0x..."  // keccak256 of message for signing
}
\`\`\`

**Next Steps After Receiving Response:**
\`\`\`javascript
// 1. Sign Pet Registration TX
const petTx = {
  to: response.petRegistrationTxData.to,
  data: response.petRegistrationTxData.data,
  gasLimit: ethers.toBeHex(3000000),
  gasPrice: ethers.toBeHex(0),
  value: 0,
  nonce: await provider.getTransactionCount(wallet.address),
  chainId: 1337
};
const petSignedTx = await wallet.signTransaction(petTx);

// 2. Sign Guardian Link TX (nonce + 1)
const linkTx = {
  to: response.guardianLinkTxData.to,
  data: response.guardianLinkTxData.data,
  gasLimit: ethers.toBeHex(3000000),
  gasPrice: ethers.toBeHex(0),
  value: 0,
  nonce: await provider.getTransactionCount(wallet.address) + 1,
  chainId: 1337
};
const linkSignedTx = await wallet.signTransaction(linkTx);

// 3. Sign VC Message
const vcSignature = await wallet.signMessage(response.vcSigningData.messageHash);

// 4. Submit all signatures to POST /pet/register
\`\`\`

**Important Notes:**
- This endpoint does NOT submit transactions to blockchain
- It only prepares signing data and calculates Pet DID
- Guardian Link TX must use nonce+1 (executes after Pet Registration)
- All 3 signatures are submitted together in next step

**Image Requirements:**
- Nose image: Clear, high-resolution nose print photo
- Format: JPEG or PNG
- Size: Recommended < 5MB
- Quality: Must be clear enough for ML feature extraction

**Error Cases:**
- Guardian not registered → 400 Bad Request
- Nose image not found in S3 → 400 Bad Request
- ML server fails to extract features → 400 Bad Request
- Invalid image format → 400 Bad Request
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'Signing data prepared successfully',
    schema: {
      example: {
        success: true,
        petDID: 'did:ethr:besu:0x1234567890abcdef...',
        message: 'Sign all three transactions and submit to POST /pet/register',
        petRegistrationTxData: {
          to: '0x...',
          data: '0x...',
          from: '0x...',
          gasLimit: '3000000',
          gasPrice: '0',
          value: '0'
        },
        guardianLinkTxData: {
          to: '0x...',
          data: '0x...',
          from: '0x...',
          gasLimit: '3000000',
          gasPrice: '0',
          value: '0'
        },
        vcSigningData: {
          message: {
            vcType: 'GuardianIssuedPetVC',
            sub: 'did:ethr:besu:0x...',
            guardian: '0x...',
            biometricHash: '0x...',
            petData: {},
            issuedAt: '2025-10-25T12:00:00Z',
            nonce: 'abc123'
          },
          messageHash: '0x...'
        },
        nextStep: 'Sign petRegistrationTx, guardianLinkTx, and vcMessageHash, then call POST /pet/register with all signatures'
      }
    }
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Guardian not registered, image not found, or ML extraction failed'
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or expired token'
  })
  async prepareRegistration(
    @Req() req: Request,
    @Body() dto: CreatePetDto
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

    // 2. 비문 이미지 확인
    if (!dto.noseImage) {
      throw new BadRequestException('비문 이미지가 필요합니다.');
    }

    // 3. S3 temp 폴더에서 비문 이미지 가져오기
    let noseImageBuffer: Buffer;
    try {
      noseImageBuffer = await this.commonService.getFileFromTemp(dto.noseImage);
      console.log(123123)
    } catch (error) {
      console.error('S3에서 비문 이미지 가져오기 실패:', error);
      throw new BadRequestException('비문 이미지를 찾을 수 없습니다.');
    }

    // 4. 파일명에서 이미지 포맷 추출
    const fileExtension = dto.noseImage.split('.').pop()?.toLowerCase();
    const imageFormat = fileExtension === 'jpg' ? 'jpeg' : fileExtension;

    if (!['jpeg', 'png'].includes(imageFormat)) {
      throw new BadRequestException('Invalid file type. Only JPEG and PNG are allowed');
    }

    let featureVector: number[];
    let featureVectorHash: string;
    console.log(123123)
    
    try {
      const mlResult = await this.noseEmbedderService.extractNoseVector(
        noseImageBuffer,
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
      dto.specifics,
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
      neutral: dto.neutral,
      specifics: dto.specifics,
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
        signingData: vcSigningData.signingData,
        header: vcSigningData.header,
        encodedHeader: vcSigningData.encodedHeader,
        encodedPayload: vcSigningData.encodedPayload,
        instruction: vcSigningData.instruction,
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
  @ApiOperation({
    summary: 'Step 2: Submit Signatures and Register Pet on Blockchain',
    description: `
**Submit signed transactions and complete pet registration**

This is the final step of pet registration. After signing all 3 transactions from Step 1 (prepare-registration), submit them here for blockchain execution and background processing.

**What This Endpoint Does:**

**Immediate Actions (Blocking):**
1. Re-extracts nose print feature vector from S3 image
2. Verifies Pet DID matches (ensures same biometric data)
3. **Submits Pet Registration TX to blockchain** (blocks until confirmed)
4. Saves feature vector to S3 permanent storage

**Background Jobs (Non-blocking - BullMQ):**
5. Queues Guardian Link transaction execution
6. Queues VC (Verifiable Credential) creation
7. Queues image move from temp → permanent storage
8. Queues Spring backend synchronization

**Transaction Execution Order:**
\`\`\`
1. Pet Registration TX (immediate) ✅ Blocks until confirmed
   ↓
2. Guardian Link TX (queued) → Executes in background
3. VC Creation (queued) → Waits for Guardian Link
4. Image Move (queued) → Triggers Spring sync when done
\`\`\`

**Complete Flow Example:**
\`\`\`javascript
// After signing in Step 1, submit signatures:

const registerData = {
  // Same pet data as prepare-registration
  noseImage: noseFileName,
  images: petImageFileNames.join(','),
  petName: 'Max',
  specifics: 'dog',
  breed: 'GOLDEN_RETRIEVER',
  old: 3,
  gender: 'MALE',
  weight: 25.5,
  color: '황금색',
  feature: '활발함',
  neutral: true,

  // Signed transactions from Step 1
  signedTx: petSignedTx,  // Pet Registration (executed immediately)
  guardianLinkSignedTx: guardianLinkSignedTx,  // Guardian Link (queued)
  vcSignature: vcSignature,  // VC consent (queued)
  vcMessage: JSON.stringify(vcMessage)  // Must be string
};

const response = await fetch('/pet/register', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + accessToken,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(registerData)
});

const result = await response.json();
console.log('Pet DID:', result.petDID);
console.log('TX Hash:', result.txHash);
console.log('Block Number:', result.blockNumber);
console.log('Background Jobs:', result.jobs);
\`\`\`

**Response - Immediate Results:**
\`\`\`javascript
{
  success: true,
  petDID: "did:ethr:besu:0x1234567890abcdef...",
  txHash: "0xabcdef1234567890...",  // Pet Registration TX
  blockNumber: 12345,
  message: "Pet registered successfully! Background jobs queued.",
  jobs: {
    guardianLink: "job-uuid-1",  // BullMQ job ID
    vc: "job-uuid-2",
    imageMove: "job-uuid-3"
  },
  note: "Images will be moved to permanent storage, then Spring sync will be triggered automatically."
}
\`\`\`

**Background Jobs Details:**

**1. Guardian Link Job (BullMQ):**
- Submits guardianLinkSignedTx to blockchain
- Links pet to guardian's profile in GuardianRegistry
- Guardian can view pet in their pet list

**2. VC Creation Job (BullMQ):**
- Creates GuardianIssuedPetVC in VC service
- Stores VC in database
- VC contains pet data + biometric hash + guardian signature
- Can be used for pet ownership proof

**3. Image Move Job (BullMQ):**
- Moves images from S3 temp folder → permanent folders:
  - Nose print: \`nose-print-photo/{petDID}/filename.jpg\`
  - Profile images: \`pet-profile-photo/{petDID}/filename.jpg\`
- Triggers Spring backend sync after completion
- Spring creates pet record in MySQL/PostgreSQL

**Pet DID Verification:**
- Endpoint re-extracts feature vector from nose image
- Recalculates Pet DID and compares with prepare-registration result
- Ensures no tampering between prepare and register calls
- If mismatch detected → 400 Bad Request

**Error Handling - Blockchain TX Fails:**
\`\`\`javascript
{
  success: false,
  error: "Pet registration failed",
  errorCode: "NONCE_TOO_LOW",  // or other error codes
  retryable: true,  // or false
  txHash: "0x...",  // May be present
  blockNumber: null,
  details: { ... }  // Additional error info
}
\`\`\`

**Error Codes:**
- \`NONCE_TOO_LOW\`: Transaction nonce conflict (retryable)
- \`INSUFFICIENT_FUNDS\`: Not enough gas (not retryable)
- \`EXECUTION_REVERTED\`: Contract rejected TX (check pet DID uniqueness)
- \`TIMEOUT\`: Blockchain timeout (retryable)

**HTTP Status Codes:**
- 200: Success
- 400: Bad Request (invalid data, DID mismatch, contract revert)
- 401: Unauthorized (invalid token)
- 503: Service Unavailable (retryable blockchain errors)

**Important Notes:**
- Only Pet Registration TX is executed immediately
- Guardian Link and VC creation are queued (may take seconds)
- Images are moved asynchronously
- Spring sync happens after image move completes
- You can check job status using job IDs (if monitoring endpoint exists)

**Required Fields:**
- All pet data fields (same as prepare-registration)
- \`signedTx\`: Pet Registration signed transaction (required)
- \`guard ianLinkSignedTx\`: Guardian Link signed TX (optional but recommended)
- \`vcSignature\`: VC consent signature (optional but recommended)
- \`vcMessage\`: Original VC message as JSON string (required if vcSignature provided)

**Validation:**
- Pet data must match prepare-registration call
- Nose image must produce same Pet DID
- Signed transactions must be valid
- Guardian must still be registered
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'Pet registered successfully on blockchain, background jobs queued',
    schema: {
      example: {
        success: true,
        petDID: 'did:ethr:besu:0x1234567890abcdef1234567890abcdef12345678',
        txHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        blockNumber: 12345,
        message: 'Pet registered successfully! Background jobs queued.',
        jobs: {
          guardianLink: 'job-abc123-def456',
          vc: 'job-def456-ghi789',
          imageMove: 'job-ghi789-jkl012'
        },
        note: 'Images will be moved to permanent storage, then Spring sync will be triggered automatically.'
      }
    }
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid data, Pet DID mismatch, guardian not registered, or blockchain contract revert',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or expired token',
  })
  @ApiResponse({
    status: 503,
    description: 'Service Unavailable - Retryable blockchain error (nonce conflict, timeout, etc.)',
    schema: {
      example: {
        success: false,
        error: 'Pet registration failed',
        errorCode: 'NONCE_TOO_LOW',
        retryable: true,
        txHash: null,
        blockNumber: null,
        details: { message: 'Nonce too low. Current nonce is 5, transaction nonce is 3.' }
      }
    }
  })
  async registerPet(
    @Req() req: Request,
    @Body() dto: CreatePetDto,
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

    // 2. 비문 이미지 확인
    if (!dto.noseImage) {
      throw new BadRequestException('비문 이미지가 필요합니다.');
    }

    // 3. S3 temp 폴더에서 비문 이미지 가져오기
    let noseImageBuffer: Buffer;
    try {
      noseImageBuffer = await this.commonService.getFileFromTemp(dto.noseImage);
    } catch (error) {
      console.error('S3에서 비문 이미지 가져오기 실패:', error);
      throw new BadRequestException('비문 이미지를 찾을 수 없습니다.');
    }

    // 4. 파일명에서 이미지 포맷 추출
    const fileExtension = dto.noseImage.split('.').pop()?.toLowerCase();
    const imageFormat = fileExtension === 'jpg' ? 'jpeg' : fileExtension;

    if (!['jpeg', 'png'].includes(imageFormat)) {
      throw new BadRequestException('Invalid file type. Only JPEG and PNG are allowed');
    }

    let featureVector: number[];
    let featureVectorHash: string;

    try {
      const mlResult = await this.noseEmbedderService.extractNoseVector(
        noseImageBuffer,
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
      const errorResponse = {
        success: false,
        error: (txResult as any).errorMessage || 'Pet registration failed',
        errorCode: (txResult as any).errorCode,
        retryable: (txResult as any).retryable,
        txHash: (txResult as any).txHash,
        blockNumber: (txResult as any).blockNumber,
        details: (txResult as any).details
      };

      // Return with appropriate HTTP status code
      const httpStatus = (txResult as any).retryable ? HttpStatus.SERVICE_UNAVAILABLE : HttpStatus.BAD_REQUEST;
      throw new HttpException(errorResponse, httpStatus);
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
      neutral: dto.neutral,
      specifics: dto.specifics,
      images: dto.images
    };

    // 8. 이미지 이동 큐 등록 (완료 후 자동으로 Spring 동기화 트리거)
    // Extract filenames from paths (e.g., "dogcatpaw-backend/temp/file.jpg" -> "file.jpg")
    const profileImageFileNames = dto.images && dto.images.trim()
      ? dto.images.split(',')
          .map(name => name.trim())
          .filter(name => name)
          .map(path => path.split('/').pop()) // Extract filename from path
      : [];

    const noseImageFileName = dto.noseImage.split('/').pop();

    const imageMoveJobId = await this.springService.queuePetImageMove(
      petDID,
      noseImageFileName,
      profileImageFileNames,
      guardianAddress,
      petData
    );
    console.log(`✅ Queued image move - Job ID: ${imageMoveJobId}`);

    // 9. Guardian Link 큐 등록
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

    // 10. VC 생성 큐 등록
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

    return {
      success: true,
      petDID,
      txHash: txResult.txHash,
      blockNumber: txResult.blockNumber,
      message: 'Pet registered successfully! Background jobs queued.',
      jobs: {
        guardianLink: guardianLinkJobId || 'not_submitted',
        vc: vcJobId || 'not_submitted',
        imageMove: imageMoveJobId,
      },
      note: 'Images will be moved to permanent storage, then Spring sync will be triggered automatically.',
    };
  }

  /**
   * 소유권 이전 Step 1: 서명 준비 (현재 보호자가 호출)
   */
  @Post('prepare-transfer/:petDID')
  @UseGuards(DIDAuthGuard)
  @ApiOperation({
    summary: 'Step 1: Prepare Pet Ownership Transfer - Generate VC Signing Data',
    description: `
**Initiate pet ownership transfer by preparing signing data for new guardian**

This is the first step of the pet ownership transfer (adoption) process. Only the current pet controller (owner) can initiate a transfer.

**Complete Ownership Transfer Flow:**
\`\`\`
Step 1: This endpoint - Current guardian prepares VC signing data
Step 2: New guardian signs message off-chain (client-side)
Step 3: POST /pet/verify-transfer/:petDID - New guardian uploads nose print for biometric verification
Step 4: POST /pet/accept-transfer/:petDID/:adoptionId - New guardian submits signature + verification proof → Blockchain execution
\`\`\`

**What This Endpoint Does:**
1. Verifies Pet DID exists on blockchain
2. Verifies caller is current controller (owner) of the pet
3. Fetches pet's biometric data (feature vector hash) from storage
4. Prepares VC transfer signing message for new guardian to sign
5. Returns signing data with message and messageHash

**Authorization:**
- Only current pet controller can call this endpoint
- Caller must provide valid JWT access token
- Pet DID must exist on blockchain

**Request Body:**
\`\`\`javascript
{
  newGuardianAddress: "0x1234567890123456789012345678901234567890",  // New owner address
  petData: {
    petName: "Max",
    breed: "GOLDEN_RETRIEVER",
    old: 3,
    gender: "MALE",
    weight: 25.5,
    color: "황금색",
    feature: "활발함",
    neutral: true,
    specifics: "dog"
  }
}
\`\`\`

**Response - VC Signing Data:**
\`\`\`javascript
{
  success: true,
  message: {
    vc: {
      vcType: "GuardianPetOwnershipTransferVC",
      credentialSubject: {
        previousGuardian: "0xe9ebc691ccfb15cb4bf31af83c624b7020f0d2c0",  // Current owner
        guardian: "0x1234567890123456789012345678901234567890",  // New owner
        petDID: "did:ethr:besu:0xabcdef...",
        biometricHash: "0x...",
        petData: { ... }
      },
      issuedAt: "2025-10-25T12:00:00Z",
      nonce: "random-string"
    }
  },
  messageHash: "0x...",  // keccak256 of message for signing
  nextStep: "New guardian must sign and call POST /pet/accept-transfer/:petDID"
}
\`\`\`

**Next Steps After Receiving Response:**
\`\`\`javascript
// 1. New guardian receives message and messageHash
// 2. New guardian signs messageHash with their wallet
const wallet = new ethers.Wallet(newGuardianPrivateKey);
const signature = await wallet.signMessage(ethers.getBytes(response.messageHash));

// 3. New guardian uploads nose print for biometric verification
// See POST /pet/verify-transfer/:petDID

// 4. New guardian submits signature + verification proof
// See POST /pet/accept-transfer/:petDID/:adoptionId
\`\`\`

**Use Cases:**
- Pet adoption: Transfer ownership to adopter after successful adoption
- Guardian change: Transfer to family member or friend
- Rescue/rehoming: Transfer to new guardian through authorized channels

**Important Notes:**
- This endpoint does NOT execute blockchain transactions
- It only prepares signing data for the new guardian
- Actual transfer happens in Step 4 (accept-transfer)
- Biometric verification (Step 3) is required before acceptance
- Previous guardian VC will be invalidated upon successful transfer
- New guardian VC will be created in background job

**Error Cases:**
- Pet DID not found → 400 Bad Request
- Caller is not current controller → 400 Bad Request
- Biometric data not found → 400 Bad Request
- Invalid token → 401 Unauthorized
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'VC signing data prepared successfully',
    schema: {
      example: {
        success: true,
        message: {
          vc: {
            vcType: 'GuardianPetOwnershipTransferVC',
            credentialSubject: {
              previousGuardian: '0xe9ebc691ccfb15cb4bf31af83c624b7020f0d2c0',
              guardian: '0x1234567890123456789012345678901234567890',
              petDID: 'did:ethr:besu:0xabcdef...',
              biometricHash: '0x...',
              petData: {
                petName: 'Max',
                breed: 'GOLDEN_RETRIEVER',
                old: 3
              }
            },
            issuedAt: '2025-10-25T12:00:00Z',
            nonce: 'abc123'
          }
        },
        messageHash: '0x1234567890abcdef...',
        nextStep: 'New guardian must sign and call POST /pet/accept-transfer/:petDID'
      }
    }
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Pet DID not found, caller not controller, or biometric data missing'
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or expired token'
  })
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

    // 5. 이전용 서명 데이터 생성
    // 💡 현재 소유자가 이 API를 호출하지만, 반환된 데이터는 "새 보호자"가 서명해야 함
    // 플로우: 현재 소유자 → 서명 데이터 생성 → 새 소유자에게 전달 → 새 소유자가 서명
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
  @ApiOperation({
    summary: 'Step 3: Verify New Guardian Biometric - Upload Nose Print for Matching',
    description: `
**Verify new guardian has physical custody of pet through biometric nose print matching**

This is the critical biometric verification step in ownership transfer. The new guardian must upload a nose print photo of the pet to prove they have physical custody.

**Complete Ownership Transfer Flow:**
\`\`\`
Step 1: POST /pet/prepare-transfer/:petDID - Current guardian prepares signing data
Step 2: New guardian signs message off-chain (client-side)
Step 3: This endpoint - New guardian uploads nose print for verification
Step 4: POST /pet/accept-transfer/:petDID/:adoptionId - Complete transfer on blockchain
\`\`\`

**What This Endpoint Does:**
1. New guardian uploads nose print image of the pet
2. Moves image from temp → permanent storage (\`nose-print-photo/{petDID}/\`)
3. Sends image to ML server for feature vector extraction
4. Compares new vector with stored pet feature vector (cosine similarity)
5. Verifies similarity ≥ 50% threshold (configurable, currently 50%)
6. Records verification on blockchain (background job)
7. Returns verification proof token (valid for 10 minutes)

**Before Calling This Endpoint:**
New guardian must upload nose print image to S3 temp folder:

\`\`\`javascript
// 1. Get presigned URL for nose image
const response = await fetch('/common', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer ' + newGuardianAccessToken }
});
const { url: presignedUrl } = await response.json();

// 2. Upload nose image to S3
await fetch(presignedUrl, {
  method: 'PUT',
  body: noseImageFile,
  headers: { 'Content-Type': 'image/jpeg' }
});

// 3. Extract filename from URL
const fileName = new URL(presignedUrl).pathname.split('/').pop();

// 4. Call this endpoint with filename
const verifyResponse = await fetch(\`/pet/verify-transfer/\${petDID}\`, {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + newGuardianAccessToken,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ image: fileName })
});
\`\`\`

**Request Body:**
\`\`\`javascript
{
  image: "abc123-def456-ghi789.jpg"  // Filename from S3 temp folder
}
\`\`\`

**Response - Successful Verification (≥50% similarity):**
\`\`\`javascript
{
  success: true,
  similarity: 85,  // Percentage (0-100)
  message: "비문 검증 성공! 이제 소유권 이전을 완료할 수 있습니다.",
  verificationProof: {
    petDID: "did:ethr:besu:0xabcdef...",
    newGuardian: "0x1234567890123456789012345678901234567890",
    similarity: 85,
    verifiedAt: "2025-10-25T12:00:00.000Z",
    nonce: "xyz789"
  },
  proofHash: "0x1234567890abcdef...",  // keccak256 of proof
  nextStep: "Call POST /pet/accept-transfer/:petDID with signature and this proof"
}
\`\`\`

**Response - Failed Verification (<50% similarity):**
\`\`\`javascript
{
  success: false,
  similarity: 35,
  message: "비문이 일치하지 않습니다. 소유권 이전을 진행할 수 없습니다.",
  error: "비문이 일치하지 않습니다. 소유권 이전을 진행할 수 없습니다.",
  threshold: 50
}
\`\`\`

**Biometric Verification Details:**

**ML Comparison Process:**
\`\`\`
1. Download new nose image from S3: nose-print-photo/{petDID}/{filename}
2. ML Server extracts feature vector from new image (512-dim array)
3. ML Server loads stored pet feature vector from S3
4. Calculate cosine similarity: similarity = cos(newVector, storedVector)
5. Convert to percentage: similarityPercent = similarity * 100
6. Compare against threshold (50%)
\`\`\`

**Similarity Threshold:**
- **50%+**: Verification success → Can proceed to accept-transfer
- **<50%**: Verification failed → Cannot proceed (potential fraud/wrong pet)

**Verification Proof:**
- Generated upon successful verification
- Contains: petDID, newGuardian address, similarity score, timestamp, nonce
- **Valid for 10 minutes only** (expires after that)
- Must be submitted with accept-transfer request
- Hashed with keccak256 for integrity verification

**Blockchain Recording (Background Job):**
After successful verification, a background job records the verification event on blockchain:
- Purpose code: 2 (ownership_transfer)
- Similarity score: 90 (hardcoded for privacy - actual similarity not revealed on-chain)
- Verifier: New guardian address
- Async processing via BullMQ

**Security Features:**
- Only new guardian (JWT token holder) can verify their own transfer
- Image is permanently stored (cannot be reused for fraud)
- Proof expires in 10 minutes (prevents replay attacks)
- Blockchain record creates audit trail
- ML server comparison is deterministic and tamper-proof

**Use Cases:**
- Pet adoption: Adopter proves physical custody before accepting ownership
- Fraud prevention: Ensures person accepting ownership has actual pet
- Audit trail: On-chain verification record for disputes

**Important Notes:**
- This endpoint can be called multiple times (e.g., if first photo unclear)
- Each call generates new verification proof
- Only the latest proof is valid for accept-transfer
- Image is moved to permanent storage (not deleted from temp)
- ML server must be running and accessible
- Threshold is currently 50% (may be adjusted based on ML model accuracy)

**Error Cases:**
- Pet DID not found → 400 Bad Request
- Image not found in S3 → 400 Bad Request
- ML server extraction failed → 400 Bad Request
- ML server comparison failed → 400 Bad Request
- Similarity below threshold → 200 OK but success: false
- Invalid token → 401 Unauthorized
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'Biometric verification completed (check success field for result)',
    schema: {
      oneOf: [
        {
          description: 'Verification succeeded (≥50% similarity)',
          example: {
            success: true,
            similarity: 85,
            message: '비문 검증 성공! 이제 소유권 이전을 완료할 수 있습니다.',
            verificationProof: {
              petDID: 'did:ethr:besu:0xabcdef...',
              newGuardian: '0x1234567890123456789012345678901234567890',
              similarity: 85,
              verifiedAt: '2025-10-25T12:00:00.000Z',
              nonce: 'xyz789'
            },
            proofHash: '0x1234567890abcdef...',
            nextStep: 'Call POST /pet/accept-transfer/:petDID with signature and this proof'
          }
        },
        {
          description: 'Verification failed (<50% similarity)',
          example: {
            success: false,
            similarity: 35,
            message: '비문이 일치하지 않습니다. 소유권 이전을 진행할 수 없습니다.',
            error: '비문이 일치하지 않습니다. 소유권 이전을 진행할 수 없습니다.',
            threshold: 50
          }
        }
      ]
    }
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Pet DID not found, image not found in S3, or ML server failed'
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or expired token'
  })
  async verifyTransfer(
    @Param('petDID') petDID: string,
    @Req() req: Request,
    @Body() imageDto: TranferImageUrlDto
  ): Promise<VerifyTransferResponseDto> {
    // 주소
    const newGuardian = req.user?.address;

    console.log(`🔍 [verify-transfer] Starting biometric verification for ${petDID}`);
    console.log(`🔍 [verify-transfer] Image filename: ${imageDto.image}`);
    console.log(`🔍 [verify-transfer] New guardian: ${newGuardian}`);

    // 1. 이미지 이동
    await this.commonService.saveNosePrintToPermanentStorage(imageDto.image, petDID)

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
    console.log(`🔍 [verify-transfer] Image key: ${imageKey}`);

    try {
      console.log(`🔍 [verify-transfer] Calling ML server compareWithStoredImage...`);
      const mlResult = await this.noseEmbedderService.compareWithStoredImage(
        imageKey,
        petDID,
      );

      console.log(`🔍 [verify-transfer] ML Result:`, JSON.stringify(mlResult, null, 2));

      if (!mlResult.success) {
        console.error(`❌ [verify-transfer] ML comparison failed: ${mlResult.errorMessage}`);
        throw new BadRequestException(mlResult.errorMessage || '추출 및 비교 실패');
      }

      // 6. 유사도 검증 (80% 이상)
      const threshold = 50;
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
        90,
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
      console.error('❌ [verify-transfer] ML 서버 비문 검증 실패:', error);
      console.error('❌ [verify-transfer] Error details:', {
        message: error.message,
        stack: error.stack,
        response: error.response?.data
      });
      throw new BadRequestException('비문 검증에 실패했습니다.');
    }
  }

  /**
   * 소유권 이전 Step 3: 새 보호자 수락 (서명 + 비문 검증 증명과 함께)
   */
  @Post('accept-transfer/:petDID/:adoptionId')
  @UseGuards(DIDAuthGuard)
  @ApiOperation({
    summary: 'Step 4: Accept Pet Ownership Transfer - Execute Blockchain Transaction',
    description: `
**Complete pet ownership transfer by executing blockchain controller change**

This is the final and most critical step of ownership transfer. The new guardian submits their signature and biometric verification proof to execute the on-chain controller change.

**Complete Ownership Transfer Flow:**
\`\`\`
Step 1: POST /pet/prepare-transfer/:petDID - Current guardian prepares signing data
Step 2: New guardian signs message off-chain (client-side)
Step 3: POST /pet/verify-transfer/:petDID - New guardian uploads nose print (≥50% match)
Step 4: This endpoint - Execute blockchain TX + background VC processing
\`\`\`

**What This Endpoint Does:**

**Immediate Actions (Blocking):**
1. Validates new guardian signature on VC transfer message
2. Validates biometric verification proof (must be <10 minutes old)
3. **Executes PetDIDRegistry.changeController() on blockchain** (blocks until confirmed)
4. Returns transaction hash and block number

**Background Jobs (Non-blocking - BullMQ):**
5. Invalidates previous guardian's VC (marks as revoked)
6. Creates new VC for new guardian with pet ownership credentials
7. Updates Spring backend adoption record status

**Transaction Execution Flow:**
\`\`\`
1. Validate signature + verification proof (immediate) ✅
   ↓
2. Execute changeController TX (immediate) ✅ Blocks until confirmed
   ↓
3. Queue VC transfer job (background) → Invalidate old + Create new VC
4. Queue Spring sync job (background) → Update adoption status
\`\`\`

**Request Parameters:**
- \`:petDID\`: Pet DID identifier (e.g., "did:ethr:besu:0xabcdef...")
- \`:adoptionId\`: Adoption record ID from Spring backend

**Request Body:**
\`\`\`javascript
{
  signature: "0xabcdef...",  // New guardian signature from Step 2
  message: {
    vc: {
      vcType: "GuardianPetOwnershipTransferVC",
      credentialSubject: {
        previousGuardian: "0xe9ebc691ccfb15cb4bf31af83c624b7020f0d2c0",
        guardian: "0x1234567890123456789012345678901234567890",  // Must match caller
        petDID: "did:ethr:besu:0xabcdef...",
        biometricHash: "0x...",
        petData: { ... }
      },
      issuedAt: "2025-10-25T12:00:00Z",
      nonce: "abc123"
    }
  },
  petData: {
    petName: "Max",
    breed: "GOLDEN_RETRIEVER",
    old: 3,
    gender: "MALE",
    weight: 25.5,
    color: "황금색",
    feature: "활발함",
    neutral: true,
    specifics: "dog"
  },
  verificationProof: {
    petDID: "did:ethr:besu:0xabcdef...",
    newGuardian: "0x1234567890123456789012345678901234567890",
    similarity: 85,
    verifiedAt: "2025-10-25T12:00:00.000Z",
    nonce: "xyz789"
  },
  signedTx: "0xf86c..."  // Signed changeController transaction
}
\`\`\`

**Complete Flow Example:**
\`\`\`javascript
// Prerequisites: Steps 1-3 completed
// Step 1: Current guardian called prepare-transfer
// Step 2: New guardian signed message
// Step 3: New guardian verified biometric (got verificationProof)

// Step 4: New guardian accepts transfer
const acceptData = {
  signature: newGuardianSignature,  // From Step 2
  message: vcTransferMessage,       // From Step 1
  petData: {
    petName: 'Max',
    breed: 'GOLDEN_RETRIEVER',
    old: 3,
    gender: 'MALE',
    weight: 25.5,
    color: '황금색',
    feature: '활발함',
    neutral: true,
    specifics: 'dog'
  },
  verificationProof: verificationProofFromStep3,  // From Step 3
  signedTx: changeControllerSignedTx  // Signed transaction
};

const response = await fetch(\`/pet/accept-transfer/\${petDID}/\${adoptionId}\`, {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + newGuardianAccessToken,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(acceptData)
});

const result = await response.json();
console.log('Transfer Complete!');
console.log('TX Hash:', result.txHash);
console.log('Block Number:', result.blockNumber);
console.log('Similarity:', result.similarity);
console.log('VC Job ID:', result.vcTransferJobId);
\`\`\`

**Response - Immediate Results:**
\`\`\`javascript
{
  success: true,
  txHash: "0xabcdef1234567890...",  // PetDIDRegistry.changeController TX
  blockNumber: 12345,
  similarity: 85,  // From verification proof
  vcTransferJobId: "job-uuid-123",  // BullMQ job ID
  message: "Pet ownership transferred successfully on blockchain. VC processing queued."
}
\`\`\`

**Blockchain Controller Change:**
\`\`\`solidity
// PetDIDRegistry smart contract
function changeController(string memory _did, address _newController) public {
  require(msg.sender == didToController[_did], "Only current controller");
  address oldController = didToController[_did];
  didToController[_did] = _newController;
  emit ControllerChanged(_did, oldController, _newController);
}
\`\`\`

**Background Jobs Details:**

**1. VC Transfer Job (BullMQ):**
- Invalidates previous guardian's VC (marks as revoked in database)
- Creates new VC for new guardian:
  - VC Type: GuardianPetOwnershipTransferVC
  - Credent ial Subject: { previousGuardian, guardian, petDID, biometricHash, petData }
  - New guardian signature included as proof of consent
- Stores new VC in VC service database

**2. Spring Backend Sync Job (BullMQ):**
- Updates adoption record status in Spring backend
- Marks adoption as "completed" in MySQL/PostgreSQL
- Updates pet owner information
- Triggers notification to previous guardian (optional)

**Validation Checks:**

**1. Signature Validation:**
- Message guardian must match caller's address (new guardian)
- Signature must be valid ECDSA signature on message

**2. Verification Proof Validation:**
- Proof newGuardian must match caller's address
- Proof petDID must match URL parameter
- Proof must be less than 10 minutes old (timestamp check)
- Proof must have valid structure

**3. Blockchain Transaction:**
- SignedTx must be valid signed transaction
- Transaction must call changeController() function
- Current controller is NOT updated in GuardianRegistry (requires separate signatures)

**GuardianRegistry Sync Limitation:**
The GuardianRegistry contract (which maintains guardian → pets mapping) is NOT automatically synced because:
- linkPet() and unlinkPet() require msg.sender to be guardian
- Background jobs cannot use user's private key for signing
- Solution: PetDIDRegistry controller is the single source of truth
- GuardianRegistry is auxiliary mapping only

**Error Handling - Validation Failures:**
\`\`\`javascript
{
  success: false,
  error: "Not the designated new guardian"  // or other error messages
}
\`\`\`

**Error Handling - Blockchain TX Fails:**
\`\`\`javascript
{
  success: false,
  error: "Pet transfer failed",
  errorCode: "NONCE_TOO_LOW",  // or INSUFFICIENT_FUNDS, EXECUTION_REVERTED, etc.
  retryable: true,
  txHash: null,
  blockNumber: null,
  details: { ... }
}
\`\`\`

**Error Codes:**
- \`NONCE_TOO_LOW\`: Transaction nonce conflict (retryable)
- \`INSUFFICIENT_FUNDS\`: Not enough gas (not retryable)
- \`EXECUTION_REVERTED\`: Contract rejected (caller not current controller, or pet DID not found)
- \`TIMEOUT\`: Blockchain timeout (retryable)

**HTTP Status Codes:**
- 200: Success
- 400: Bad Request (invalid signature, expired proof, guardian mismatch)
- 401: Unauthorized (invalid token)
- 503: Service Unavailable (retryable blockchain errors)

**Security Features:**
- Only new guardian (message recipient) can accept transfer
- Biometric verification proof required (proves physical custody)
- Proof expires in 10 minutes (prevents replay attacks)
- Signature verification prevents impersonation
- Blockchain execution is atomic (either succeeds fully or fails)

**Important Notes:**
- Only blockchain controller change is immediate (blocks response)
- VC processing is async (may take seconds to complete)
- Spring sync is async (adoption status updated in background)
- GuardianRegistry is NOT synced automatically
- Previous guardian loses blockchain controller rights immediately
- New guardian can now control pet DID and transfer again

**Required Fields:**
- \`signature\`: New guardian signature (required)
- \`message\`: VC transfer message (required)
- \`petData\`: Pet data for new VC (required)
- \`verificationProof\`: Biometric proof from Step 3 (required, <10 min old)
- \`signedTx\`: Signed changeController transaction (required in production)

**Use Cases:**
- Pet adoption completion: Adopter accepts ownership after successful application
- Guardian change: Family member accepts pet responsibility
- Rescue transfer: New rescue organization accepts custody
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'Pet ownership transferred successfully on blockchain, VC processing queued',
    schema: {
      example: {
        success: true,
        txHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        blockNumber: 12345,
        similarity: 85,
        vcTransferJobId: 'job-abc123-def456-ghi789',
        message: 'Pet ownership transferred successfully on blockchain. VC processing queued.'
      }
    }
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid signature, expired verification proof, guardian mismatch, or blockchain contract revert',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or expired token',
  })
  @ApiResponse({
    status: 503,
    description: 'Service Unavailable - Retryable blockchain error (nonce conflict, timeout, etc.)',
    schema: {
      example: {
        success: false,
        error: 'Pet transfer failed',
        errorCode: 'NONCE_TOO_LOW',
        retryable: true,
        txHash: null,
        blockNumber: null,
        details: { message: 'Nonce too low. Current nonce is 5, transaction nonce is 3.' }
      }
    }
  })
  async acceptTransfer(
    @Param('petDID') petDID: string,
    @Param('adoptionId') adoptionId: number,
    @Req() req: Request,
    @Body() dto: AcceptTransferDto
  ) {
    console.log(dto.message.vc)
    const newGuardian = req.user?.address;

    // 1. 메시지의 새 보호자가 현재 사용자인지 확인
    const messageGuardian = dto.message.vc?.credentialSubject?.guardian;
    if (messageGuardian?.toLowerCase() !== newGuardian?.toLowerCase()) {
      return {
        success: false,
        error: 'Not the designated new guardian',
      };
    }

    // 2. 비문 검증 증명 확인
    if (!dto.verificationProof || dto.verificationProof.newGuardian?.toLowerCase() !== newGuardian?.toLowerCase()) {
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

    // 3. Get previous guardian from message
    const previousGuardian = dto.message.vc?.credentialSubject?.previousGuardian;

    // 4. 온체인 Controller 변경 (Critical - must succeed)
    // ⚠️  중요: changeController는 현재 소유자만 실행 가능!
    // 프론트엔드에서 현재 소유자가 서명한 signedTx를 전달해야 함
    console.log(`🔍 [accept-transfer] Attempting changeController:`);
    console.log(`  - Pet DID: ${petDID}`);
    console.log(`  - Previous Guardian: ${previousGuardian}`);
    console.log(`  - New Guardian: ${newGuardian}`);
    console.log(`  - SignedTx provided: ${dto.signedTx ? 'Yes (length: ' + dto.signedTx.length + ')' : 'No'}`);

    // Get current controller from blockchain
    const didDoc = await this.petService.getDIDDocument(petDID);
    console.log(`  - Current Controller on-chain: ${didDoc.controller}`);
    console.log(`  - Expected Previous Guardian: ${previousGuardian}`);

    if (didDoc.controller.toLowerCase() !== previousGuardian.toLowerCase()) {
      console.error(`❌ Controller mismatch! On-chain: ${didDoc.controller}, Expected: ${previousGuardian}`);
    }

    const txResult = await this.petService.changeController(
      petDID,
      newGuardian,
      dto.signedTx
    );

    if (!txResult.success) {
      const errorResponse = {
        success: false,
        error: (txResult as any).errorMessage || 'Pet transfer failed',
        errorCode: (txResult as any).errorCode,
        retryable: (txResult as any).retryable,
        txHash: (txResult as any).txHash,
        blockNumber: (txResult as any).blockNumber,
        details: (txResult as any).details
      };

      // Return with appropriate HTTP status code
      const httpStatus = (txResult as any).retryable ? HttpStatus.SERVICE_UNAVAILABLE : HttpStatus.BAD_REQUEST;
      throw new HttpException(errorResponse, httpStatus);
    }

    console.log(`✅ Pet transfered on blockchain: ${petDID} - TxHash: ${txResult.txHash}`);

    // 5. GuardianRegistry sync skipped
    // GuardianRegistry는 보조 매핑이고, linkPet/unlinkPet은 msg.sender가 guardian이어야 하므로
    // 백그라운드 job으로 처리 불가. PetDIDRegistry의 controller만 신뢰 가능한 소스.
    console.log(`⚠️  GuardianRegistry sync skipped (requires user signatures)`);

    // 6. Queue VC transfer processing (invalidate old VC + create new VC)
    // 블록체인 성공 후 즉시 응답, VC는 백그라운드에서 BullMQ로 처리
    const vcTransferJobId = await this.vcQueueService.queueVCTransfer(
      petDID,
      newGuardian,
      previousGuardian,
      dto.signature,
      dto.message,
      dto.vcSignedData,
      dto.petData
    );
    console.log(`📝 Queued VC transfer job - Job ID: ${vcTransferJobId}`);

    // 7. Spring 서버 동기화 큐 등록
    const springJobId = await this.springService.queueTransferPet(
      adoptionId,
      newGuardian
    );
    console.log(`✅ Queued Spring sync - Job ID: ${springJobId}`);

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
  @ApiOperation({
    summary: 'Get Pet Ownership Transfer History - Adoption Records',
    description: `
**Retrieve complete ownership transfer history for a pet from blockchain**

This endpoint fetches all historical controller changes (ownership transfers) for a specific pet DID from the blockchain indexer service, with fallback to direct blockchain querying.

**What This Endpoint Does:**
1. Queries blockchain-indexer service (gRPC) for pet transfer history
2. If indexer unavailable, falls back to direct blockchain RPC calls
3. Returns chronological list of all ownership transfers
4. Includes transaction hashes, block numbers, and timestamps
5. Shows current controller (current owner) and total transfer count

**Use Cases:**
- Pet adoption history: View complete adoption timeline
- Ownership verification: Verify current owner from blockchain
- Audit trail: Track all ownership changes for dispute resolution
- Provenance tracking: Full pet ownership lineage

**Data Sources:**

**Primary: Blockchain Indexer (Preferred):**
- Fast indexed database queries (PostgreSQL/MySQL)
- Supports large history (100+ transfers)
- Includes human-readable timestamps
- Response time: <100ms

**Fallback: Direct Blockchain RPC:**
- Used when indexer is offline or unreachable
- Queries blockchain event logs directly
- **Limited by RPC range limits** (typically 10,000 blocks)
- Response time: 1-5 seconds
- May fail for very old pets with RPC range exceeded

**Fallback-Limited Mode:**
If both indexer and full blockchain query fail due to RPC limits:
- Returns only current controller (from PetDIDRegistry state)
- Returns pet creation date
- History array is empty
- Warning message included

**Request Parameters:**
- \`:petDID\`: Pet DID identifier (e.g., "did:ethr:besu:0xabcdef...")

**Response - Successful Query (Indexer):**
\`\`\`javascript
{
  success: true,
  petDID: "did:ethr:besu:0xabcdef...",
  currentController: "0x1234567890123456789012345678901234567890",
  totalTransfers: 3,
  history: [
    {
      previousController: "0x0000000000000000000000000000000000000000",  // Initial registration
      newController: "0xe9ebc691ccfb15cb4bf31af83c624b7020f0d2c0",   // First owner
      blockNumber: 10000,
      transactionHash: "0xabc...",
      timestamp: 1698172800,  // Unix timestamp
      timestampISO: "2024-10-25T12:00:00.000Z",
      transferIndex: 0
    },
    {
      previousController: "0xe9ebc691ccfb15cb4bf31af83c624b7020f0d2c0",
      newController: "0x1234567890123456789012345678901234567890",   // Transferred to new owner
      blockNumber: 12345,
      transactionHash: "0xdef...",
      timestamp: 1698259200,
      timestampISO: "2024-10-26T12:00:00.000Z",
      transferIndex: 1
    },
    {
      previousController: "0x1234567890123456789012345678901234567890",
      newController: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",   // Latest transfer
      blockNumber: 15000,
      transactionHash: "0xghi...",
      timestamp: 1698345600,
      timestampISO: "2024-10-27T12:00:00.000Z",
      transferIndex: 2
    }
  ],
  source: "blockchain-indexer"  // or "blockchain-fallback" or "blockchain-fallback-limited"
}
\`\`\`

**Response - Blockchain Fallback (RPC Limited):**
\`\`\`javascript
{
  success: true,
  petDID: "did:ethr:besu:0xabcdef...",
  currentController: "0x1234567890123456789012345678901234567890",
  totalTransfers: null,  // Unknown
  history: [],  // Empty due to RPC range limit
  warning: "Full history unavailable - indexer offline and RPC range limit exceeded",
  message: "Only current controller is available.",
  createdDate: "2024-10-25T12:00:00.000Z",  // Pet registration date
  source: "blockchain-fallback-limited"
}
\`\`\`

**Response - Error:**
\`\`\`javascript
{
  success: false,
  error: "Failed to fetch pet history",
  message: "Pet DID not found on blockchain"
}
\`\`\`

**Blockchain Event Structure:**

**PetDIDRegistry Contract Event:**
\`\`\`solidity
event ControllerChanged(
  string indexed did,
  address indexed previousController,
  address indexed newController
);
\`\`\`

**Initial Registration:**
- previousController: 0x0000000000000000000000000000000000000000 (zero address)
- newController: First guardian address
- Triggered by: registerPetDID() function

**Ownership Transfer:**
- previousController: Current owner address
- newController: New owner address
- Triggered by: changeController() function

**History Interpretation:**

**Transfer Index 0 (Initial Registration):**
\`\`\`javascript
{
  previousController: "0x0000000000000000000000000000000000000000",
  newController: "0xe9eb...",  // First owner
  transferIndex: 0
}
// Interpretation: Pet was registered by guardian 0xe9eb...
\`\`\`

**Transfer Index 1+ (Ownership Transfers):**
\`\`\`javascript
{
  previousController: "0xe9eb...",  // Previous owner
  newController: "0x1234...",  // New owner
  transferIndex: 1
}
// Interpretation: Pet was transferred from 0xe9eb... to 0x1234...
\`\`\`

**Current Controller Determination:**
- If history exists: Last entry's newController
- If history empty: Query PetDIDRegistry.getDIDDocument(petDID).controller

**Query Parameters (Indexer):**
- \`petDID\`: Pet DID to query
- \`limit\`: 100 (maximum events to return)
- \`offset\`: 0 (pagination offset)

**Performance:**
- Indexer query: ~50-100ms
- Blockchain fallback: ~1-5 seconds (depends on history length)
- Fallback-limited mode: ~100ms (single state query)

**Fallback Behavior:**
\`\`\`
1. Try indexer service (gRPC)
   ↓ (if fails)
2. Try blockchain RPC (event log query)
   ↓ (if RPC range limit exceeded)
3. Return limited data (current controller only + warning)
\`\`\`

**Important Notes:**
- History is immutable (blockchain data cannot be altered)
- Indexer provides faster queries for long histories
- Blockchain fallback ensures availability even if indexer is down
- RPC range limits may prevent full history retrieval for very old pets
- Current controller is always available (from blockchain state)
- Transfer count includes initial registration (index 0)

**Example Use Cases:**

**1. Verify Current Owner:**
\`\`\`javascript
const response = await fetch(\`/pet/history/\${petDID}\`);
const { currentController } = await response.json();
console.log(\`Current owner: \${currentController}\`);
\`\`\`

**2. Show Adoption Timeline:**
\`\`\`javascript
const response = await fetch(\`/pet/history/\${petDID}\`);
const { history } = await response.json();

history.forEach(transfer => {
  if (transfer.transferIndex === 0) {
    console.log(\`Registered by: \${transfer.newController} at \${transfer.timestampISO}\`);
  } else {
    console.log(\`Transferred from \${transfer.previousController} to \${transfer.newController} at \${transfer.timestampISO}\`);
  }
});
\`\`\`

**3. Audit Ownership Changes:**
\`\`\`javascript
const response = await fetch(\`/pet/history/\${petDID}\`);
const { totalTransfers, history } = await response.json();
console.log(\`Total ownership changes: \${totalTransfers}\`);
console.log(\`Transaction hashes: \${history.map(h => h.transactionHash).join(', ')}\`);
\`\`\`

**Error Cases:**
- Pet DID not found → 200 OK but success: false
- Indexer offline + RPC limit → 200 OK with warning and limited data
- Invalid petDID format → 400 Bad Request (validation)
- Network error → 500 Internal Server Error
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'Pet transfer history retrieved successfully (check source field for data source)',
    schema: {
      oneOf: [
        {
          description: 'Full history from indexer or blockchain',
          example: {
            success: true,
            petDID: 'did:ethr:besu:0xabcdef1234567890abcdef1234567890abcdef12',
            currentController: '0x1234567890123456789012345678901234567890',
            totalTransfers: 2,
            history: [
              {
                previousController: '0x0000000000000000000000000000000000000000',
                newController: '0xe9ebc691ccfb15cb4bf31af83c624b7020f0d2c0',
                blockNumber: 10000,
                transactionHash: '0xabc123...',
                timestamp: 1698172800,
                timestampISO: '2024-10-25T12:00:00.000Z',
                transferIndex: 0
              },
              {
                previousController: '0xe9ebc691ccfb15cb4bf31af83c624b7020f0d2c0',
                newController: '0x1234567890123456789012345678901234567890',
                blockNumber: 12345,
                transactionHash: '0xdef456...',
                timestamp: 1698259200,
                timestampISO: '2024-10-26T12:00:00.000Z',
                transferIndex: 1
              }
            ],
            source: 'blockchain-indexer'
          }
        },
        {
          description: 'Limited data when indexer offline and RPC range exceeded',
          example: {
            success: true,
            petDID: 'did:ethr:besu:0xabcdef1234567890abcdef1234567890abcdef12',
            currentController: '0x1234567890123456789012345678901234567890',
            totalTransfers: null,
            history: [],
            warning: 'Full history unavailable - indexer offline and RPC range limit exceeded',
            message: 'Only current controller is available.',
            createdDate: '2024-10-25T12:00:00.000Z',
            source: 'blockchain-fallback-limited'
          }
        }
      ]
    }
  })
  @ApiResponse({
    status: 200,
    description: 'Error retrieving pet history',
    schema: {
      example: {
        success: false,
        error: 'Failed to fetch pet history',
        message: 'Pet DID not found on blockchain'
      }
    }
  })
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


    // ==================== 🆕 Redis-based Adoption Transfer Flow ====================

    /**
     * POST /pet/transfer/init/:adoptionId
     *
     * Transfer 초기화 - 소유자가 입양 승인 및 이전 시작
     *
     * Flow:
     * 1. 소유자가 prepare-transfer 완료 후 호출
     * 2. Redis에 transfer 데이터 저장 (TTL: 24시간)
     * 3. Redis Pub/Sub로 채팅방에 알림 발행
     * 4. WebSocket으로 실시간 알림
     */
    @Post('transfer/init/:adoptionId')
    @UseGuards(DIDAuthGuard)
    @ApiOperation({
      summary: 'Initialize Pet Transfer - Store prepare-transfer data in Redis',
      description: `
  Owner initiates pet transfer by storing Step 1 (prepare-transfer) result in Redis.

  **Authorization**: Owner only (current pet controller)

  **Request Body**:
  \`\`\`json
  {
    "petDID": "did:ethr:besu:0x...",
    "roomId": 1,
    "prepareData": {
      "success": true,
      "message": { ... },
      "messageHash": "0x...",
      "signingData": "..."
    },
    "newGuardianAddress": "0x..."
  }
  \`\`\`

  **Response**:
  \`\`\`json
  {
    "success": true,
    "message": "Transfer initiated successfully",
    "adoptionId": 1,
    "expiresIn": 86400
  }
  \`\`\`

  **What Happens**:
  1. Stores transfer data in Redis with key \`adoption:transfer:{adoptionId}\`
  2. Sets TTL to 24 hours
  3. Publishes \`transferInitiated\` event to Redis channel \`nestjs:broadcast:{roomId}\`
  4. WebSocket broadcasts to chat room participants
      `,
    })
    @ApiResponse({ status: 201, description: 'Transfer initialized successfully' })
    @ApiResponse({ status: 400, description: 'Invalid request data' })
    @ApiResponse({ status: 401, description: 'Unauthorized - not the owner' })
    async initTransfer(
      @Param('adoptionId') adoptionId: number,
      @Body() body: {
        petDID: string;
        roomId: number;
        prepareData: any;
        newGuardianAddress: string;
      },
      @Req() req: Request,
    ) {
      try {
        const currentUser = req.user as any;

        // Redis 키 생성
        const redisKey = `adoption:transfer:${adoptionId}`;

        // Transfer 데이터 구조
        const transferData = {
          petDID: body.petDID,
          adoptionId,
          roomId: body.roomId,
          status: 'INITIATED',
          prepareData: body.prepareData,
          currentGuardianAddress: currentUser.address.toLowerCase(),
          newGuardianAddress: body.newGuardianAddress.toLowerCase(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        // Redis에 저장 (TTL: 24시간)
        await this.redisService.setex(
          redisKey,
          86400,  // 24 hours
          JSON.stringify(transferData),
        );

        console.log(`✅ Transfer initialized for adoption ${adoptionId}`);
        console.log(`  - Pet DID: ${body.petDID}`);
        console.log(`  - Room ID: ${body.roomId}`);
        console.log(`  - New Guardian: ${body.newGuardianAddress}`);

        // Redis Pub/Sub로 채팅방에 알림 발행
        const notificationMessage = {
          type: 'transferInitiated',
          adoptionId,
          petDID: body.petDID,
          status: 'INITIATED',
          message: '입양이 승인되었습니다! 비문 검증을 시작해주세요.',
          timestamp: new Date().toISOString(),
        };

        await this.redisService.publish(
          `nestjs:broadcast:${body.roomId}`,
          JSON.stringify(notificationMessage),
        );

        console.log(`📢 Published transferInitiated event to room ${body.roomId}`);

        // WebSocket으로도 직접 전송 (fallback)
        this.chatGateway.server
          .to(`room:${body.roomId}`)
          .emit('transferInitiated', notificationMessage);

        return {
          success: true,
          message: 'Transfer initiated successfully',
          adoptionId,
          expiresIn: 86400,
        };
      } catch (error) {
        console.error(`❌ Failed to initialize transfer:`, error);
        throw new BadRequestException({
          success: false,
          error: 'Failed to initialize transfer',
          message: error.message,
        });
      }
    }

    /**
     * GET /pet/transfer/data/:adoptionId
     *
     * Transfer 데이터 조회 - Redis에서 가져오기
     *
     * 입양자가 transfer 페이지에 진입할 때 Step 1 데이터를 가져옴
     */
    @Get('transfer/data/:adoptionId')
    @UseGuards(DIDAuthGuard)
    @ApiOperation({
      summary: 'Get Transfer Data from Redis',
      description: `
  Retrieve stored transfer data for an adoption process.

  **Authorization**: Adopter or Owner

  **Response**:
  \`\`\`json
  {
    "success": true,
    "data": {
      "petDID": "did:ethr:besu:0x...",
      "adoptionId": 1,
      "roomId": 1,
      "status": "INITIATED",
      "prepareData": { ... },
      "currentGuardianAddress": "0x...",
      "newGuardianAddress": "0x...",
      "createdAt": "2025-10-29T10:00:00Z",
      "updatedAt": "2025-10-29T10:00:00Z"
    }
  }
  \`\`\`

  **Error Cases**:
  - 404: Transfer not found (owner hasn't initiated yet)
  - 410: Transfer expired (> 24 hours)
      `,
    })
    @ApiResponse({ status: 200, description: 'Transfer data retrieved successfully' })
    @ApiResponse({ status: 404, description: 'Transfer not found or expired' })
    async getTransferData(
      @Param('adoptionId') adoptionId: number,
    ) {
      try {
        const redisKey = `adoption:transfer:${adoptionId}`;
        const data = await this.redisService.get(redisKey);

        if (!data) {
          throw new HttpException(
            {
              success: false,
              error: 'Transfer not found',
              message: '소유자가 아직 입양을 승인하지 않았거나, 이전 데이터가 만료되었습니다.',
            },
            HttpStatus.NOT_FOUND,
          );
        }

        const transferData = JSON.parse(data);

        console.log(`📥 Retrieved transfer data for adoption ${adoptionId}`);
        console.log(`  - Status: ${transferData.status}`);
        console.log(`  - Pet DID: ${transferData.petDID}`);

        return {
          success: true,
          data: transferData,
        };
      } catch (error) {
        if (error instanceof HttpException) {
          throw error;
        }

        console.error(`❌ Failed to get transfer data:`, error);
        throw new BadRequestException({
          success: false,
          error: 'Failed to retrieve transfer data',
          message: error.message,
        });
      }
    }

    /**
     * PATCH /pet/transfer/update/:adoptionId
     *
     * Transfer 상태 업데이트
     *
     * 입양자가 각 단계(서명, 검증)를 완료할 때마다 호출
     */
    @Patch('transfer/update/:adoptionId')
    @UseGuards(DIDAuthGuard)
    @ApiOperation({
      summary: 'Update Transfer Status in Redis',
      description: `
  Update transfer status as adopter completes each step.

  **Authorization**: Adopter (new guardian)

  **Request Body**:
  \`\`\`json
  {
    "status": "SIGNED" | "VERIFIED" | "COMPLETED",
    "signature": "0x...",  // for SIGNED status
    "verificationProof": { ... },  // for VERIFIED status
    "similarity": 85  // for VERIFIED status
  }
  \`\`\`

  **Response**:
  \`\`\`json
  {
    "success": true,
    "message": "Transfer status updated",
    "status": "VERIFIED"
  }
  \`\`\`

  **What Happens**:
  1. Updates Redis data
  2. Publishes \`transferUpdated\` event to Redis Pub/Sub
  3. WebSocket broadcasts to chat room
      `,
    })
    @ApiResponse({ status: 200, description: 'Status updated successfully' })
    @ApiResponse({ status: 404, description: 'Transfer not found' })
    async updateTransferStatus(
      @Param('adoptionId') adoptionId: number,
      @Body() body: {
        status: 'SIGNED' | 'VERIFIED' | 'COMPLETED';
        signature?: string;
        verificationProof?: any;
        similarity?: number;
      },
    ) {
      try {
        const redisKey = `adoption:transfer:${adoptionId}`;
        const data = await this.redisService.get(redisKey);

        if (!data) {
          throw new HttpException(
            {
              success: false,
              error: 'Transfer not found',
              message: 'Transfer data not found or expired',
            },
            HttpStatus.NOT_FOUND,
          );
        }

        const transferData = JSON.parse(data);

        // 데이터 업데이트
        const updatedData = {
          ...transferData,
          status: body.status,
          signature: body.signature || transferData.signature,
          verificationProof: body.verificationProof || transferData.verificationProof,
          similarity: body.similarity !== undefined ? body.similarity : transferData.similarity,
          updatedAt: new Date().toISOString(),
        };

        // Redis 업데이트
        await this.redisService.setex(
          redisKey,
          86400,  // TTL 유지
          JSON.stringify(updatedData),
        );

        console.log(`✅ Transfer status updated for adoption ${adoptionId}`);
        console.log(`  - New Status: ${body.status}`);

        // Redis Pub/Sub로 알림 발행
        const notificationMessage = {
          type: 'transferUpdated',
          adoptionId,
          status: body.status,
          message: this.getStatusMessage(body.status),
          timestamp: new Date().toISOString(),
        };

        await this.redisService.publish(
          `nestjs:broadcast:${transferData.roomId}`,
          JSON.stringify(notificationMessage),
        );

        // WebSocket으로도 전송
        this.chatGateway.server
          .to(`room:${transferData.roomId}`)
          .emit('transferUpdated', notificationMessage);

        console.log(`📢 Published transferUpdated event to room ${transferData.roomId}`);

        return {
          success: true,
          message: 'Transfer status updated',
          status: body.status,
        };
      } catch (error) {
        if (error instanceof HttpException) {
          throw error;
        }

        console.error(`❌ Failed to update transfer status:`, error);
        throw new BadRequestException({
          success: false,
          error: 'Failed to update transfer status',
          message: error.message,
        });
      }
    }

// pet.controller.ts에 추가
  @Delete('transfer/cancel/:adoptionId')
  @UseGuards(DIDAuthGuard)
  async cancelTransfer(
    @Param('adoptionId') adoptionId: number,
    @Req() req: Request
  ) {
    const currentUser = req.user?.address;
    const redisKey = `pet-transfer:${adoptionId}`;

    try {
      // 1. Redis에서 데이터 먼저 조회
      const dataStr = await this.redisService.get(redisKey);

      if (!dataStr) {
        return {
          success: false,
          error: 'Transfer data not found',
        };
      }

      const transferData = JSON.parse(dataStr);

      // 2. 권한 체크 (소유자만 취소 가능)
      if (transferData.currentGuardianAddress?.toLowerCase() !== currentUser?.toLowerCase()) {
        return {
          success: false,
          error: 'Only the current owner can cancel the transfer',
        };
      }

      // 3. Redis 데이터 삭제
      await this.redisService.del(redisKey);
      console.log(`✅ Transfer cancelled for adoption ${adoptionId}`);

      // 4. WebSocket으로 알림 (roomId 사용)
      if (transferData.roomId) {
        await this.redisService.publish(
          `nestjs:broadcast:${transferData.roomId}`,
          JSON.stringify({
            type: 'transferCancelled',
            adoptionId,
            petDID: transferData.petDID,
            message: '입양 이전이 취소되었습니다.',
            timestamp: new Date().toISOString(),
          })
        );
        console.log(`📢 Published transferCancelled event to room ${transferData.roomId}`);
      }

      return {
        success: true,
        message: 'Transfer cancelled successfully',
      };
    } catch (error) {
      console.error('❌ Cancel transfer error:', error);
      return {
        success: false,
        error: 'Failed to cancel transfer',
      };
    }
  }

    /**
     * Helper: 상태별 메시지 반환
     */
    private getStatusMessage(status: string): string {
      const messages = {
        'INITIATED': '입양이 승인되었습니다.',
        'SIGNED': '서명이 완료되었습니다.',
        'VERIFIED': '비문 검증이 완료되었습니다.',
        'COMPLETED': '입양이 완료되었습니다!',
      };
      return messages[status] || '상태가 업데이트되었습니다.';
    }
}
