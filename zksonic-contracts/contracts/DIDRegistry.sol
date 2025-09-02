// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract DIDRegistry {
    struct DIDInfo {
        address owner;
        string didDocumentURI;
        bool revoked;
    }

    mapping(bytes32 => DIDInfo) public dids;
    mapping(address => bytes32[]) public ownerDIDs;

    event DIDRegistered(bytes32 indexed didHash, address indexed owner, string didDocumentURI);
    event DIDUpdated(bytes32 indexed didHash, address indexed owner, string newDidDocumentURI);
    event DIDRevoked(bytes32 indexed didHash, address indexed owner);

    function registerDID(bytes32 didHash, string calldata didDocumentURI) external {
        require(dids[didHash].owner == address(0), "DID already registered");
        dids[didHash] = DIDInfo(msg.sender, didDocumentURI, false);
        ownerDIDs[msg.sender].push(didHash);
        emit DIDRegistered(didHash, msg.sender, didDocumentURI);
    }

    function updateDID(bytes32 didHash, string calldata newDidDocumentURI) external {
        require(dids[didHash].owner == msg.sender, "Only DID owner can update");
        require(!dids[didHash].revoked, "Cannot update revoked DID");
        dids[didHash].didDocumentURI = newDidDocumentURI;
        emit DIDUpdated(didHash, msg.sender, newDidDocumentURI);
    }

    function revokeDID(bytes32 didHash) external {
        require(dids[didHash].owner == msg.sender, "Only DID owner can revoke");
        require(!dids[didHash].revoked, "DID already revoked");
        dids[didHash].revoked = true;
        emit DIDRevoked(didHash, msg.sender);
    }

    function getDidDocumentURI(bytes32 didHash) external view returns (string memory) {
        require(dids[didHash].owner != address(0), "DID not found");
        require(!dids[didHash].revoked, "DID is revoked");
        return dids[didHash].didDocumentURI;
    }

    function isDIDRevoked(bytes32 didHash) external view returns (bool) {
        return dids[didHash].revoked;
    }

    function getOwnerDIDs(address owner) external view returns (bytes32[] memory) {
        return ownerDIDs[owner];
    }
}
