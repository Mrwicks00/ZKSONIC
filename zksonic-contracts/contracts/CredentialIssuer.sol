// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract CredentialIssuer {
    mapping(address => bool) public isRegisteredIssuer;
    mapping(address => string) public issuerNames;

    // Hash -> anchored?
    mapping(bytes32 => bool) public credentialAnchored;

    event IssuerRegistered(address indexed issuerAddress, string issuerName);
    event IssuerRevoked(address indexed issuerAddress);
    event CredentialAnchored(
        address indexed issuer,
        bytes32 indexed credHash,
        string schema,
        bytes32 subjectDidHash
    );

    function registerIssuer(string calldata _issuerName) external {
        require(!isRegisteredIssuer[msg.sender], "Issuer already registered");
        isRegisteredIssuer[msg.sender] = true;
        issuerNames[msg.sender] = _issuerName;
        emit IssuerRegistered(msg.sender, _issuerName);
    }

    function revokeIssuer() external {
        require(isRegisteredIssuer[msg.sender], "Not a registered issuer");
        isRegisteredIssuer[msg.sender] = false;
        delete issuerNames[msg.sender];
        emit IssuerRevoked(msg.sender);
    }

    function getIssuerName(address _issuerAddress) external view returns (string memory) {
        require(isRegisteredIssuer[_issuerAddress], "Issuer not registered");
        return issuerNames[_issuerAddress];
    }

    // Anchor a credential hash on-chain (authenticity fingerprint)
    function anchorCredential(bytes32 credHash, string calldata schema, bytes32 subjectDidHash) external {
        require(isRegisteredIssuer[msg.sender], "Not a registered issuer");
        require(!credentialAnchored[credHash], "Already anchored");
        credentialAnchored[credHash] = true;
        emit CredentialAnchored(msg.sender, credHash, schema, subjectDidHash);
    }
}
