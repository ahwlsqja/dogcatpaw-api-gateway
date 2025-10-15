export interface BiometricVerificationJob {
  petDID: string;
  similarity: number;
  purpose: number;
  verifier?: string;
}

export interface GuardianLinkJob {
  guardianAddress: string;
  petDID: string;
  action: 'link' | 'unlink';
}

export interface ControllerTransferJob {
  petDID: string;
  previousGuardian: string;
  newGuardian: string;
}

export interface VCTransferJob {
  petDID: string;
  newGuardian: string;
  previousGuardian: string;
  signature: string;
  message: any;
  petData: any;
}