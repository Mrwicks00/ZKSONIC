pragma circom 2.1.5;

template Multiplier() {
    signal input x;
    signal input y;
    signal output z;

    z <== x * y;
}

component main = Multiplier();