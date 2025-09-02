pragma circom 2.1.5;


include "node_modules/circomlib/circuits/comparators.circom";

template T() {
    signal input a;
    signal input b;
    component lt = LessThan(8);
    lt.in[0] <== a;
    lt.in[1] <== b;
    signal output o;
    o <== lt.out;
}
component main = T();
