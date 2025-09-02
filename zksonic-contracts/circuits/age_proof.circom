pragma circom 2.1.5;

include "node_modules/circomlib/circuits/comparators.circom";
include "node_modules/circomlib/circuits/bitify.circom";

/*
Public signals order:
  0: currentYear
  1: currentMonth  
  2: currentDay
  3: challenge      (bind proof to session/QR)
  4: isOver18       (output)
*/

template AgeProof() {
    // ---- Private inputs (from credential) ----
    signal input birthYear;
    signal input birthMonth; 
    signal input birthDay;

    // ---- Public inputs ----
    signal input currentYear;
    signal input currentMonth;
    signal input currentDay;
    signal input challenge;

    // ---- Output (automatically public) ----
    signal output isOver18;

    // Constraint: challenge must be used (to prevent unused signal warnings)
    component challengeCheck = IsEqual();
    challengeCheck.in[0] <== challenge;
    challengeCheck.in[1] <== challenge;
    challengeCheck.out === 1;

    // --- Step 1: Calculate rough age in years ---
    signal ageYears;
    ageYears <== currentYear - birthYear;

    // --- Step 2: Check if birthday has happened this year ---
    // birthMonth > currentMonth ?
    component bm_gt_cm = LessThan(8);   // checks currentMonth < birthMonth
    bm_gt_cm.in[0] <== currentMonth;
    bm_gt_cm.in[1] <== birthMonth;

    // birthMonth == currentMonth ?
    component m_eq = IsEqual();
    m_eq.in[0] <== birthMonth;
    m_eq.in[1] <== currentMonth;

    // birthDay > currentDay ?
    component bd_gt_cd = LessThan(8);   // checks currentDay < birthDay
    bd_gt_cd.in[0] <== currentDay;
    bd_gt_cd.in[1] <== birthDay;

    // (birthMonth == currentMonth) AND (birthDay > currentDay)
    signal sameMonthDayAhead;
    sameMonthDayAhead <== m_eq.out * bd_gt_cd.out;

    // notYetBirthday = (birthMonth > currentMonth) OR (sameMonthDayAhead)
    signal notYetBirthday;
    notYetBirthday <== bm_gt_cm.out + sameMonthDayAhead - (bm_gt_cm.out * sameMonthDayAhead);

    // --- Step 3: Adjust age ---
    signal ageAdjusted;
    ageAdjusted <== ageYears - notYetBirthday;

    // --- Step 4: Check if ageAdjusted >= 18 ---
    component lt18 = LessThan(8);   // outputs 1 if ageAdjusted < 18
    lt18.in[0] <== ageAdjusted;
    lt18.in[1] <== 18;

    // isOver18 = NOT( ageAdjusted < 18 )
    isOver18 <== 1 - lt18.out;
}

component main{public [currentYear, currentMonth, currentDay, challenge]} = AgeProof();