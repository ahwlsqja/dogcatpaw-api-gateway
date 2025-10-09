import PetDIDRegistryABIRaw from './PetDIDRegistry.abi.json';
import GuardianRegistryABIRaw from './GuardianRegistry.abi.json';
import ShelterRegistryABIRaw from './ShelterRegistry.abi.json';

import {
  ContractABI,
  ContractInfo,
  getContractInfo,
  CONTRACT_ADDRESSES,
  NETWORK_CONFIG,
  ABIItem
} from './types';

// ABI를 ContractABI 타입으로 캐스팅
const petDIDRegistryABI = PetDIDRegistryABIRaw as ContractABI;
const guardianRegistryABI = GuardianRegistryABIRaw as ContractABI;
const shelterRegistryABI = ShelterRegistryABIRaw as ContractABI;

// 기본 export (기존 코드와의 호환성 유지)
export {
  petDIDRegistryABI as PetDIDRegistryABI,
  guardianRegistryABI as GuardianRegistryABI,
  shelterRegistryABI as ShelterRegistryABI,
};

// 컨트랙트 정보 (ABI + 주소)
export const PetDIDRegistryInfo: ContractInfo = getContractInfo('PetDIDRegistry', petDIDRegistryABI);
export const GuardianRegistryInfo: ContractInfo = getContractInfo('GuardianRegistry', guardianRegistryABI);
export const ShelterRegistryInfo: ContractInfo = getContractInfo('ShelterRegistry', shelterRegistryABI);

// 모든 컨트랙트 정보를 한 곳에서 관리
export const CONTRACTS = {
  PetDIDRegistry: PetDIDRegistryInfo,
  GuardianRegistry: GuardianRegistryInfo,
  ShelterRegistry: ShelterRegistryInfo,
} as const;

// 타입 재출력
export type {
  ContractABI,
  ContractInfo,
  ABIItem
} from './types';

export {
  CONTRACT_ADDRESSES,
  NETWORK_CONFIG
} from './types';

// 컨트랙트 이름으로 ABI 가져오기
export function getABI(contractName: keyof typeof CONTRACTS): ContractABI {
  return CONTRACTS[contractName].abi;
}

// 컨트랙트 이름으로 주소 가져오기
export function getAddress(contractName: keyof typeof CONTRACTS): string {
  return CONTRACTS[contractName].address;
}

// 모든 컨트랙트 정보 가져오기
export function getAllContracts(): typeof CONTRACTS {
  return CONTRACTS;
}