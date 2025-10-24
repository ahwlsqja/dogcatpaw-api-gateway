// TypeScript interfaces for gRPC service
// Copy this to your NestJS project

import { MLErrorCode } from 'src/common/const/ml-error-codes';

export interface NoseImageRequest {
  image_data: Uint8Array | number[];
  image_format?: string;
}

// Proto response (snake_case from gRPC)
export interface NoseVectorProtoResponse {
  vector: number[];
  vector_size: number;
  success: boolean;
  error_message?: string;
  error_code?: number; // Proto enum value
  retryable?: boolean;
}

// Application response (camelCase for API)
export interface NoseVectorResponse {
  vector: number[];
  vectorSize: number;
  success: boolean;
  errorMessage?: string;
  errorCode?: MLErrorCode;
  retryable?: boolean;
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

// Proto response (snake_case from gRPC)
export interface CompareVectorsProtoResponse {
  similarity: number;
  cosine_similarity: number;
  euclidean_distance: number;
  vector_size: number;
  success: boolean;
  error_message?: string;
  error_code?: number; // Proto enum value
  retryable?: boolean;
}

// Application response (camelCase for API)
export interface CompareVectorsResponse {
  similarity: number;          // 정규화된 유사도 (0.0 ~ 1.0)
  cosine_similarity: number;   // 코사인 유사도
  euclidean_distance: number;  // 유클리드 거리
  vector_size: number;         // 벡터 차원
  success: boolean;
  errorMessage?: string;
  errorCode?: MLErrorCode;
  retryable?: boolean;
}
