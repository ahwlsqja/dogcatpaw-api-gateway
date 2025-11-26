# 🔐 멍냥포 VC Server

멍냥포 플랫폼의 **Verifiable Credential(VC)** 관리 서버입니다. 보호자 인증 상태와 펫 VC를 저장/관리합니다.

## 📋 목차

- [개요](#개요)
- [아키텍처](#아키텍처)
- [gRPC API](#grpc-api)
- [데이터 모델](#데이터-모델)
- [설치 및 실행](#설치-및-실행)
- [환경 변수](#환경-변수)

---

## 개요

VC Server는 W3C DID 표준을 따르는 Verifiable Credential을 저장하고 관리하는 마이크로서비스입니다.

### 핵심 기능

- **보호자 인증 관리**: 지갑 주소 기반 인증 등록 및 상태 관리
- **VC 저장/조회**: 펫 DID에 연결된 Verifiable Credential 저장
- **보호자/보호소 정보 관리**: 이메일, 전화번호, 온체인 등록 상태 관리
- **VC 무효화**: 소유권 이전 시 기존 VC 무효화

### 기술 스택

- **Framework**: NestJS
- **Language**: TypeScript
- **Communication**: gRPC (Protocol Buffers)
- **Database**: PostgreSQL
- **Container**: Docker
- **Orchestration**: Kubernetes

---

## 아키텍처

```
┌─────────────────────────────────────────────────────────────────┐
│                        API Gateway                               │
│                         (NestJS)                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ gRPC (:50055)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        VC Server                                 │
│                         (NestJS)                                 │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │  AuthModule  │  │   VCModule   │  │GuardianModule│           │
│  └──────────────┘  └──────────────┘  └──────────────┘           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌───────────────────┐
                    │    PostgreSQL     │
                    │                   │
                    │  - auth           │
                    │  - guardians      │
                    │  - shelters       │
                    │  - vcs            │
                    └───────────────────┘
```

---

## gRPC API

### 서비스 정의

```protobuf
service VCService {
  rpc RegisterAuth (RegisterAuthRequest) returns (RegisterAuthResponse);
  rpc CheckAuth (CheckAuthRequest) returns (CheckAuthResponse);
  rpc GetGuardianInfo (GetGuardianInfoRequest) returns (GetGuardianInfoResponse);
  rpc UpdateGuardianInfo (UpdateGuardianRequest) returns (UpdateGuardianResponse);
  rpc UpdateShelterInfo (UpdateShelterRequest) returns (UpdateShelterResponse);
  rpc StoreVC (StoreVCRequest) returns (StoreVCResponse);
  rpc GetVC (GetVCRequest) returns (GetVCResponse);
  rpc GetVCsByWallet (GetVCsByWalletRequest) returns (GetVCsByWalletResponse);
  rpc InvalidateVC (InvalidateVCRequest) returns (InvalidateVCResponse);
  rpc HealthCheck (HealthCheckRequest) returns (HealthCheckResponse);
}
```

---

### 인증 관리 API

#### RegisterAuth - 지갑 인증 등록

새로운 지갑 주소를 인증 시스템에 등록합니다.

**Request:**
```protobuf
message RegisterAuthRequest {
  string walletAddress = 1;  // 지갑 주소 (0x...)
}
```

**Response:**
```protobuf
message RegisterAuthResponse {
  bool success = 1;
  RegisterAuthData data = 2;      // { authId: int32 }
  string errorCode = 3;
  string errorMessage = 4;
  bool retryable = 5;
  string timestamp = 6;
  string message = 7;
}
```

#### CheckAuth - 인증 상태 확인

지갑 주소의 인증 등록 여부를 확인합니다.

**Request:**
```protobuf
message CheckAuthRequest {
  string walletAddress = 1;
}
```

**Response:**
```protobuf
message CheckAuthResponse {
  bool success = 1;
  CheckAuthData data = 2;         // { authId: int32 }
  string errorCode = 3;
  string errorMessage = 4;
  bool retryable = 5;
  string timestamp = 6;
  string message = 7;
}
```

---

### 보호자/보호소 관리 API

#### GetGuardianInfo - 보호자 정보 조회

**Request:**
```protobuf
message GetGuardianInfoRequest {
  string walletAddress = 1;
}
```

**Response:**
```protobuf
message GetGuardianInfoResponse {
  bool success = 1;
  GuardianInfoData data = 2;
  string errorCode = 3;
  string errorMessage = 4;
  bool retryable = 5;
  string timestamp = 6;
}

message GuardianInfoData {
  int32 guardianId = 1;
  string email = 2;
  string phone = 3;
  string name = 4;
  bool isEmailVerified = 5;       // 이메일 인증 여부
  bool isOnChainRegistered = 6;   // 온체인 등록 여부
}
```

#### UpdateGuardianInfo - 보호자 정보 업데이트

**Request:**
```protobuf
message UpdateGuardianRequest {
  string walletAddress = 1;
  string email = 2;
  string phone = 3;
  string name = 4;
  bool isEmailVerified = 5;
  bool isOnChainRegistered = 6;
}
```

**Response:**
```protobuf
message UpdateGuardianResponse {
  bool success = 1;
  UpdateGuardianData data = 2;    // { guardianId: int32 }
  string errorCode = 3;
  string errorMessage = 4;
  bool retryable = 5;
  string timestamp = 6;
  string message = 7;
}
```

#### UpdateShelterInfo - 보호소 정보 업데이트

**Request:**
```protobuf
message UpdateShelterRequest {
  string walletAddress = 1;
  string name = 2;                // 보호소 이름
  string location = 3;            // 위치
  string licenseNumber = 4;       // 사업자 등록번호
  int32 capacity = 5;             // 수용 가능 두수
}
```

**Response:**
```protobuf
message UpdateShelterResponse {
  bool success = 1;
  UpdateShelterData data = 2;     // { shelterId: int32 }
  string errorCode = 3;
  string errorMessage = 4;
  bool retryable = 5;
  string timestamp = 6;
  string message = 7;
}
```

---

### VC 관리 API

#### StoreVC - VC 저장

새로운 Verifiable Credential을 저장합니다.

**Request:**
```protobuf
message StoreVCRequest {
  string guardianAddress = 1;     // 보호자 지갑 주소
  string petDID = 2;              // 펫 DID (did:ethr:besu:0x...)
  string vcJwt = 3;               // VC JWT 토큰
  string metadata = 4;            // 메타데이터 (JSON 문자열)
}
```

**Response:**
```protobuf
message StoreVCResponse {
  bool success = 1;
  StoreVCData data = 2;           // { vcId: int32 }
  string errorCode = 3;
  string errorMessage = 4;
  bool retryable = 5;
  string timestamp = 6;
  string message = 7;
}
```

#### GetVC - VC 조회

특정 펫 DID와 보호자에 대한 VC를 조회합니다.

**Request:**
```protobuf
message GetVCRequest {
  string petDID = 1;
  string guardianAddress = 2;
}
```

**Response:**
```protobuf
message GetVCResponse {
  bool success = 1;
  GetVCData data = 2;
  string errorCode = 3;
  string errorMessage = 4;
  bool retryable = 5;
  string timestamp = 6;
}

message GetVCData {
  string vcJwt = 1;               // VC JWT 토큰
  string metadata = 2;            // 메타데이터
  string createdAt = 3;           // 생성 시간
}
```

#### GetVCsByWallet - 지갑별 VC 목록 조회

특정 지갑 주소가 보유한 모든 VC를 조회합니다.

**Request:**
```protobuf
message GetVCsByWalletRequest {
  string walletAddress = 1;
}
```

**Response:**
```protobuf
message GetVCsByWalletResponse {
  bool success = 1;
  GetVCsByWalletData data = 2;
  string errorCode = 3;
  string errorMessage = 4;
  bool retryable = 5;
  string timestamp = 6;
}

message GetVCsByWalletData {
  repeated VC vcs = 1;
}

message VC {
  string petDID = 1;
  string vcJwt = 2;
  string vcType = 3;
  string createdAt = 4;
}
```

#### InvalidateVC - VC 무효화

소유권 이전 등의 이유로 기존 VC를 무효화합니다.

**Request:**
```protobuf
message InvalidateVCRequest {
  string petDID = 1;
  string guardianAddress = 2;
  string reason = 3;              // 무효화 사유
}
```

**Response:**
```protobuf
message InvalidateVCResponse {
  bool success = 1;
  string errorCode = 2;
  string errorMessage = 3;
  bool retryable = 4;
  string timestamp = 5;
  string message = 6;
}
```

---

### 헬스체크 API

#### HealthCheck - 서비스 상태 확인

**Request:**
```protobuf
message HealthCheckRequest {
  string service = 1;
}
```

**Response:**
```protobuf
message HealthCheckResponse {
  enum ServingStatus {
    UNKNOWN = 0;
    SERVING = 1;
    NOT_SERVING = 2;
    SERVICE_UNKNOWN = 3;
  }
  ServingStatus status = 1;
  string message = 2;
  string timestamp = 3;
  string version = 4;
}
```

---

## 데이터 모델

### Auth (인증)

| 컬럼 | 타입 | 설명 |
|-----|------|------|
| id | SERIAL | Primary Key |
| wallet_address | VARCHAR(42) | 지갑 주소 (Unique) |
| created_at | TIMESTAMP | 생성 시간 |
| updated_at | TIMESTAMP | 수정 시간 |

### Guardians (보호자)

| 컬럼 | 타입 | 설명 |
|-----|------|------|
| id | SERIAL | Primary Key |
| wallet_address | VARCHAR(42) | 지갑 주소 (Unique) |
| email | VARCHAR(255) | 이메일 |
| phone | VARCHAR(20) | 전화번호 |
| name | VARCHAR(100) | 이름 |
| is_email_verified | BOOLEAN | 이메일 인증 여부 |
| is_on_chain_registered | BOOLEAN | 온체인 등록 여부 |
| created_at | TIMESTAMP | 생성 시간 |
| updated_at | TIMESTAMP | 수정 시간 |

### Shelters (보호소)

| 컬럼 | 타입 | 설명 |
|-----|------|------|
| id | SERIAL | Primary Key |
| wallet_address | VARCHAR(42) | 지갑 주소 (Unique) |
| name | VARCHAR(255) | 보호소 이름 |
| location | VARCHAR(500) | 위치 |
| license_number | VARCHAR(50) | 사업자 등록번호 |
| capacity | INTEGER | 수용 가능 두수 |
| created_at | TIMESTAMP | 생성 시간 |
| updated_at | TIMESTAMP | 수정 시간 |

### VCs (Verifiable Credentials)

| 컬럼 | 타입 | 설명 |
|-----|------|------|
| id | SERIAL | Primary Key |
| guardian_address | VARCHAR(42) | 보호자 지갑 주소 |
| pet_did | VARCHAR(100) | 펫 DID |
| vc_jwt | TEXT | VC JWT 토큰 |
| vc_type | VARCHAR(50) | VC 타입 |
| metadata | JSONB | 메타데이터 |
| is_valid | BOOLEAN | 유효 여부 |
| invalidated_at | TIMESTAMP | 무효화 시간 |
| invalidation_reason | VARCHAR(255) | 무효화 사유 |
| created_at | TIMESTAMP | 생성 시간 |
| updated_at | TIMESTAMP | 수정 시간 |

**인덱스:**
- `idx_vcs_guardian_address` ON (guardian_address)
- `idx_vcs_pet_did` ON (pet_did)
- `idx_vcs_guardian_pet` ON (guardian_address, pet_did)

---

## 설치 및 실행

### 사전 요구사항

- Node.js 20+
- pnpm
- PostgreSQL 15+

### 설치

```bash
pnpm install
```

### 개발 모드 실행

```bash
pnpm run start:dev
```

### 프로덕션 빌드 및 실행

```bash
pnpm run build
pnpm run start:prod
```

### Docker

```bash
docker build -t vc-server .
docker run -p 50055:50055 vc-server
```

### Kubernetes

```bash
kubectl apply -f k8s/
```

---

## 환경 변수

```env
# Server
GRPC_PORT=50055

# Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=your-password
DB_DATABASE=vc_server

# Logging
LOG_LEVEL=info
```

---

## 에러 코드

| 코드 | 설명 |
|-----|------|
| VC_4001 | 지갑 주소 미존재 |
| VC_4002 | 이미 등록된 지갑 |
| VC_4003 | 펫 DID 미존재 |
| VC_4004 | VC 미존재 |
| VC_4005 | 이미 무효화된 VC |
| VC_5001 | 데이터베이스 오류 |
| VC_5002 | 내부 서버 오류 |

---

## 프로젝트 구조

```
src/
├── auth/                  # 인증 모듈
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   └── entities/
├── guardian/              # 보호자 모듈
│   ├── guardian.controller.ts
│   ├── guardian.service.ts
│   └── entities/
├── shelter/               # 보호소 모듈
│   ├── shelter.controller.ts
│   ├── shelter.service.ts
│   └── entities/
├── vc/                    # VC 모듈
│   ├── vc.controller.ts
│   ├── vc.service.ts
│   └── entities/
├── common/                # 공통 유틸리티
├── proto/                 # gRPC 프로토콜 정의
│   └── vc.proto
├── app.module.ts
└── main.ts

k8s/                       # Kubernetes 배포 설정
```

---

## API Gateway 연동

API Gateway에서 VC Server로 gRPC 통신:

```typescript
// API Gateway의 VcProxyService
@Injectable()
export class VcProxyService implements OnModuleInit {
  private vcService: VCServiceClient;

  constructor(@Inject('VC_GRPC_SERVICE') private client: ClientGrpc) {}

  onModuleInit() {
    this.vcService = this.client.getService<VCServiceClient>('VCService');
  }

  async storeVC(request: StoreVCRequest): Promise<StoreVCResponse> {
    return firstValueFrom(this.vcService.StoreVC(request));
  }

  async getVC(petDID: string, guardianAddress: string): Promise<GetVCResponse> {
    return firstValueFrom(this.vcService.GetVC({ petDID, guardianAddress }));
  }
}
```

---

## 라이선스

MIT License
