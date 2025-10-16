// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title GuardianRegistry
 * @notice Registry for pet guardians with SMS/Email verification
 * @dev Simplified - stores minimal data on-chain, full data in NCP
 * @author DogCatPaw Team
 */
contract GuardianRegistry is AccessControl, ReentrancyGuard {
    
    // ==================== Roles ====================
    
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");

    // ==================== Enums ====================
    
    enum VerificationMethod {
        NONE,           // 0
        SMS,            // 1
        EMAIL,          // 2
        SMS_AND_EMAIL   // 3
    }

    // ==================== Structs ====================
    
    /// @notice Guardian profile (minimal on-chain data)
    /// @dev Sensitive data stored in NCP, only hash/reference on-chain
    struct GuardianProfile {
        address guardianAddress;            // Guardian wallet address
        bytes32 personalDataHash;           // keccak256(encrypted personal data)
        string ncpStorageURI;              // NCP Object Storage URI
        VerificationMethod verificationMethod; // Verification type
        uint8 verificationLevel;           // 0-100 trust score
        uint48 registeredAt;               // Registration timestamp
        uint48 lastUpdated;                // Last update timestamp
        bool isActive;                     // Active status
    }

    /// @notice Verification proof structure
    struct VerificationProof {
        bool smsVerified;
        bool emailVerified;
        uint48 smsVerifiedAt;
        uint48 emailVerifiedAt;
        address verifier;                  // Who verified
    }

    // ==================== Storage ====================
    
    /// @dev guardianAddress => GuardianProfile
    mapping(address => GuardianProfile) private _guardians;
    
    /// @dev guardianAddress => VerificationProof
    mapping(address => VerificationProof) private _verificationProofs;
    
    /// @dev guardianAddress => array of pet DIDs
    mapping(address => string[]) private _guardianPets;
    
    /// @dev List of all registered guardians
    address[] private _allGuardians;
    
    /// @dev Total guardians counter
    uint256 private _totalGuardians;

    // ==================== Events ====================
    
    event GuardianRegistered(
        address indexed guardianAddress,
        VerificationMethod verificationMethod,
        uint48 timestamp
    );
    
    event GuardianVerified(
        address indexed guardianAddress,
        VerificationMethod method,
        address indexed verifier
    );
    
    event GuardianUpdated(
        address indexed guardianAddress,
        bytes32 newDataHash,
        uint48 timestamp
    );
    
    event GuardianDeactivated(
        address indexed guardianAddress,
        uint48 timestamp
    );
    
    event PetLinked(
        address indexed guardianAddress,
        string indexed petDID
    );

    // ==================== Errors ====================
    
    error AlreadyRegistered();
    error NotRegistered();
    error NotVerified();
    error Unauthorized();
    error InvalidVerification();
    error AlreadyDeactivated();

    // ==================== Constructor ====================
    
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    // ==================== Core Functions ====================

    /**
     * @notice Register a new guardian
     * @param _personalDataHash Hash of encrypted personal data
     * @param _ncpStorageURI NCP Storage URI for encrypted data
     * @param _verificationMethod Verification method used
     */
    function registerGuardian(
        bytes32 _personalDataHash,
        string calldata _ncpStorageURI,
        VerificationMethod _verificationMethod
    ) external nonReentrant {
        if (_guardians[msg.sender].guardianAddress != address(0)) {
            revert AlreadyRegistered();
        }

        // Calculate initial verification level
        uint8 verificationLevel = _calculateVerificationLevel(_verificationMethod);

        _guardians[msg.sender] = GuardianProfile({
            guardianAddress: msg.sender,
            personalDataHash: _personalDataHash,
            ncpStorageURI: _ncpStorageURI,
            verificationMethod: _verificationMethod,
            verificationLevel: verificationLevel,
            registeredAt: uint48(block.timestamp),
            lastUpdated: uint48(block.timestamp),
            isActive: true
        });

        _allGuardians.push(msg.sender);
        
        unchecked {
            ++_totalGuardians;
        }

        emit GuardianRegistered(msg.sender, _verificationMethod, uint48(block.timestamp));
    }

    /**
     * @notice Verify guardian with SMS/Email
     * @dev Only callable by trusted verifier
     * @param _guardianAddress Guardian to verify
     * @param _smsVerified SMS verification status
     * @param _emailVerified Email verification status
     */
    function verifyGuardian(
        address _guardianAddress,
        bool _smsVerified,
        bool _emailVerified
    ) external onlyRole(VERIFIER_ROLE) {
        GuardianProfile storage profile = _guardians[_guardianAddress];
        if (profile.guardianAddress == address(0)) revert NotRegistered();
        if (!_smsVerified && !_emailVerified) revert InvalidVerification();

        VerificationProof storage proof = _verificationProofs[_guardianAddress];
        
        if (_smsVerified) {
            proof.smsVerified = true;
            proof.smsVerifiedAt = uint48(block.timestamp);
        }
        
        if (_emailVerified) {
            proof.emailVerified = true;
            proof.emailVerifiedAt = uint48(block.timestamp);
        }
        
        proof.verifier = msg.sender;

        // Update verification method based on what's verified
        VerificationMethod newMethod;
        if (proof.smsVerified && proof.emailVerified) {
            newMethod = VerificationMethod.SMS_AND_EMAIL;
        } else if (proof.smsVerified) {
            newMethod = VerificationMethod.SMS;
        } else {
            newMethod = VerificationMethod.EMAIL;
        }

        profile.verificationMethod = newMethod;
        profile.verificationLevel = _calculateVerificationLevel(newMethod);
        profile.lastUpdated = uint48(block.timestamp);

        emit GuardianVerified(_guardianAddress, newMethod, msg.sender);
    }

    /**
     * @notice Update guardian data hash (when personal data changes)
     * @param _newPersonalDataHash New hash of encrypted data
     * @param _newNcpStorageURI New NCP Storage URI
     */
    function updateGuardianData(
        bytes32 _newPersonalDataHash,
        string calldata _newNcpStorageURI
    ) external {
        GuardianProfile storage profile = _guardians[msg.sender];
        if (profile.guardianAddress == address(0)) revert NotRegistered();

        profile.personalDataHash = _newPersonalDataHash;
        profile.ncpStorageURI = _newNcpStorageURI;
        profile.lastUpdated = uint48(block.timestamp);

        emit GuardianUpdated(msg.sender, _newPersonalDataHash, uint48(block.timestamp));
    }

    /**
     * @notice Deactivate guardian account
     */
    function deactivateGuardian() external {
        GuardianProfile storage profile = _guardians[msg.sender];
        if (profile.guardianAddress == address(0)) revert NotRegistered();
        if (!profile.isActive) revert AlreadyDeactivated();

        profile.isActive = false;
        profile.lastUpdated = uint48(block.timestamp);

        emit GuardianDeactivated(msg.sender, uint48(block.timestamp));
    }

    /**
     * @notice Link a pet to guardian
     * @param _petDID Pet DID to link
     */
    function linkPet(string calldata _petDID) external {
        GuardianProfile storage profile = _guardians[msg.sender];
        if (profile.guardianAddress == address(0)) revert NotRegistered();
        if (!profile.isActive) revert NotRegistered();

        _guardianPets[msg.sender].push(_petDID);
        
        emit PetLinked(msg.sender, _petDID);
    }

    /**
     * @notice Unlink a pet from guardian
     * @param _petDID Pet DID to unlink
     */
    function unlinkPet(string calldata _petDID) external {
        GuardianProfile storage profile = _guardians[msg.sender];
        if (profile.guardianAddress == address(0)) revert NotRegistered();

        string[] storage pets = _guardianPets[msg.sender];
        uint256 length = pets.length;
        
        for (uint256 i = 0; i < length; ) {
            if (keccak256(bytes(pets[i])) == keccak256(bytes(_petDID))) {
                pets[i] = pets[length - 1];
                pets.pop();
                break;
            }
            unchecked { ++i; }
        }
    }

    // ==================== View Functions ====================

    /**
     * @notice Get guardian profile
     * @param _guardianAddress Guardian address
     * @return profile Guardian profile struct
     */
    function getGuardianProfile(address _guardianAddress)
        external
        view
        returns (GuardianProfile memory profile)
    {
        profile = _guardians[_guardianAddress];
        if (profile.guardianAddress == address(0)) revert NotRegistered();
    }

    /**
     * @notice Get verification proof
     * @param _guardianAddress Guardian address
     * @return proof Verification proof struct
     */
    function getVerificationProof(address _guardianAddress)
        external
        view
        returns (VerificationProof memory proof)
    {
        return _verificationProofs[_guardianAddress];
    }

    /**
     * @notice Check if guardian is verified
     * @param _guardianAddress Guardian address
     * @return True if verified (SMS or Email)
     */
    function isVerified(address _guardianAddress) external view returns (bool) {
        VerificationProof storage proof = _verificationProofs[_guardianAddress];
        return proof.smsVerified || proof.emailVerified;
    }

    /**
     * @notice Check if guardian is active
     * @param _guardianAddress Guardian address
     * @return True if active
     */
    function isActive(address _guardianAddress) external view returns (bool) {
        return _guardians[_guardianAddress].isActive;
    }

    /**
     * @notice Get guardian's pets
     * @param _guardianAddress Guardian address
     * @return Array of pet DIDs
     */
    function getGuardianPets(address _guardianAddress)
        external
        view
        returns (string[] memory)
    {
        return _guardianPets[_guardianAddress];
    }

    /**
     * @notice Get total number of guardians
     * @return Total guardian count
     */
    function getTotalGuardians() external view returns (uint256) {
        return _totalGuardians;
    }

    /**
     * @notice Get all guardian addresses
     * @return Array of guardian addresses
     */
    function getAllGuardians() external view returns (address[] memory) {
        return _allGuardians;
    }

    /**
     * @notice Get guardian verification level
     * @param _guardianAddress Guardian address
     * @return Verification level (0-100)
     */
    function getVerificationLevel(address _guardianAddress)
        external
        view
        returns (uint8)
    {
        return _guardians[_guardianAddress].verificationLevel;
    }

    // ==================== Internal Functions ====================

    /**
     * @dev Calculate verification level based on method
     * @param _method Verification method
     * @return Verification level (0-100)
     */
    function _calculateVerificationLevel(VerificationMethod _method)
        internal
        pure
        returns (uint8)
    {
        if (_method == VerificationMethod.SMS_AND_EMAIL) return 100;
        if (_method == VerificationMethod.EMAIL) return 70;
        if (_method == VerificationMethod.SMS) return 60;
        return 0;
    }

    // ==================== Admin Functions ====================

    /**
     * @notice Grant verifier role
     * @param _verifier Verifier address
     */
    function grantVerifierRole(address _verifier)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        _grantRole(VERIFIER_ROLE, _verifier);
    }

    /**
     * @notice Revoke verifier role
     * @param _verifier Verifier address
     */
    function revokeVerifierRole(address _verifier)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        _revokeRole(VERIFIER_ROLE, _verifier);
    }

    /**
     * @notice Force deactivate guardian (admin only)
     * @param _guardianAddress Guardian to deactivate
     */
    function forceDeactivateGuardian(address _guardianAddress)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        GuardianProfile storage profile = _guardians[_guardianAddress];
        if (profile.guardianAddress == address(0)) revert NotRegistered();

        profile.isActive = false;
        profile.lastUpdated = uint48(block.timestamp);

        emit GuardianDeactivated(_guardianAddress, uint48(block.timestamp));
    }
}