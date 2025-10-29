import { Controller, Get, Post, Body, Param, UseGuards, Req } from '@nestjs/common';
import { Request } from 'express';
import { GuardianService } from './guardian.service';
import { CreateGuardianDto } from './dto/create-guardian.dto';
import { UpdateGuardianDto } from './dto/update-guardian.dto';
import { DIDAuthGuard } from 'src/auth/guard/did-auth-guard';
import { VcProxyService } from 'src/vc/vc.proxy.service';
import { VcQueueService } from 'src/vc/vc-queue.service';
import { SpringService } from 'src/spring/spring.service';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ethers } from 'ethers';
import { Role } from 'src/common/enums/role.enum';
import { error } from 'console';

@ApiTags('Guardian')
@ApiBearerAuth()
@Controller('api/guardian')
export class GuardianController {
  constructor(
    private readonly guardianService: GuardianService,
    private readonly vcProxyService: VcProxyService,
    private readonly vcQueueService: VcQueueService,
    private readonly springService: SpringService,
  ) {}

  /**
   * 보호자 등록 (이메일 인증 완료 후)
   */
  @Post('register')
  @UseGuards(DIDAuthGuard)
  @ApiOperation({
    summary: 'Register Guardian - Complete Guardian Registration on Blockchain',
    description: `
**Register guardian account on blockchain after email verification**

This endpoint completes the guardian registration process by registering the guardian on the GuardianRegistry smart contract and synchronizing data to VC service and Spring backend.

**Prerequisites:**
1. User must complete email verification via POST /email/verify-code
2. User must have valid JWT access token (from POST /api/auth/login)
3. User wallet must not be already registered on blockchain

**Complete Guardian Registration Flow:**
\`\`\`
Step 1: POST /email/send-code - Send verification code to email
Step 2: POST /email/verify-code - Verify code → Creates auth record in VC service
Step 3: This endpoint - Register guardian on blockchain
\`\`\`

**What This Endpoint Does:**

**Immediate Actions (Blocking):**
1. Checks email verification status in VC service
2. Validates email is provided (required field)
3. Checks if wallet already registered on blockchain (prevent duplicates)
4. Calculates personal data hash from email, phone, name, timestamp
5. **Executes GuardianRegistry.registerGuardian() on blockchain** (blocks until confirmed)

**Background Jobs (Non-blocking - BullMQ):**
6. Queues VC synchronization (creates/updates guardian VC)
7. **If profile image provided:** Queues image move (temp → permanent) → Then Spring sync
8. **If no profile image:** Directly queues Spring registration (USER or ADMIN role)

**Transaction Execution Flow:**
\`\`\`
1. Validate email verification ✅
   ↓
2. Execute blockchain registration ✅ Blocks until confirmed
   ↓
3. Queue VC sync (background) → Create GuardianVC
4a. If profileUrl: Queue image move → Spring sync after
4b. If no profileUrl: Queue Spring registration directly
\`\`\`

**Request Body:**
\`\`\`javascript
{
  email: "user@example.com",  // Required - must be verified
  role: "USER",  // USER or ADMIN
  phone: "+82-10-1234-5678",  // Optional
  name: "홍길동",  // Optional
  nickname: "멋쟁이",  // Optional
  profileUrl: "abc123-def456.jpg",  // Optional - S3 temp filename
  gender: "M",  // Optional - M or F
  old: 30,  // Optional - age
  address: "서울시 강남구",  // Optional - physical address
  verificationMethod: 2,  // Optional - default 2 (Email)
  signedTx: "0xf86c..."  // Optional - required in production mode
}
\`\`\`

**Response - With Profile Image:**
\`\`\`javascript
{
  success: true,
  authId: 123,  // VC service auth record ID
  txHash: "0xabcdef1234567890...",  // Blockchain transaction hash
  blockNumber: 12345,  // Block number
  vcJobId: "job-abc-123",  // BullMQ VC sync job ID
  imageMoveJobId: "job-def-456",  // BullMQ image move job ID
  message: "Guardian registered on blockchain. Profile image will be moved, then synced to Spring."
}
\`\`\`

**Response - Without Profile Image:**
\`\`\`javascript
{
  success: true,
  authId: 123,
  txHash: "0xabcdef1234567890...",
  blockNumber: 12345,
  vcJobId: "job-abc-123",
  springJobId: "job-ghi-789",  // Direct Spring registration job ID
  message: "Guardian registered on blockchain. Syncing data in background."
}
\`\`\`

**Blockchain Smart Contract:**
\`\`\`solidity
// GuardianRegistry.sol
function registerGuardian(
  address _guardian,
  bytes32 _personalDataHash,
  string memory _ncpStorageURI,
  uint8 _verificationMethod
) public {
  require(!guardians[_guardian].exists, "Already registered");
  guardians[_guardian] = Guardian({
    personalDataHash: _personalDataHash,
    ncpStorageURI: _ncpStorageURI,
    verificationMethod: _verificationMethod,
    registeredAt: block.timestamp,
    exists: true
  });
  emit GuardianRegistered(_guardian, _personalDataHash);
}
\`\`\`

**Personal Data Hash Calculation:**
\`\`\`javascript
const personalDataHash = ethers.keccak256(
  ethers.toUtf8Bytes(JSON.stringify({
    email: "user@example.com",
    phone: "+82-10-1234-5678",
    name: "홍길동",
    timestamp: Date.now()
  }))
);
// Result: 0x1234567890abcdef...
\`\`\`

**Background Jobs Details:**

**1. VC Synchronization Job (BullMQ):**
- Creates or updates GuardianVC in VC service
- Stores guardian information (email, phone, name)
- Links wallet address to auth record
- Used for authentication and profile management

**2. Image Move Job (BullMQ):**
- Moves profile image: \`temp/{filename}\` → \`guardian-profile-photo/{walletAddress}/{filename}\`
- Updates Spring backend with permanent image URL
- Registers USER or ADMIN in Spring database
- Async processing (non-blocking)

**3. Spring Registration Job (BullMQ):**
- **USER role:** Registers in users table with profile data
- **ADMIN role:** Registers in admins table for shelter/organization management
- Stores email, phone, name, nickname, gender, age, address
- Links wallet address to Spring user/admin record

**Role-Based Registration:**

**USER Role:**
- General pet guardians
- Can register pets, adopt pets, participate in community
- Registered in Spring \`users\` table

**ADMIN Role:**
- Shelters, rescue organizations, veterinary clinics
- Can post adoption listings, manage multiple pets
- Registered in Spring \`admins\` table

**Error Cases:**

**Email Not Verified:**
\`\`\`javascript
{
  success: false,
  error: "이메일 인증이 필요합니다! 먼저 인증해주세요!"
}
\`\`\`

**Email Missing:**
\`\`\`javascript
{
  success: false,
  error: "이메일은 필수 항목입니다"
}
\`\`\`

**Already Registered:**
\`\`\`javascript
{
  success: false,
  error: "이미 블록체인에 등록된 주소입니다. 중복 등록은 불가능합니다.",
  alreadyRegistered: true
}
\`\`\`

**HTTP Status Codes:**
- 200: Success (check success field)
- 400: Bad Request (email missing, validation failed)
- 401: Unauthorized (invalid token)
- 503: Service Unavailable (blockchain error)

**Important Notes:**
- Email verification via POST /email/verify-code is **required** before registration
- Wallet address is automatically extracted from JWT token
- Personal data hash is calculated server-side (privacy protection)
- Only blockchain registration is blocking - VC and Spring sync are async
- Profile image is optional but recommended for community features
- Duplicate registration is prevented (one wallet = one guardian)

**Use Cases:**
- Pet owner registration: Register to manage pets and participate in adoption
- Shelter registration: Register as ADMIN to post adoption listings
- Rescue organization: Manage rescued pets and adoption process
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'Guardian registered successfully on blockchain, background jobs queued',
    schema: {
      oneOf: [
        {
          description: 'With profile image',
          example: {
            success: true,
            authId: 123,
            txHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
            blockNumber: 12345,
            vcJobId: 'job-abc-123-def-456',
            imageMoveJobId: 'job-def-456-ghi-789',
            message: 'Guardian registered on blockchain. Profile image will be moved, then synced to Spring.'
          }
        },
        {
          description: 'Without profile image',
          example: {
            success: true,
            authId: 123,
            txHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
            blockNumber: 12345,
            vcJobId: 'job-abc-123-def-456',
            springJobId: 'job-ghi-789-jkl-012',
            message: 'Guardian registered on blockchain. Syncing data in background.'
          }
        }
      ]
    }
  })
  @ApiResponse({
    status: 200,
    description: 'Registration failed - email not verified, email missing, or already registered',
    schema: {
      oneOf: [
        {
          description: 'Email not verified',
          example: {
            success: false,
            error: '이메일 인증이 필요합니다! 먼저 인증해주세요!'
          }
        },
        {
          description: 'Email missing',
          example: {
            success: false,
            error: '이메일은 필수 항목입니다'
          }
        },
        {
          description: 'Already registered',
          example: {
            success: false,
            error: '이미 블록체인에 등록된 주소입니다. 중복 등록은 불가능합니다.',
            alreadyRegistered: true
          }
        }
      ]
    }
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or expired token'
  })
  async registerGuardian(
    @Req() req: Request,
    @Body() dto: CreateGuardianDto
  ) {
    const guardianAddress = req.user?.address;
    
    console.log(dto)

    // 1. VC Service에 Auth 확인 (이메일 인증 여부 확인)
    let authCheck;
    authCheck = await this.vcProxyService.checkAuth({
      walletAddress: guardianAddress
    });

    // checkAuth returns: { success: boolean, authId: number, message: string, error?: string }
    if (!authCheck || !authCheck.success) {
      return {
        success: false,
        error: '이메일 인증이 필요합니다! 먼저 인증해주세요!'
      };
    }
    
    // 2. 이메일 필수 검증
    if (!dto.email) {
      return {
        success: false,
        error: '이메일은 필수 항목입니다'
      };
    }

    try{
            // 3. 블록체인에 이미 등록되어 있는지 확인
    const isAlreadyRegistered = await this.guardianService.isGuardianRegistered(guardianAddress);
    if (isAlreadyRegistered) {
      return {
        success: false,
        error: '이미 블록체인에 등록된 주소입니다. 중복 등록은 불가능합니다.',
        alreadyRegistered: true
      };
    }

    // 4. 블록체인에 보호자 등록
    const personalDataHash = ethers.keccak256(
      ethers.toUtf8Bytes(JSON.stringify({
        email: dto.email,
        phone: dto.phone || '',
        name: dto.name || '',
        timestamp: Date.now()
      }))
    );

    // Production mode logging
    if (process.env.NODE_ENV === 'production' && dto.signedTx) {
      console.log(`Production mode: Received signedTx (${dto.signedTx?.length} chars): ${dto.signedTx?.substring(0, 50)}...`);
    }

    const txResult = await this.guardianService.registerGuardian(
      guardianAddress,
      personalDataHash,
      '0', // NCP 저장 안함
      dto.verificationMethod || 2, // 2: Email verified
      dto.signedTx
    );

    console.log(txResult)





    // 5. 트랜잭션 성공 후 즉시 응답 반환 + 백그라운드에서 VC/Spring 동기화
    if (txResult.success) {
      // 🚀 Queue VC sync (fire & forget)
      const vcJobId = await this.vcQueueService.queueGuardianSync(
        guardianAddress,
        dto.email,
        dto.phone,
        dto.name,
      );
      console.log(`📝 Queued VC sync - Job ID: ${vcJobId}`);

      // 🚀 Queue image move or Spring sync
      let imageMoveJobId = null;
      let springJobId = null;

      if (dto.profileUrl && dto.profileUrl.trim()) {
        // Profile image exists - queue image move (will trigger Spring sync after)
        // Extract filename from path (e.g., "dogcatpaw-backend/temp/file.jpg" -> "file.jpg")
        const fileName = dto.profileUrl.split('/').pop();

        imageMoveJobId = await this.springService.queueGuardianImageMove(
          guardianAddress,
          fileName,
          {
            email: dto.email,
            phone: dto.phone,
            name: dto.name,
            gender: dto.gender,
            old: dto.old,
            address: dto.address,
            nickname: dto.nickname,
          },
          dto.role === Role.USER ? 'USER' : 'ADMIN'
        );
        console.log(`📝 Queued guardian image move - Job ID: ${imageMoveJobId}`);

        // 즉시 프론트로 응답 반환
        return {
          success: true,
          authId: authCheck.authId,
          txHash: txResult.txHash,
          blockNumber: txResult.blockNumber,
          vcJobId,
          imageMoveJobId,
          message: 'Guardian registered on blockchain. Profile image will be moved, then synced to Spring.',
        };
      } else {
        // No profile image - directly queue Spring sync
        if(dto.role === Role.USER){
          springJobId = await this.springService.queueUserRegister(
            guardianAddress,
            {
              email: dto.email,
              phone: dto.phone,
              name: dto.name,
              gender: dto.gender,
              old: dto.old,
              address: dto.address,
              nickname: dto.nickname,
              profileUrl: dto.profileUrl
            }
          );
        } else {
          springJobId = await this.springService.queueAdminRegister(
            guardianAddress,
            {
              email: dto.email,
              phone: dto.phone,
              name: dto.name,
              gender: dto.gender,
              old: dto.old,
              address: dto.address,
              nickname: dto.nickname,
              profileUrl: dto.profileUrl
            }
          );
        }
        console.log(`📝 Queued Spring registration - Job ID: ${springJobId}`);

        // 즉시 프론트로 응답 반환
        return {
          success: true,
        authId: authCheck.authId,
        txHash: txResult.txHash,
        blockNumber: txResult.blockNumber,
        vcJobId,
        springJobId,
        message: 'Guardian registered on blockchain. Syncing data in background.',
      };
      }
    }

  

    return txResult;

      }catch{
      console.log(error)
    }
  }

  /**
   * Guardian Link Pet (프로덕션 모드용 - 사용자가 서명한 트랜잭션 처리)
   */
  @Post('link-pet/:petDID')
  @UseGuards(DIDAuthGuard)
  @ApiOperation({
    summary: 'Link Pet to Guardian - Execute Signed Transaction',
    description: `
**Execute signed transaction to link pet to guardian's profile on blockchain**

This endpoint submits the signed transaction from POST /api/guardian/prepare-link-pet/:petDID to the blockchain, linking the pet to the guardian's profile.

**Complete Link Pet Flow:**
\`\`\`
Step 1: POST /api/guardian/prepare-link-pet/:petDID - Get transaction data
Step 2: Client signs transaction with wallet private key
Step 3: This endpoint - Submit signed transaction → Blockchain execution
\`\`\`

**What This Endpoint Does:**
1. Validates guardian is authenticated (JWT token)
2. Validates pet DID parameter
3. Executes signed GuardianRegistry.linkPet() transaction on blockchain
4. Returns transaction hash and block number
5. Links pet to guardian's profile (guardian → pets mapping)

**Request Parameters:**
- \`:petDID\`: Pet DID to link (e.g., "did:ethr:besu:0xabcdef...")

**Request Body:**
\`\`\`javascript
{
  signedTx: "0xf86c808504a817c800825208941234567890123456789012345678901234567890880de0b6b3a76400008025a0..."
}
\`\`\`

**Complete Flow Example:**
\`\`\`javascript
// Step 1: Prepare transaction data
const prepareResponse = await fetch(\`/api/guardian/prepare-link-pet/\${petDID}\`, {
  method: 'POST',
  headers: { 'Authorization': 'Bearer ' + accessToken }
});
const { transactionData } = await prepareResponse.json();

// Step 2: Sign transaction
const wallet = new ethers.Wallet(privateKey, provider);
const signedTx = await wallet.signTransaction({
  to: transactionData.to,
  data: transactionData.data,
  gasLimit: ethers.toBeHex(3000000),
  gasPrice: ethers.toBeHex(0),
  value: 0,
  nonce: await provider.getTransactionCount(wallet.address),
  chainId: 1337
});

// Step 3: Submit signed transaction
const linkResponse = await fetch(\`/api/guardian/link-pet/\${petDID}\`, {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + accessToken,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ signedTx })
});

const result = await linkResponse.json();
console.log('Pet linked! TX Hash:', result.txHash);
console.log('Block Number:', result.blockNumber);
\`\`\`

**Response - Success:**
\`\`\`javascript
{
  success: true,
  txHash: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
  blockNumber: 12345,
  message: "Pet did:ethr:besu:0xabcdef... linked to guardian 0xe9ebc..."
}
\`\`\`

**Response - Error:**
\`\`\`javascript
{
  success: false,
  error: "Guardian not registered on blockchain"
}
\`\`\`

**Blockchain Smart Contract:**
\`\`\`solidity
// GuardianRegistry.sol
function linkPet(string memory _petDID) public {
  require(guardians[msg.sender].exists, "Guardian not registered");
  guardianToPets[msg.sender].push(_petDID);
  emit PetLinked(msg.sender, _petDID);
}
\`\`\`

**What Happens On-Chain:**
1. Validates guardian exists in GuardianRegistry
2. Adds pet DID to guardian's pet list (guardianToPets mapping)
3. Emits PetLinked event for indexing
4. Transaction is mined and confirmed

**Use Cases:**
- **After Pet Registration:** Link newly registered pet to guardian profile
- **After Pet Transfer:** New owner links received pet to their profile
- **Profile Management:** Guardian organizing their pet portfolio

**GuardianRegistry vs PetDIDRegistry:**
- **PetDIDRegistry:** Source of truth for pet ownership (controller field)
- **GuardianRegistry:** Auxiliary mapping for quick guardian → pets lookup
- **Limitation:** GuardianRegistry requires guardian signature (cannot be done in background job)
- **Recommendation:** Always verify ownership from PetDIDRegistry controller field

**Important Notes:**
- Guardian must be registered first (POST /api/guardian/register)
- Pet DID must exist on blockchain (POST /pet/register)
- Transaction execution blocks until confirmed on blockchain
- Pet can be linked to multiple guardians (not enforced on-chain)
- True ownership is determined by PetDIDRegistry.controller field
- This is a convenience feature for guardian profile management

**Error Cases:**
- Guardian not registered → Error message returned
- Pet DID not found → Transaction will fail
- Invalid signature → Transaction execution error
- Nonce conflict → Retryable error
- Insufficient gas → Transaction fails

**HTTP Status Codes:**
- 200: Success (check success field)
- 400: Bad Request (validation failed)
- 401: Unauthorized (invalid token)
- 503: Service Unavailable (blockchain error)

**Transaction Fees:**
- Gas price: 0 (private network)
- Gas limit: 3,000,000
- No ETH transfer (value: 0)
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'Pet linked successfully to guardian profile',
    schema: {
      example: {
        success: true,
        txHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        blockNumber: 12345,
        message: 'Pet did:ethr:besu:0xabcdef... linked to guardian 0xe9ebc691ccfb15cb4bf31af83c624b7020f0d2c0'
      }
    }
  })
  @ApiResponse({
    status: 200,
    description: 'Link failed - guardian not registered or transaction error',
    schema: {
      example: {
        success: false,
        error: 'Guardian not registered on blockchain'
      }
    }
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or expired token'
  })
  async linkPet(
    @Req() req: Request,
    @Param('petDID') petDID: string,
    @Body() body: { signedTx: string }
  ) {
    const guardianAddress = req.user?.address;

    try {
      const result = await this.guardianService.linkPet(
        guardianAddress,
        petDID,
        body.signedTx
      );

      return {
        success: true,
        ...result,
        message: `Pet ${petDID} linked to guardian ${guardianAddress}`
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Prepare Guardian Link Transaction Data (사용자가 서명할 트랜잭션 데이터 생성)
   */
  @Post('prepare-link-pet/:petDID')
  @UseGuards(DIDAuthGuard)
  @ApiOperation({
    summary: 'Prepare Guardian Link Pet Transaction - Generate Signing Data',
    description: `
**Prepare transaction data for linking a pet to guardian's profile**

This endpoint prepares the transaction data for GuardianRegistry.linkPet() function. The guardian must sign this transaction and submit it via POST /api/guardian/link-pet/:petDID.

**What This Endpoint Does:**
1. Validates guardian is authenticated (JWT token)
2. Prepares transaction data for GuardianRegistry.linkPet() function
3. Returns unsigned transaction data for guardian to sign
4. Provides instructions for next step

**Use Cases:**
- Guardian wants to link an existing pet to their profile
- Pet was registered but not linked to guardian's profile yet
- Guardian received pet transfer and wants to link it

**Request Parameters:**
- \`:petDID\`: Pet DID to link (e.g., "did:ethr:besu:0xabcdef...")

**Response:**
\`\`\`javascript
{
  success: true,
  transactionData: {
    to: "0x...",  // GuardianRegistry contract address
    data: "0x...",  // linkPet function call data
    from: "0x...",  // Guardian wallet address
    gasLimit: "3000000",
    gasPrice: "0",
    value: "0"
  },
  instruction: "Sign this transaction with your wallet and call POST /api/guardian/link-pet/:petDID with the signed transaction"
}
\`\`\`

**Next Steps:**
\`\`\`javascript
// 1. Get transaction data from this endpoint
const prepareResponse = await fetch(\`/api/guardian/prepare-link-pet/\${petDID}\`, {
  method: 'POST',
  headers: { 'Authorization': 'Bearer ' + accessToken }
});
const { transactionData } = await prepareResponse.json();

// 2. Sign the transaction
const wallet = new ethers.Wallet(privateKey);
const signedTx = await wallet.signTransaction({
  to: transactionData.to,
  data: transactionData.data,
  gasLimit: ethers.toBeHex(3000000),
  gasPrice: ethers.toBeHex(0),
  value: 0,
  nonce: await provider.getTransactionCount(wallet.address),
  chainId: 1337
});

// 3. Submit signed transaction
const linkResponse = await fetch(\`/api/guardian/link-pet/\${petDID}\`, {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + accessToken,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ signedTx })
});
\`\`\`

**Blockchain Smart Contract:**
\`\`\`solidity
// GuardianRegistry.sol
function linkPet(string memory _petDID) public {
  require(guardians[msg.sender].exists, "Guardian not registered");
  guardianToPets[msg.sender].push(_petDID);
  emit PetLinked(msg.sender, _petDID);
}
\`\`\`

**Important Notes:**
- This endpoint only prepares transaction data (no blockchain execution)
- Guardian must sign transaction client-side with their private key
- Signed transaction is submitted via POST /api/guardian/link-pet/:petDID
- Guardian must be registered on blockchain first (POST /api/guardian/register)
- Pet DID must exist on blockchain (POST /pet/register)

**Error Cases:**
- Invalid token → 401 Unauthorized
- Pet DID not found → 400 Bad Request
- Guardian not registered → 400 Bad Request
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'Transaction data prepared successfully',
    schema: {
      example: {
        success: true,
        transactionData: {
          to: '0x1234567890123456789012345678901234567890',
          data: '0xabcdef...',
          from: '0xe9ebc691ccfb15cb4bf31af83c624b7020f0d2c0',
          gasLimit: '3000000',
          gasPrice: '0',
          value: '0'
        },
        instruction: 'Sign this transaction with your wallet and call POST /api/guardian/link-pet/:petDID with the signed transaction'
      }
    }
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or expired token'
  })
  async prepareLinkPet(
    @Req() req: Request,
    @Param('petDID') petDID: string
  ) {
    const guardianAddress = req.user?.address;

    const txData = await this.guardianService.prepareLinkPetTx(
      guardianAddress,
      petDID
    );

    return {
      success: true,
      transactionData: txData,
      instruction: 'Sign this transaction with your wallet and call POST /api/guardian/link-pet/:petDID with the signed transaction'
    };
  }
}
