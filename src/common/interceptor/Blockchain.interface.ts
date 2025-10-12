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