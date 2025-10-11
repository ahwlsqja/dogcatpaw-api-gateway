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
