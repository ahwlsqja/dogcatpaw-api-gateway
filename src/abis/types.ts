// ABI 타입 정의
export interface ABIItem {
  type: string;
  name?: string;
  inputs?: Array<{
    name: string;
    type: string;
    internalType?: string;
    components?: Array<any>;
  }>;
  outputs?: Array<{
    name: string;
    type: string;
    internalType?: string;
    components?: Array<any>;
  }>;
  stateMutability?: string;
  payable?: boolean;
  constant?: boolean;
  anonymous?: boolean;
}

export type ContractABI = ABIItem[];

// 컨트랙트 주소 설정 (환경변수로부터 가져오기)
export const CONTRACT_ADDRESSES = {
  PetDIDRegistry: process.env.PET_DID_REGISTRY_ADDRESS || '',
  GuardianRegistry: process.env.GUARDIAN_REGISTRY_ADDRESS || '',
  ShelterRegistry: process.env.SHELTER_REGISTRY_ADDRESS || '',
} as const;

// 네트워크 설정
export const NETWORK_CONFIG = {
  chainId: process.env.CHAIN_ID || '1',
  rpcUrl: process.env.RPC_URL || 'http://localhost:8545',
  networkName: process.env.NETWORK_NAME || 'localhost',
} as const;

// 컨트랙트 정보 타입
export interface ContractInfo {
  abi: ContractABI;
  address: string;
  name: string;
}

// ABI와 주소를 함께 관리하는 헬퍼 함수
export function getContractInfo(
  contractName: keyof typeof CONTRACT_ADDRESSES,
  abi: ContractABI
): ContractInfo {
  return {
    abi,
    address: CONTRACT_ADDRESSES[contractName],
    name: contractName,
  };
}