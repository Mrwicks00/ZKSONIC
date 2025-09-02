// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IVerifier {
    function verifyProof(
        uint[2] memory a,
        uint[2][2] memory b,
        uint[2] memory c,
        uint[5] memory input
    ) external view returns (bool);
}

/**
 * @dev AgeGate wraps the generated Groth16 verifier and emits a neat event.
 * We also sanity-check that:
 * - input[4] == 1 (isOver18 output from the circuit)
 * - input[3] == challenge (so the proof is bound to the challenge you displayed in the QR)
 * Public input ordering must match the circuit below.
 */
contract AgeGate {
    IVerifier public immutable verifier;

    event AgeVerified(
        address indexed caller,
        bytes32 indexed challenge,
        bytes32 indexed subjectDidHash,
        bool isOver18
    );

    constructor(address _verifier) {
        require(_verifier != address(0), "verifier addr none");
        verifier = IVerifier(_verifier);
    }

    function verifyAge(
    uint[2] calldata a,
    uint[2][2] calldata b,
    uint[2] calldata c,
    uint[5] calldata input,
    bytes32 challenge,
    bytes32 subjectDidHash
) external returns (bool ok) {
    require(input.length >= 5, "bad inputs");
    // inputs layout (actual circuit output order):
    // 0: isOver18 (1 or 0)
    // 1: currentYear
    // 2: currentMonth
    // 3: currentDay
    // 4: challenge

    require(input[4] == uint256(challenge), "challenge mismatch");

    bool valid = verifier.verifyProof(a, b, c, input);
    bool over18 = (input[0] == 1);

    ok = valid && over18;
    emit AgeVerified(msg.sender, challenge, subjectDidHash, ok);
}
}
