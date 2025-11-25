# 🐾 멍냥포 API Gateway

멍냥포(DogCatPaw) 플랫폼의 **단일 진입점(Single Entry Point)** 역할을 하는 API Gateway입니다.

펫의 비문(Nose Print)을 활용한 **DID(Decentralized Identifier)** 기반 신원 관리 시스템으로, **Hyperledger Besu** 블록체인을 신뢰의 원천으로 사용합니다.

## 📋 목차

- [프로젝트 개요](#프로젝트-개요)
- [핵심 개념](#핵심-개념)
- [아키텍처](#아키텍처)
- [마이크로서비스 통신 구조](#마이크로서비스-통신-구조)
- [인증 플로우](#인증-플로우)
- [데이터 동기화 전략](#데이터-동기화-전략)
- [기술 스택](#기술-스택)
- [설치 및 실행](#설치-및-실행)
- [API 엔드포인트](#api-엔드포인트)
- [환경 변수](#환경-변수)

---

## 프로젝트 개요

멍냥포는 반려동물의 **비문(코 무늬)**을 생체 인식 정보로 활용하여 **분산 신원(DID)**을 발급하고, 이를 통해 입양, 보호권 이전 등의 이력을 블록체인에 기록하는 플랫폼입니다.

### 핵심 기능

- **비문 기반 신원 인증**: ML 서버를 통해 펫의 코 이미지에서 특징 벡터를 추출하고, 이를 기반으로 고유한 Pet DID를 생성
- **VC/VP 기반 인증**: W3C DID 표준을 따르는 Verifiable Credential(VC)과 Verifiable Presentation(VP) 발급
- **블록체인 기반 신뢰**: Hyperledger Besu 네트워크에 펫 등록, 보호자 연결, 이전 이력 기록
- **대리 보호자 시스템**: 펫의 컨트롤러(보호자)가 지갑 서명을 통해 VC/VP 발급

---

## 핵심 개념

### Pet DID 생성 과정

```
코 이미지 → ML 서버 → 특징 벡터 추출 → keccak256(vector) → Pet DID
```

### VP와 JWT 세션

- **1 VP = 1 JWT 세션**: 하나의 Verifiable Presentation이 하나의 JWT 세션으로 취급됩니다
- 보호자가 지갑으로 VP에 서명하면 플랫폼 로그인이 완료됩니다

### 신뢰의 원천

```
Hyperledger Besu (블록체인)
        ↓
    Smart Contracts
    - PetDIDRegistry
    - GuardianRegistry
    - ShelterRegistry
        ↓
    On-chain 상태가 모든 서비스의 진실의 원천
```

---

## 아키텍처

```
┌─────────────────────────────────────────────────────────────────┐
│                        클라이언트 (Web/Mobile)                    │
└─────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                     API Gateway (NestJS)                         │
│                                                                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│  │   Auth   │ │   Pet    │ │ Guardian │ │   Chat   │            │
│  │  Module  │ │  Module  │ │  Module  │ │  Module  │            │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘            │
│                                                                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│  │    VC    │ │  Faucet  │ │ Indexer  │ │  Spring  │            │
│  │  Module  │ │  Module  │ │  Module  │ │  Proxy   │            │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘            │
│                                                                  │
│  ┌─────────────────┐  ┌─────────────────┐                       │
│  │  NoseEmbedding  │  │   Blockchain    │                       │
│  │     Module      │  │     Module      │                       │
│  └─────────────────┘  └─────────────────┘                       │
└─────────────────────────────────────────────────────────────────┘
          │              │              │              │
    ┌─────┴─────┐  ┌─────┴─────┐  ┌─────┴─────┐  ┌─────┴─────┐
    │   gRPC    │  │   gRPC    │  │   gRPC    │  │   HTTP    │
    └─────┬─────┘  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘
          │              │              │              │
          ▼              ▼              ▼              ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│  VC Server   │ │  ML Server   │ │   Indexer    │ │    Spring    │
│   (NestJS)   │ │  (FastAPI)   │ │     (Go)     │ │    Server    │
│              │ │              │ │              │ │              │
│ - VC 저장/발급│ │ - 특징벡터추출│ │ - 이벤트 인덱싱│ │ - 메인 CRUD   │
│ - 인증 관리   │ │ - 유사도 비교 │ │ - 이전이력저장│ │ - DB 관리     │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘
        │
        ▼
┌──────────────┐
│Faucet Server │  (gRPC)
│   (NestJS)   │
│              │
│ - 테스트토큰  │
│   지급       │
└──────────────┘

                              │
                              ▼
               ┌──────────────────────────┐
               │   Hyperledger Besu       │
               │      Blockchain          │
               │                          │
               │  - PetDIDRegistry        │
               │  - GuardianRegistry      │
               │  - ShelterRegistry       │
               └──────────────────────────┘
```

---

## 마이크로서비스 통신 구조

| 서비스 | 기술 스택 | 통신 프로토콜 | 역할 |
|--------|----------|--------------|------|
| **VC Server** | NestJS | gRPC (`:50055`) | Verifiable Credential 관리, 인증 상태 저장 |
| **ML Server** | FastAPI | gRPC (`:50052`) | 비문 특징 벡터 추출, 유사도 검증 |
| **Indexer** | Go | gRPC (`:50053`) | 블록체인 이벤트 인덱싱, 펫 이전 이력 조회 |
| **Faucet Server** | NestJS | gRPC (`:50054`) | 신규 가입자 테스트 토큰 지급 |
| **Spring Server** | Spring Boot | HTTP (`:8080`) | 메인 CRUD, 데이터베이스 관리, 게시물/채팅 |

---

## 인증 플로우

멍냥포의 회원가입 및 로그인은 **4단계**로 이루어집니다:

### 1단계: 지갑 연결
```
클라이언트 → 지갑(MetaMask 등) 연결 → walletAddress 획득
```

### 2단계: 회원가입 (이메일 인증)
```
POST /api/email/verification/send   # 인증코드 발송
POST /api/email/verification/verify # 인증코드 확인
POST /api/guardian/register         # 보호자로 회원가입
```

### 3단계: 지갑 로그인
```
POST /api/auth/challenge  # Challenge 문자열 요청
                          # → Challenge + VP 서명 데이터 반환

클라이언트: Challenge와 VP messageHash에 지갑으로 서명

POST /api/auth/login      # 서명 검증 → VP 발급 → JWT 세션 생성
```

### 4단계: 플랫폼 이용
```
Authorization: Bearer <VP-JWT>

모든 API 요청에 VP 기반 JWT 토큰 사용
```

### 인증 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                     인증 계층 구조                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  [Middleware Layer]                                          │
│  └─ Web3AuthMiddleware: 모든 요청에 JWT/Web3Token 검증        │
│                                                              │
│  [Guard Layer]                                               │
│  ├─ DIDAuthGuard: DID 플랫폼 기본 인증                        │
│  ├─ AdminAuthGuard: API Key 검증 (X-Admin-Key)               │
│  ├─ RoleBasedGuard: 역할 기반 접근 제어 (ADMIN/GUARDIAN/USER) │
│  └─ SpringAuthGuard: Spring 백엔드 토큰 검증                  │
│                                                              │
│  [Decorator Layer]                                           │
│  ├─ @Public(): 인증 스킵                                     │
│  ├─ @RBAC(): 역할 기반 접근 제어                              │
│  └─ @WalletAddress(): 지갑 주소 추출                         │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 데이터 동기화 전략

### SAGA 패턴 미적용 이유

MSA 구조이지만 **SAGA 패턴을 사용할 수 없습니다**:
- 블록체인 트랜잭션은 **수정 불가능(Immutable)**
- 따라서 **보상 트랜잭션(Compensating Transaction)** 불가

### 블록체인 기반 동기화

```
┌─────────────────────────────────────────────────────────────┐
│                  블록체인 트랜잭션 성공                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    BullQueue (Redis)                         │
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │ blockchain  │  │ spring-sync │  │ image-move  │          │
│  │    queue    │  │    queue    │  │    queue    │          │
│  └─────────────┘  └─────────────┘  └─────────────┘          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              각 마이크로서비스 비동기 동기화                    │
│                                                              │
│  VC Server ← 블록체인 상태 반영                               │
│  Spring Server ← 펫 데이터 동기화                             │
│  Indexer ← 이벤트 인덱싱                                     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 동기화 원칙

1. **블록체인이 신뢰의 원천**: 모든 중요한 상태 변경은 블록체인 트랜잭션 성공 후 처리
2. **비동기 동기화**: BullQueue를 통해 각 마이크로서비스에 비동기로 전파
3. **재시도 정책**: 지수 백오프(Exponential Backoff)로 실패 시 재시도 (최대 3회)

---

## 기술 스택

### Backend
- **Framework**: NestJS (Node.js)
- **Language**: TypeScript

### Blockchain
- **Network**: Hyperledger Besu
- **Library**: ethers.js v6
- **DID**: did-jwt-vc, ethr-did

### Communication
- **Internal**: gRPC (Protocol Buffers)
- **External**: HTTP/REST
- **Realtime**: WebSocket (Socket.io)

### Queue & Cache
- **Message Queue**: BullQueue
- **Cache**: Redis (ioredis)

### Infrastructure
- **Container**: Docker
- **Orchestration**: Kubernetes
- **Storage**: AWS S3

---

## 설치 및 실행

### 사전 요구사항

- Node.js 20+
- pnpm
- Redis
- 각 마이크로서비스 실행 (VC Server, ML Server, Indexer, Faucet, Spring)

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
docker build -t dogcatpaw-api-gateway .
docker run -p 3000:3000 dogcatpaw-api-gateway
```

### Kubernetes

```bash
kubectl apply -f k8s/
```

---

## API 엔드포인트

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/challenge` | Challenge 문자열 요청 |
| POST | `/api/auth/login` | 지갑 서명으로 로그인 (VP 발급) |
| POST | `/api/auth/refresh` | JWT 토큰 갱신 |
| POST | `/api/auth/logout` | 로그아웃 |

### Pet
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/pet/prepare-registration` | 펫 등록 준비 (서명 데이터 생성) |
| POST | `/pet/register` | 펫 등록 (서명된 트랜잭션 제출) |
| GET | `/pet/:petDID` | 펫 정보 조회 |
| PATCH | `/pet/:petDID/transfer` | 펫 보호권 이전 |

### Guardian
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/guardian/prepare-registration` | 보호자 등록 준비 |
| POST | `/guardian/register` | 보호자 등록 |

### Verifiable Credentials
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/vc/:petDID` | 펫의 VC 조회 |
| GET | `/vc/wallet/:address` | 지갑의 모든 VC 조회 |

### Faucet
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/faucet/request` | 테스트 토큰 요청 |
| GET | `/faucet/balance` | Faucet 잔액 조회 |
| GET | `/faucet/history` | 지급 이력 조회 |

### Chat (WebSocket)
| Event | Description |
|-------|-------------|
| `join-room` | 채팅방 입장 |
| `send-message` | 메시지 전송 |
| `leave-room` | 채팅방 퇴장 |

---

## 환경 변수

```env
# Server
PORT=3000

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# JWT
ACCESS_TOKEN_SECRET=your-access-token-secret
REFRESH_TOKEN_SECRET=your-refresh-token-secret

# Blockchain
RPC_URL=https://your-besu-rpc-url
ADMIN_PRIVATE_KEY=your-admin-private-key
GUARDIAN_REGISTRY_ADDRESS=0x...
PET_DID_REGISTRY_ADDRESS=0x...

# gRPC Services
VC_SERVICE_URL=localhost:50055
ML_SERVICE_URL=localhost:50052
INDEXER_SERVICE_URL=localhost:50053
FAUCET_SERVICE_URL=localhost:50054

# HTTP Services
SPRING_SERVER_URL=http://localhost:8080

# AWS
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_S3_BUCKET_NAME=

# Email
EMAIL_USER=
EMAIL_APP_PASSWORD=

# CORS
CORS_ORIGIN=http://localhost:3000
CORS_CREDENTIALS=true
```

---

## 프로젝트 구조

```
src/
├── abis/                  # 스마트 컨트랙트 ABI
├── admin/                 # 관리자 기능
├── auth/                  # DID 기반 인증 (JWT, Web3, VP)
├── blockchain/            # 블록체인 작업 큐 (BullQueue)
├── chat/                  # WebSocket 실시간 채팅
├── common/                # 공통 유틸리티 (Redis, 상수, 에러코드)
├── email/                 # 이메일 인증
├── faucet/                # Faucet 서비스 프록시 (gRPC)
├── guardian/              # 보호자 관리
├── indexer/               # Indexer 서비스 프록시 (gRPC)
├── nose-embedding/        # ML 비문 특징벡터 추출 (gRPC)
├── pet/                   # 펫 등록 및 관리
├── spring/                # Spring 백엔드 프록시 (HTTP)
├── vc/                    # Verifiable Credentials (gRPC)
├── app.module.ts          # 루트 모듈
└── main.ts                # 애플리케이션 진입점

proto/                     # gRPC 프로토콜 정의
├── vc.proto
├── faucet.proto
├── indexer.proto
└── nose_embedder.proto

k8s/                       # Kubernetes 배포 설정
```

---

## 라이선스

This project is proprietary software.
