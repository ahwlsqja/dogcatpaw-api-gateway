# 🐾 멍냥포 ML Server

멍냥포 플랫폼의 **비문(Nose Print) 특징 벡터 추출 및 유사도 검증** 서버입니다.

## 📋 목차

- [개요](#개요)
- [아키텍처](#아키텍처)
- [gRPC API](#grpc-api)
- [비문 인식 프로세스](#비문-인식-프로세스)
- [설치 및 실행](#설치-및-실행)
- [환경 변수](#환경-변수)

---

## 개요

ML Server는 반려동물의 코 무늬(비문)를 분석하여 고유한 특징 벡터를 추출하고, 저장된 벡터와의 유사도를 검증하는 마이크로서비스입니다.

### 핵심 기능

- **특징 벡터 추출**: 코 이미지에서 고유한 임베딩 벡터 생성
- **유사도 검증**: 새 이미지와 저장된 벡터 비교 (코사인 유사도, 유클리드 거리)
- **Pet DID 생성 지원**: 추출된 벡터의 해시로 고유한 DID 생성

### 기술 스택

- **Framework**: FastAPI (Python)
- **Language**: Python 3.11+
- **ML Runtime**: ONNX Runtime
- **Model Format**: ONNX (Open Neural Network Exchange)
- **Communication**: gRPC (Protocol Buffers)
- **Storage**: NCP Object Storage
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
                              │ gRPC (:50052)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        ML Server                                 │
│                        (FastAPI)                                 │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    ONNX Runtime                           │   │
│  │                                                           │   │
│  │    ┌─────────────────────────────────────────────────┐   │   │
│  │    │           embedder_model.onnx                    │   │   │
│  │    │                                                  │   │   │
│  │    │   Input: 코 이미지 (224x224 RGB)                 │   │   │
│  │    │   Output: 특징 벡터 (512-dim float array)        │   │   │
│  │    └─────────────────────────────────────────────────┘   │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌───────────────────┐
                    │ NCP Object Storage│
                    │                   │
                    │ nose-print-photo/ │
                    │   └── {petDID}/   │
                    │        ├── img.jpg│
                    │        └── vec.npy│
                    └───────────────────┘
                              │
                              ▼
                    ┌───────────────────┐
                    │    PostgreSQL     │
                    │   (벡터 메타데이터)│
                    └───────────────────┘
```

---

## gRPC API

### 서비스 정의

```protobuf
service NoseEmbedderService {
  // 강아지 코 이미지에서 특징 벡터 추출
  rpc ExtractNoseVector(NoseImageRequest) returns (NoseVectorResponse);

  // 새 이미지와 저장된 이미지(PetDID) 비교
  rpc CompareWithStoredImage(CompareWithStoredImageRequest) returns (CompareVectorsResponse);

  // gRPC 연결 상태 확인
  rpc HealthCheck(HealthCheckRequest) returns (HealthCheckResponse);
}
```

---

### ExtractNoseVector - 특징 벡터 추출

코 이미지에서 고유한 특징 벡터(임베딩)를 추출합니다.

**Request:**
```protobuf
message NoseImageRequest {
  bytes image_data = 1;      // 이미지 바이트 데이터 (JPEG/PNG)
  string image_format = 2;   // 이미지 포맷 ("jpeg" 또는 "png")
}
```

**Response:**
```protobuf
message NoseVectorResponse {
  repeated float vector = 1;           // 특징 벡터 (512차원 float 배열)
  int32 vector_size = 2;               // 벡터 차원 (512)
  bool success = 3;                    // 성공 여부
  string error_message = 4;            // 에러 메시지
  optional MLErrorCode error_code = 5; // 에러 코드
  optional bool retryable = 6;         // 재시도 가능 여부
}
```

**사용 예시:**
```python
# API Gateway에서 호출
response = await ml_service.ExtractNoseVector(
    NoseImageRequest(
        image_data=image_bytes,
        image_format="jpeg"
    )
)

# 벡터를 keccak256 해시하여 Pet DID 생성
vector_hash = keccak256(response.vector)
pet_did = f"did:ethr:besu:0x{vector_hash[:40]}"
```

---

### CompareWithStoredImage - 저장된 이미지와 비교

새로 촬영한 이미지와 기존에 등록된 펫의 비문을 비교하여 유사도를 검증합니다.

**Request:**
```protobuf
message CompareWithStoredImageRequest {
  string image_key = 1;   // 새 이미지 키 (NCP 경로: nose-print-photo/{petDID}/{fileName})
  string pet_did = 2;     // 비교할 Pet DID
}
```

**Response:**
```protobuf
message CompareVectorsResponse {
  float similarity = 1;            // 종합 유사도 점수 (0.0 ~ 1.0)
  float cosine_similarity = 2;     // 코사인 유사도 (0.0 ~ 1.0)
  float euclidean_distance = 3;    // 유클리드 거리
  bool success = 4;                // 성공 여부
  string error_message = 5;        // 에러 메시지
  int32 vector_size = 6;           // 벡터 차원
  optional MLErrorCode error_code = 7;
  optional bool retryable = 8;
}
```

**유사도 임계값:**
- `similarity >= 0.85`: 동일 펫으로 인정
- `similarity >= 0.70`: 추가 검증 필요
- `similarity < 0.70`: 다른 펫으로 판정

---

### HealthCheck - 서비스 상태 확인

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
  ServingStatus status = 1;    // 서비스 상태
  string message = 2;          // 상태 메시지
  string model_loaded = 3;     // 모델 로드 상태 ("true" / "false")
  string timestamp = 4;        // 타임스탬프
}
```

---

## 에러 코드

### 클라이언트 에러 (4xxx) - 재시도 불가

| 코드 | Enum | 설명 |
|-----|------|------|
| ML_4001 | INVALID_IMAGE | 유효하지 않은 이미지 |
| ML_4002 | IMAGE_TOO_LARGE | 이미지 크기 초과 |
| ML_4003 | INVALID_IMAGE_FORMAT | 지원하지 않는 이미지 형식 |
| ML_4004 | VECTOR_NOT_FOUND | 벡터 데이터 없음 |
| ML_4005 | VECTOR_DIMENSION_MISMATCH | 벡터 차원 불일치 |
| ML_4006 | INVALID_REQUEST | 잘못된 요청 |

### 서버 에러 (5xxx) - 재시도 가능

| 코드 | Enum | 설명 |
|-----|------|------|
| ML_5001 | MODEL_NOT_LOADED | 모델 미로드 |
| ML_5002 | INFERENCE_ERROR | 추론 오류 |
| ML_5003 | STORAGE_CONNECTION_ERROR | 스토리지 연결 오류 |
| ML_5004 | INTERNAL_SERVER_ERROR | 내부 서버 오류 |
| ML_5005 | SERVICE_UNAVAILABLE | 서비스 불가 |

---

## 비문 인식 프로세스

### 1. 펫 등록 시 (최초 등록)

```
1. 클라이언트가 코 이미지 촬영 (2장)
                    │
                    ▼
2. API Gateway → ML Server: ExtractNoseVector()
                    │
                    ▼
3. ML Server: 이미지 전처리 (224x224 리사이즈, 정규화)
                    │
                    ▼
4. ML Server: ONNX 모델 추론 → 512차원 특징 벡터
                    │
                    ▼
5. API Gateway: keccak256(vector) → Pet DID 생성
                    │
                    ▼
6. 벡터 및 이미지를 NCP Object Storage에 저장
   - nose-print-photo/{petDID}/image_1.jpg
   - nose-print-photo/{petDID}/image_2.jpg
   - nose-print-photo/{petDID}/vector.npy
                    │
                    ▼
7. 블록체인에 Pet DID 등록 (PetDIDRegistry)
```

### 2. 비문 검증 시 (본인 확인)

```
1. 클라이언트가 새 코 이미지 촬영
                    │
                    ▼
2. 이미지를 NCP에 임시 저장
   - nose-print-photo/{petDID}/verify_{timestamp}.jpg
                    │
                    ▼
3. API Gateway → ML Server: CompareWithStoredImage()
                    │
                    ▼
4. ML Server: 새 이미지에서 벡터 추출
                    │
                    ▼
5. ML Server: NCP에서 저장된 벡터 로드
                    │
                    ▼
6. ML Server: 유사도 계산
   - 코사인 유사도
   - 유클리드 거리
   - 종합 유사도 점수
                    │
                    ▼
7. similarity >= 0.85 → 검증 성공
   similarity < 0.85  → 검증 실패
```

### 3. 소유권 이전 시

```
1. 새 보호자가 펫의 코 이미지 촬영
                    │
                    ▼
2. CompareWithStoredImage()로 동일 펫 확인
                    │
                    ▼
3. similarity >= 0.85 확인
                    │
                    ▼
4. 블록체인에서 소유권 이전 (changeController)
                    │
                    ▼
5. 기존 VC 무효화, 새 VC 발급
```

---

## 설치 및 실행

### 사전 요구사항

- Python 3.11+
- pip 또는 poetry
- ONNX Runtime
- NCP Object Storage 접근 권한

### 설치

```bash
pip install -r requirements.txt
```

### 모델 다운로드

```bash
python download_model.py
```

### Proto 파일 생성

```bash
python generate_proto.py
```

### 개발 모드 실행

```bash
uvicorn src.main:app --reload --host 0.0.0.0 --port 50052
```

### 프로덕션 실행

```bash
python -m grpc_tools.protoc -I./proto --python_out=./src --grpc_python_out=./src ./proto/nose_embedder.proto
python src/main.py
```

### Docker

```bash
docker build -t ml-server .
docker run -p 50052:50052 ml-server
```

### Kubernetes

```bash
kubectl apply -f k8s/
```

---

## 환경 변수

```env
# Server
GRPC_PORT=50052

# Model
MODEL_PATH=./embedder_model.onnx
MODEL_INPUT_SIZE=224

# NCP Object Storage
NCP_ACCESS_KEY=your-access-key
NCP_SECRET_KEY=your-secret-key
NCP_BUCKET_NAME=dogcatpaw-ml
NCP_ENDPOINT=https://kr.object.ncloudstorage.com

# Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=your-password
DB_DATABASE=ml_server

# Logging
LOG_LEVEL=info
```

---

## 프로젝트 구조

```
dogcatpaw-ml-server/
├── src/
│   ├── __init__.py
│   ├── main.py                # gRPC 서버 진입점
│   ├── service.py             # NoseEmbedderService 구현
│   ├── model/
│   │   ├── __init__.py
│   │   ├── embedder.py        # ONNX 모델 래퍼
│   │   └── preprocessor.py    # 이미지 전처리
│   ├── storage/
│   │   ├── __init__.py
│   │   └── ncp_storage.py     # NCP Object Storage 클라이언트
│   ├── utils/
│   │   ├── __init__.py
│   │   ├── similarity.py      # 유사도 계산 함수
│   │   └── vector_utils.py    # 벡터 유틸리티
│   └── proto/
│       ├── nose_embedder_pb2.py
│       └── nose_embedder_pb2_grpc.py
├── k8s/                       # Kubernetes 배포 설정
├── embedder_model.onnx        # ONNX 모델 파일
├── download_model.py          # 모델 다운로드 스크립트
├── generate_proto.py          # Proto 코드 생성 스크립트
├── requirements.txt           # Python 의존성
├── Dockerfile
└── BUILD.md
```

---

## 모델 사양

### embedder_model.onnx

| 항목 | 값 |
|-----|-----|
| Input Shape | (1, 3, 224, 224) |
| Input Format | RGB, float32, normalized [0, 1] |
| Output Shape | (1, 512) |
| Output Format | float32 embedding vector |
| Model Size | ~50MB |

### 전처리 파이프라인

```python
def preprocess(image: bytes) -> np.ndarray:
    # 1. 바이트 → PIL Image
    img = Image.open(io.BytesIO(image))

    # 2. RGB 변환
    img = img.convert("RGB")

    # 3. 리사이즈 (224x224)
    img = img.resize((224, 224), Image.LANCZOS)

    # 4. numpy 배열 변환
    arr = np.array(img, dtype=np.float32)

    # 5. 정규화 [0, 255] → [0, 1]
    arr = arr / 255.0

    # 6. 채널 순서 변경 (HWC → CHW)
    arr = arr.transpose(2, 0, 1)

    # 7. 배치 차원 추가
    arr = np.expand_dims(arr, axis=0)

    return arr
```

---

## API Gateway 연동

```typescript
// API Gateway의 NoseEmbedderProxyService
@Injectable()
export class NoseEmbedderProxyService implements OnModuleInit {
  private noseService: NoseEmbedderServiceClient;

  constructor(@Inject('ML_GRPC_SERVICE') private client: ClientGrpc) {}

  onModuleInit() {
    this.noseService = this.client.getService<NoseEmbedderServiceClient>('NoseEmbedderService');
  }

  async extractVector(imageData: Buffer): Promise<NoseVectorResponse> {
    return firstValueFrom(
      this.noseService.ExtractNoseVector({
        image_data: imageData,
        image_format: 'jpeg',
      })
    );
  }

  async compareWithStored(imageKey: string, petDID: string): Promise<CompareVectorsResponse> {
    return firstValueFrom(
      this.noseService.CompareWithStoredImage({
        image_key: imageKey,
        pet_did: petDID,
      })
    );
  }
}
```

---

## 라이선스

MIT License
