# Sonic Age Verification (ZKSONIC)

![zksonic-logo](zksonic.png)

Zero-Knowledge Proof (ZKP) based age verification system with decentralized identity (DID) that allows users to prove their age eligibility without revealing their actual date of birth.

🔐 **Powered by zk-SNARKs (Groth16)**  
🆔 **Decentralized Identity (DID) System**  
📱 **Scan a QR code to verify**  
🖥️ **Works across devices: phone, PC, or kiosk**  
✅ **Privacy-preserving: no personal data is shared**

## 🎯 Problem & Solution

**Problem:** Traditional verification systems require sharing personal data (birth dates, ID numbers, credentials) with every platform, creating privacy risks and data breaches.

**Solution:** ZKSONIC uses Zero-Knowledge Proofs to verify eligibility without revealing any personal information. Users prove they meet requirements while keeping their actual data private.

## 🚀 Features

- **Age verification with ZKPs** – users prove their age eligibility without exposing their DOB
- **Decentralized Identity (DID) System** – users create and manage their own digital identity
- **QR code flow** – generate on PC, scan on mobile
- **Cross-device support** – polling + scanner workflows
- **Age compliance verification** – ensures compliance by verifying age eligibility without revealing personal data
- **Frontend built with Next.js + Tailwind**
- **Backend with API routes** for session management & verification
- **Smart contract integration** with Sonic blockchain
- **DID Registry** – on-chain storage of decentralized identities

## 🛠️ Tech Stack

- **Next.js** – React framework
- **Tailwind CSS** – styling
- **Circom** - writing zkps
- **snarkjs** – zk-SNARK verification
- **qrcode** – QR code generation
- **Viem** – Ethereum interaction
- **Wagmi** – React hooks for Ethereum
- **Redis** – session management
- **DID Registry Contract** – decentralized identity management
- **Node.js**

## 📂 Project Structure

```
zksonic/
├── app/                    # Next.js app routes
│   ├── api/               # API endpoints
│   │   ├── generate-proof/    # Circuit input generation
│   │   ├── submit-verification/ # Proof verification
│   │   └── verify/         # Verification workflow
│   └── page.tsx           # Main UI (QR + verification)
├── circuits/              # zk-SNARK circuits & keys
├── hooks/                 # React hooks (useDid, useProof, etc.)
├── lib/                   # Utilities and configurations
├── public/                # Static assets
└── README.md

zksonic-contracts/
├── contracts/             # Smart contracts
│   ├── AgeGate.sol        # Age verification contract
│   ├── Groth16Verifier.sol # ZK proof verifier
│   └── DIDRegistry.sol    # Decentralized identity registry
├── scripts/               # Deployment scripts
└── test/                  # Contract tests
```

## ⚡ Quick Start

### 1. Clone the repository

```bash
git clone https://github.com/YOUR-USERNAME/zksonic.git
cd zksonic
```

### 2. Install dependencies

```bash
npm install
```

### 3. Environment Setup

Create a `.env.local` file in the `zksonic` directory:

```env
# Redis Configuration
REDIS_URL=your_redis_url
REDIS_TOKEN=your_redis_token

# Sonic Testnet Configuration
SONIC_CHAIN_ID=14601
SONIC_RPC_URL=https://rpc.testnet.soniclabs.com
SONIC_PRIVATE_KEY=0x_your_private_key_here

# Contract Addresses
AGEGATE_ADDRESS=0x_your_agegate_address
GROTH16_VERIFIER_ADDRESS=0x_your_verifier_address
DID_REGISTRY_ADDRESS=0x_your_did_registry_address
```

### 4. Generate proving & verification keys

Make sure you have snarkjs installed globally:

```bash
npm install -g snarkjs
```

Compile circuits:

```bash
cd circuits
snarkjs groth16 setup ageCheck.r1cs pot12_final.ptau ageCheck_0000.zkey
snarkjs zkey export verificationkey ageCheck_0000.zkey verification_key.json
```

### 5. Deploy Smart Contracts

```bash
cd ../zksonic-contracts
npm install
npx hardhat run scripts/deploy.ts --network sonicTestnet
```

### 6. Run the development server

```bash
cd ../zksonic
npm run dev
```

Visit 👉 **https://zksonic.vercel.app/**

## 🔍 How it Works

1. **User creates a decentralized identity (DID)** and registers it on-chain
2. **User enters their date of birth** on the web interface
3. **A zero-knowledge proof is generated** that:
   - Proves age eligibility without revealing the actual DOB
   - Does not expose any personal information
   - Links the proof to their DID
4. **QR code is generated** on PC with session data and DID
5. **User scans with phone** - proof is verified against the circuit and DID
6. **Result returned**: ✅ Age eligible or ❌ Age ineligible

## 🧪 Testing

- **Try DOBs that meet age requirements** → Verification passes
- **Try DOBs that don't meet age requirements** → Verification fails
- **Test scanning QR** with mobile vs. polling on PC
- **Test different birth years** to verify age calculation

## 📡 API Endpoints

### `POST /api/generate-proof`

Generates circuit inputs for proof generation.

**Request Body:**

```json
{
  "birthYear": 2000,
  "birthMonth": 4,
  "birthDay": 4
}
```

**Response:**

```json
{
  "success": true,
  "circuitInputs": { ... },
  "challengeBytes32": "0x...",
  "didHash": "0x...",
  "age": 24
}
```

### `POST /api/verify/scan`

Processes scanned QR code and verifies proof.

**Request Body:**

```json
{
  "sessionId": "session_123",
  "proof": {
    "a": ["0x...", "0x..."],
    "b": [
      ["0x...", "0x..."],
      ["0x...", "0x..."]
    ],
    "c": ["0x...", "0x..."],
    "input": ["0x...", "0x...", "0x...", "0x...", "0x..."]
  }
}
```

### `GET /api/verify/status/[sessionId]`

Checks verification status for a session.

## 🚀 Deployment

### Vercel Deployment

1. Connect your GitHub repository to Vercel
2. Set environment variables in Vercel dashboard
3. Deploy automatically on push to main branch

### Environment Variables for Production

Ensure all environment variables from the `.env.local` file are set in your deployment platform.

## 🔧 Troubleshooting

### Common Issues

**"No QueryClient set" error:**

- This is a Next.js SSR issue. The app is configured to handle this automatically.

**"Invalid sender" error:**

- Ensure `SONIC_PRIVATE_KEY` is prefixed with `0x`
- Verify the private key has sufficient funds for gas

**"Challenge mismatch" error:**

- This indicates a bug in the AgeGate contract. The app now uses direct Groth16Verifier calls to bypass this issue.

**Build errors on Vercel:**

- Ensure all environment variables are set
- Check that the build completes successfully locally first

### Debug Mode

Enable debug logging by checking the browser console and server logs for detailed verification steps.

## 📜 License

MIT License – free to use and modify.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📞 Support

For issues and questions, please open an issue on GitHub or contact the development team.
