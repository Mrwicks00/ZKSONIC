// lib/abi/CredentialIssuer.ts
export const CredentialIssuerABI = [
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "issuer",
        type: "address",
      },
      {
        indexed: true,
        internalType: "bytes32",
        name: "credHash",
        type: "bytes32",
      },
      {
        indexed: false,
        internalType: "string",
        name: "schema",
        type: "string",
      },
      {
        indexed: false,
        internalType: "bytes32",
        name: "subjectDidHash",
        type: "bytes32",
      },
    ],
    name: "CredentialAnchored",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "issuerAddress",
        type: "address",
      },
      {
        indexed: false,
        internalType: "string",
        name: "issuerName",
        type: "string",
      },
    ],
    name: "IssuerRegistered",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "issuerAddress",
        type: "address",
      },
    ],
    name: "IssuerRevoked",
    type: "event",
  },
  {
    inputs: [
      {
        internalType: "bytes32",
        name: "credHash",
        type: "bytes32",
      },
      {
        internalType: "string",
        name: "schema",
        type: "string",
      },
      {
        internalType: "bytes32",
        name: "subjectDidHash",
        type: "bytes32",
      },
    ],
    name: "anchorCredential",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "bytes32",
        name: "",
        type: "bytes32",
      },
    ],
    name: "credentialAnchored",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "_issuerAddress",
        type: "address",
      },
    ],
    name: "getIssuerName",
    outputs: [
      {
        internalType: "string",
        name: "",
        type: "string",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    name: "isRegisteredIssuer",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    name: "issuerNames",
    outputs: [
      {
        internalType: "string",
        name: "",
        type: "string",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "string",
        name: "_issuerName",
        type: "string",
      },
    ],
    name: "registerIssuer",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "revokeIssuer",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;
