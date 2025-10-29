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
  signedTx?: string;  // 프로덕션: 사용자의 서명된 트랜잭션
}

export interface ControllerTransferJob {
  petDID: string;
  previousGuardian: string;
  newGuardian: string;
  unlinkSignedTx?: string;  // 프로덕션: previousGuardian의 unlink 트랜잭션 서명
  linkSignedTx?: string;     // 프로덕션: newGuardian의 link 트랜잭션 서명
}

export interface VCTransferJob {
  petDID: string;
  newGuardian: string;
  previousGuardian: string;
  signature: string;
  message: any;
  vcSignedData: string;
  petData: any;
}