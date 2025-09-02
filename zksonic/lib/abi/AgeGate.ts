// lib/abi/AgeGate.ts
export const AgeGateABI = [
  {
    inputs: [
      {
        internalType: "address",
        name: "_verifier",
        type: "address",
      },
    ],
    stateMutability: "nonpayable",
    type: "constructor",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "caller",
        type: "address",
      },
      {
        indexed: true,
        internalType: "bytes32",
        name: "challenge",
        type: "bytes32",
      },
      {
        indexed: true,
        internalType: "bytes32",
        name: "subjectDidHash",
        type: "bytes32",
      },
      {
        indexed: false,
        internalType: "bool",
        name: "isOver18",
        type: "bool",
      },
    ],
    name: "AgeVerified",
    type: "event",
  },
  {
    inputs: [],
    name: "verifier",
    outputs: [
      {
        internalType: "contract IVerifier",
        name: "",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256[2]",
        name: "a",
        type: "uint256[2]",
      },
      {
        internalType: "uint256[2][2]",
        name: "b",
        type: "uint256[2][2]",
      },
      {
        internalType: "uint256[2]",
        name: "c",
        type: "uint256[2]",
      },
      {
        internalType: "uint256[5]",
        name: "input",
        type: "uint256[5]",
      },
      {
        internalType: "bytes32",
        name: "challenge",
        type: "bytes32",
      },
      {
        internalType: "bytes32",
        name: "subjectDidHash",
        type: "bytes32",
      },
    ],
    name: "verifyAge",
    outputs: [
      {
        internalType: "bool",
        name: "ok",
        type: "bool",
      },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;
