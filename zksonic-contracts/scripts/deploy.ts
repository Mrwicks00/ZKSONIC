import { ethers, run, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function verify(address: string, constructorArguments: any[] = []) {
  try {
    await run("verify:verify", { address, constructorArguments });
    console.log(`✔ Verified: ${address}`);
  } catch (err: any) {
    const msg = `${err?.message || err}`;
    if (msg.toLowerCase().includes("already verified")) {
      console.log(`ℹ Already verified: ${address}`);
    } else {
      console.log(`⚠ Verify failed for ${address}: ${msg}`);
    }
  }
}

async function main() {
  console.log(`Network: ${network.name}`);
  const [deployer] = await ethers.getSigners();
  console.log(`Deployer: ${deployer.address}`);

  // 1) DIDRegistry
  const DIDRegistry = await ethers.getContractFactory("DIDRegistry");
  const didRegistry = await DIDRegistry.deploy();
  await didRegistry.waitForDeployment();
  const didRegistryAddress = await didRegistry.getAddress();
  console.log(`DIDRegistry: ${didRegistryAddress}`);

  // 2) CredentialIssuer
  const CredentialIssuer = await ethers.getContractFactory("CredentialIssuer");
  const credentialIssuer = await CredentialIssuer.deploy();
  await credentialIssuer.waitForDeployment();
  const credentialIssuerAddress = await credentialIssuer.getAddress();
  console.log(`CredentialIssuer: ${credentialIssuerAddress}`);

  // 3) Groth16Verifier (use the EXACT name from your generated file)
  const Groth16Verifier = await ethers.getContractFactory("Groth16Verifier");
  const verifier = await Groth16Verifier.deploy();
  await verifier.waitForDeployment();
  const verifierAddress = await verifier.getAddress();
  console.log(`Groth16Verifier: ${verifierAddress}`);

  // 4) AgeGate (constructor needs verifier address)
  const AgeGate = await ethers.getContractFactory("AgeGate");
  const ageGate = await AgeGate.deploy(verifierAddress);
  await ageGate.waitForDeployment();
  const ageGateAddress = await ageGate.getAddress();
  console.log(`AgeGate: ${ageGateAddress}`);

  // Save addresses
  const outDir = path.join("deployments");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);
  const outPath = path.join(
    outDir,
    `${network.name}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`
  );
  const payload = {
    network: network.name,
    deployer: deployer.address,
    DIDRegistry: didRegistryAddress,
    CredentialIssuer: credentialIssuerAddress,
    Groth16Verifier: verifierAddress,
    AgeGate: ageGateAddress,
  };
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2));
  console.log(`Addresses saved to ${outPath}`);

  // --- Programmatic verification (SonicScan) ---
  // If you don't have API key or verification endpoint is slow, this may fail — it's fine.
  await verify(didRegistryAddress);
  await verify(credentialIssuerAddress);
  await verify(verifierAddress);                 // no constructor args
  await verify(ageGateAddress, [verifierAddress]);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});