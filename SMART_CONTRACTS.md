# 🔗 멍냥포 Smart Contracts

멍냥포 플랫폼의 핵심 스마트 컨트랙트 문서입니다. Hyperledger Besu 프라이빗 네트워크에 배포됩니다.

## 📋 목차

- [개요](#개요)
- [GuardianRegistry](#guardianregistry)
- [PetDIDRegistry](#petdidregistry)
- [컨트랙트 상호작용](#컨트랙트-상호작용)
- [보안 고려사항](#보안-고려사항)

---

## 개요

멍냥포는 두 개의 핵심 스마트 컨트랙트를 사용합니다:

| 컨트랙트 | 역할 | 주요 기능 |
|---------|------|----------|
| **GuardianRegistry** | 보호자 등록 및 관리 | SMS/Email 인증, 펫 연결 |
| **PetDIDRegistry** | 펫 DID 등록 및 관리 | 비문 기반 DID, VC 발급, 소유권 이전 |

### 의존성

- OpenZeppelin Contracts v5.0+
  - `AccessControl`: 역할 기반 접근 제어
  - `ReentrancyGuard`: 재진입 공격 방지
  - `ECDSA`: 서명 검증
  - `MessageHashUtils`: 메시지 해시 유틸리티

---

## GuardianRegistry

보호자(Guardian) 등록 및 SMS/Email 인증을 관리하는 컨트랙트입니다.

### 역할 (Roles)

| 역할 | 설명 |
|-----|------|
| `DEFAULT_ADMIN_ROLE` | 컨트랙트 관리자, 역할 부여/취소 |
| `VERIFIER_ROLE` | SMS/Email 인증 수행 권한 |

### 데이터 구조

#### VerificationMethod (Enum)

```solidity
enum VerificationMethod {
    NONE,           // 0 - 미인증
    SMS,            // 1 - SMS 인증
    EMAIL,          // 2 - Email 인증
    SMS_AND_EMAIL   // 3 - SMS + Email 인증
}
```

#### GuardianProfile (Struct)

```solidity
struct GuardianProfile {
    address guardianAddress;            // 보호자 지갑 주소
    bytes32 personalDataHash;           // 암호화된 개인정보의 keccak256 해시
    string ncpStorageURI;               // NCP Object Storage URI
    VerificationMethod verificationMethod; // 인증 방식
    uint8 verificationLevel;            // 신뢰도 점수 (0-100)
    uint48 registeredAt;                // 등록 시간
    uint48 lastUpdated;                 // 마지막 업데이트 시간
    bool isActive;                      // 활성화 상태
}
```

#### VerificationProof (Struct)

```solidity
struct VerificationProof {
    bool smsVerified;                   // SMS 인증 여부
    bool emailVerified;                 // Email 인증 여부
    uint48 smsVerifiedAt;               // SMS 인증 시간
    uint48 emailVerifiedAt;             // Email 인증 시간
    address verifier;                   // 인증 수행자
}
```

### 인증 레벨 계산

| VerificationMethod | Level |
|-------------------|-------|
| NONE | 0 |
| SMS | 60 |
| EMAIL | 70 |
| SMS_AND_EMAIL | 100 |

### 주요 함수

#### 보호자 등록

```solidity
function registerGuardian(
    bytes32 _personalDataHash,      // 개인정보 해시
    string calldata _ncpStorageURI, // NCP 저장소 URI
    VerificationMethod _verificationMethod // 인증 방식
) external nonReentrant
```

**이벤트**: `GuardianRegistered(address guardianAddress, VerificationMethod method, uint48 timestamp)`

#### 보호자 인증 (VERIFIER_ROLE 전용)

```solidity
function verifyGuardian(
    address _guardianAddress,   // 인증할 보호자 주소
    bool _smsVerified,          // SMS 인증 여부
    bool _emailVerified         // Email 인증 여부
) external onlyRole(VERIFIER_ROLE)
```

**이벤트**: `GuardianVerified(address guardianAddress, VerificationMethod method, address verifier)`

#### 보호자 정보 업데이트

```solidity
function updateGuardianData(
    bytes32 _newPersonalDataHash,    // 새 개인정보 해시
    string calldata _newNcpStorageURI // 새 NCP URI
) external
```

**이벤트**: `GuardianUpdated(address guardianAddress, bytes32 newDataHash, uint48 timestamp)`

#### 펫 연결/해제

```solidity
function linkPet(string calldata _petDID) external
function unlinkPet(string calldata _petDID) external
```

**이벤트**: `PetLinked(address guardianAddress, string petDID)`

#### 보호자 비활성화

```solidity
function deactivateGuardian() external
function forceDeactivateGuardian(address _guardianAddress) external onlyRole(DEFAULT_ADMIN_ROLE)
```

**이벤트**: `GuardianDeactivated(address guardianAddress, uint48 timestamp)`

### 조회 함수

```solidity
// 보호자 프로필 조회
function getGuardianProfile(address _guardianAddress) external view returns (GuardianProfile memory)

// 인증 증명 조회
function getVerificationProof(address _guardianAddress) external view returns (VerificationProof memory)

// 인증 여부 확인
function isVerified(address _guardianAddress) external view returns (bool)

// 활성화 여부 확인
function isActive(address _guardianAddress) external view returns (bool)

// 보호자의 펫 목록 조회
function getGuardianPets(address _guardianAddress) external view returns (string[] memory)

// 전체 보호자 수
function getTotalGuardians() external view returns (uint256)

// 전체 보호자 주소 목록
function getAllGuardians() external view returns (address[] memory)

// 인증 레벨 조회
function getVerificationLevel(address _guardianAddress) external view returns (uint8)
```

### 에러 코드

| Error | 설명 |
|-------|------|
| `AlreadyRegistered()` | 이미 등록된 보호자 |
| `NotRegistered()` | 등록되지 않은 보호자 |
| `NotVerified()` | 인증되지 않은 보호자 |
| `Unauthorized()` | 권한 없음 |
| `InvalidVerification()` | 유효하지 않은 인증 |
| `AlreadyDeactivated()` | 이미 비활성화됨 |

---

## PetDIDRegistry

펫의 분산 신원(DID)을 관리하는 컨트랙트입니다. 비문 기반 생체 인증과 Verifiable Credential을 지원합니다.

### 역할 (Roles)

| 역할 | 설명 |
|-----|------|
| `DEFAULT_ADMIN_ROLE` | 컨트랙트 관리자 |
| `MODEL_SERVER_ROLE` | ML 서버, 비문 검증 서명 권한 |
| `GUARDIAN_ROLE` | 보호자 역할 |
| `SHELTER_ROLE` | 보호소 역할 |

### 데이터 구조

#### DIDDocument (Struct)

```solidity
struct DIDDocument {
    address biometricOwner;     // 비문에서 파생된 주소 (펫의 고유 식별자)
    address controller;         // 현재 관리자 (보호자)
    uint48 created;             // 생성 시간
    uint48 updated;             // 업데이트 시간
    bool exists;                // 존재 여부
}
```

#### BiometricData (Struct)

```solidity
struct BiometricData {
    bytes32 featureVectorHash;      // 특징 벡터의 keccak256 해시
    string modelServerReference;    // ML 모델 서버 참조
    uint8 sampleCount;              // 샘플 수 (1-2)
    uint48 registrationTime;        // 등록 시간
}
```

#### VerificationRecord (Struct)

```solidity
struct VerificationRecord {
    address verifier;       // 검증자
    uint48 timestamp;       // 검증 시간
    uint8 similarity;       // 유사도 (85-100)
    uint8 purpose;          // 검증 목적
}
```

#### CredentialMetadata (Struct)

```solidity
struct CredentialMetadata {
    bytes32 credentialHash;     // VC 해시
    address issuer;             // 발급자
    address subject;            // 대상자
    uint48 issuanceDate;        // 발급일
    uint48 expirationDate;      // 만료일
    bool revoked;               // 폐기 여부
}
```

### Pet DID 형식

```
did:ethr:besu:0x{biometricAddress}

예: did:ethr:besu:0x1234567890abcdef1234567890abcdef12345678
```

- `did:ethr:besu:` - 접두사 (16자)
- `0x{address}` - 비문에서 파생된 40자리 16진수 주소

### DID 생성 과정

```
1. 코 이미지 촬영
2. ML 서버에서 특징 벡터 추출
3. 특징 벡터를 keccak256 해시
4. 해시에서 주소 파생 → biometricOwner
5. DID 문자열 생성: did:ethr:besu:0x{biometricOwner}
```

### 주요 함수

#### 펫 DID 등록

```solidity
function registerPetDID(
    string calldata _petDID,              // 펫 DID 문자열
    bytes32 _featureVectorHash,           // 특징 벡터 해시
    string calldata _modelServerReference, // ML 서버 참조
    uint8 _sampleCount,                   // 샘플 수 (1-2)
    string calldata _species,             // 종 (DOG, CAT)
    string calldata _metadataURI          // 메타데이터 URI
) external nonReentrant
```

**이벤트**: `DIDCreated(string petDID, bytes32 identity, address biometricOwner, address controller)`

#### 비문 검증

```solidity
function verifyBiometric(
    string calldata _petDID,              // 검증할 펫 DID
    uint8 _similarity,                    // 유사도 (85-100)
    uint8 _purpose,                       // 검증 목적
    bytes calldata _modelServerSignature  // ML 서버 서명
) external returns (bool)
```

**이벤트**: `BiometricVerified(string petDID, address verifier, uint8 similarity, uint8 purpose)`

**검증 과정**:
1. ML 서버가 비문 이미지 비교 후 유사도 계산
2. 유사도와 함께 메시지에 서명
3. 컨트랙트에서 서명 검증 (MODEL_SERVER_ROLE 확인)
4. 검증 기록 저장

#### Verifiable Credential 등록

```solidity
function registerCredential(
    bytes32 _credentialHash,        // VC 해시
    string calldata _credentialType, // VC 타입
    address _subject,               // 대상자
    uint48 _expirationDate          // 만료일
) external
```

**이벤트**: `CredentialIssued(bytes32 credentialHash, string credentialType, address issuer, address subject)`

#### Verifiable Credential 폐기

```solidity
function revokeCredential(bytes32 _credentialHash) external
```

**이벤트**: `CredentialRevoked(bytes32 credentialHash, address revoker)`

#### 컨트롤러(보호자) 변경

```solidity
function changeController(
    string calldata _petDID,    // 펫 DID
    address _newController      // 새 보호자
) external
```

**이벤트**: `ControllerChanged(string petDID, address oldController, address newController)`

**제한사항**: 현재 컨트롤러만 호출 가능

#### 긴급 접근 로그

```solidity
function logEmergencyAccess(
    string calldata _petDID,    // 펫 DID
    string calldata _location   // 위치 정보
) external
```

**이벤트**: `EmergencyAccessed(string petDID, address accessor, string location)`

### 조회 함수

```solidity
// DID 문서 조회
function getDIDDocument(string calldata _petDID) external view
    returns (address biometricOwner, address controller, uint48 created, uint48 updated, bool exists)

// 비문 데이터 조회
function getBiometricData(string calldata _petDID) external view
    returns (bytes32 featureVectorHash, string memory modelServerReference, uint8 sampleCount, uint48 registrationTime)

// 검증 이력 조회
function getVerificationHistory(string calldata _petDID) external view
    returns (VerificationRecord[] memory)

// VC 유효성 확인
function isCredentialValid(bytes32 _credentialHash) external view returns (bool)

// 보호자 권한 확인
function isAuthorizedGuardian(string calldata _petDID, address _guardian) external view returns (bool)

// 보호자의 펫 목록
function getPetsByController(address _controller) external view returns (string[] memory)

// 전체 펫 수
function getTotalPets() external view returns (uint256)

// DID ↔ Identity 변환
function getIdentityFromDID(string calldata _petDID) external view returns (bytes32)
function getDIDFromIdentity(bytes32 _identity) external view returns (string memory)
```

### 에러 코드

| Error | 설명 |
|-------|------|
| `InvalidDIDFormat()` | 유효하지 않은 DID 형식 |
| `DIDAlreadyExists()` | 이미 존재하는 DID |
| `DIDNotFound()` | 존재하지 않는 DID |
| `Unauthorized()` | 권한 없음 |
| `InvalidSimilarity()` | 유효하지 않은 유사도 (85-100 범위 외) |
| `InvalidServerSignature()` | 유효하지 않은 서버 서명 |
| `CredentialAlreadyExists()` | 이미 존재하는 VC |
| `CredentialNotFound()` | 존재하지 않는 VC |
| `CredentialAlreadyRevoked()` | 이미 폐기된 VC |
| `InvalidHexCharacter()` | 유효하지 않은 16진수 문자 |

---

## 컨트랙트 상호작용

### 전체 플로우

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         보호자 등록 및 펫 등록 플로우                      │
└─────────────────────────────────────────────────────────────────────────┘

1. 보호자 등록
   User → GuardianRegistry.registerGuardian()
         → GuardianRegistered 이벤트

2. 보호자 인증 (백엔드에서 SMS/Email 인증 후)
   Verifier → GuardianRegistry.verifyGuardian()
            → GuardianVerified 이벤트

3. 펫 DID 등록
   Guardian → PetDIDRegistry.registerPetDID()
            → DIDCreated 이벤트

4. 펫-보호자 연결
   Guardian → GuardianRegistry.linkPet()
            → PetLinked 이벤트

┌─────────────────────────────────────────────────────────────────────────┐
│                         비문 검증 및 VC 발급 플로우                       │
└─────────────────────────────────────────────────────────────────────────┘

1. 비문 이미지 제출
   User → ML Server → 특징 벡터 추출 → 유사도 계산

2. 비문 검증 (ML 서버 서명 필요)
   Guardian → PetDIDRegistry.verifyBiometric()
            → BiometricVerified 이벤트

3. VC 발급
   Issuer → PetDIDRegistry.registerCredential()
          → CredentialIssued 이벤트

┌─────────────────────────────────────────────────────────────────────────┐
│                         소유권 이전 플로우                                │
└─────────────────────────────────────────────────────────────────────────┘

1. 기존 보호자가 이전 요청
   OldGuardian → PetDIDRegistry.changeController(newGuardian)
               → ControllerChanged 이벤트

2. 기존 보호자 펫 연결 해제
   OldGuardian → GuardianRegistry.unlinkPet()

3. 새 보호자 펫 연결
   NewGuardian → GuardianRegistry.linkPet()
               → PetLinked 이벤트
```

### 역할 관리

```solidity
// GuardianRegistry
grantVerifierRole(address _verifier)    // VERIFIER_ROLE 부여
revokeVerifierRole(address _verifier)   // VERIFIER_ROLE 취소

// PetDIDRegistry
grantModelServerRole(address _server)   // MODEL_SERVER_ROLE 부여
grantGuardianRole(address _guardian)    // GUARDIAN_ROLE 부여
grantShelterRole(address _shelter)      // SHELTER_ROLE 부여
```

---

## 보안 고려사항

### 1. 재진입 공격 방지

모든 상태 변경 함수에 `nonReentrant` modifier 적용:

```solidity
function registerGuardian(...) external nonReentrant { ... }
function registerPetDID(...) external nonReentrant { ... }
```

### 2. 역할 기반 접근 제어

OpenZeppelin의 `AccessControl` 사용:

```solidity
function verifyGuardian(...) external onlyRole(VERIFIER_ROLE) { ... }
function verifyBiometric(...) external {
    // MODEL_SERVER_ROLE 서명 검증
    if (!hasRole(MODEL_SERVER_ROLE, signer)) revert InvalidServerSignature();
}
```

### 3. 서명 검증

ML 서버의 비문 검증 결과에 대한 서명 검증:

```solidity
bytes32 messageHash = keccak256(abi.encodePacked(_petDID, _similarity, _purpose, block.timestamp));
address signer = messageHash.toEthSignedMessageHash().recover(_modelServerSignature);
if (!hasRole(MODEL_SERVER_ROLE, signer)) revert InvalidServerSignature();
```

### 4. 최소 데이터 온체인 저장

민감한 개인정보는 NCP에 암호화 저장, 온체인에는 해시만 저장:

```solidity
struct GuardianProfile {
    bytes32 personalDataHash;   // 해시만 저장
    string ncpStorageURI;       // 암호화된 데이터 참조
}
```

### 5. 가스 최적화

- `uint48` 사용으로 타임스탬프 저장 최적화
- `unchecked` 블록으로 오버플로우 체크 생략 (안전한 경우)
- Storage 접근 최소화

```solidity
unchecked { ++_totalGuardians; }
unchecked { ++totalPets; }
```

---

## 배포 정보

### 네트워크

- **Network**: Hyperledger Besu (Private)
- **Consensus**: IBFT 2.0
- **Chain ID**: (프로젝트 설정에 따름)

### 환경 변수

```env
GUARDIAN_REGISTRY_ADDRESS=0x...
PET_DID_REGISTRY_ADDRESS=0x...
RPC_URL=https://your-besu-rpc-url
```

### ABI 파일 위치

```
src/abis/
├── GuardianRegistry.abi.json
├── PetDIDRegistry.abi.json
└── index.ts
```

---

## 라이선스

MIT License
