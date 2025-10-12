// TypeScript interfaces for gRPC service
// Copy this to your NestJS project

export interface NoseImageRequest {
  image_data: Uint8Array | number[];
  image_format?: string;
}

export interface NoseVectorResponse {
  vector: number[];
  vectorSize: number;
  success: boolean;
  errorMessage?: string;
}

export interface HealthCheckRequest {
  service?: string;
}

export enum ServingStatus {
  UNKNOWN = 0,
  SERVING = 1,
  NOT_SERVING = 2,
  SERVICE_UNKNOWN = 3,
}

export interface HealthCheckResponse {
  status: ServingStatus;
  message: string;
  modelLoaded: string;
  timestamp: string;
}

export interface CompareWithStoredImageRequest {
  image_key: string;  // 예: "nose-print-photo/did:pet:12345/image1.jpg"
  pet_did: string;    // 예: "did:pet:12345"
}

export interface CompareVectorsResponse {
  similarity: number;          // 정규화된 유사도 (0.0 ~ 1.0)
  cosine_similarity: number;   // 코사인 유사도
  euclidean_distance: number;  // 유클리드 거리
  vector_size: number;         // 벡터 차원
  success: boolean;
  errorMessage?: string;
}
