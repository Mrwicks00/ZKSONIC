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
 * @dev Simple test contract to debug the AgeGate logic
 */
contract TestAgeGate {
    IVerifier public immutable verifier;

    event TestResult(
        bool verifierResult,
        bool over18,
        bool finalResult,
        uint input0,
        uint input4,
        uint challenge
    );

    constructor(address _verifier) {
        require(_verifier != address(0), "verifier addr none");
        verifier = IVerifier(_verifier);
    }

    function testLogic(
        uint[2] calldata a,
        uint[2][2] calldata b,
        uint[2] calldata c,
        uint[5] calldata input,
        bytes32 challenge,
        bytes32 subjectDidHash
    ) external returns (bool ok) {
        require(input.length >= 5, "bad inputs");

        // Test each step
        bool valid = verifier.verifyProof(a, b, c, input);
        bool over18 = (input[0] == 1);
        bool challengeMatch = (input[4] == uint256(challenge));

        ok = valid && over18 && challengeMatch;

        emit TestResult(
            valid,
            over18,
            ok,
            input[0],
            input[4],
            uint256(challenge)
        );
    }
}
