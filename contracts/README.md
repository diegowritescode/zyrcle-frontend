# Zyrcle Contracts

Smart contracts for the Zyrcle recycling dApp, **reconstructed from the frontend ABIs**
(the original Solidity source was never committed). Built with Hardhat + OpenZeppelin v5.

## Contracts

| Contract | Type | Purpose |
|---|---|---|
| `ZyrcleToken` (ZYR) | ERC-20 + AccessControl | Reward token. `mint` gated by `MINTER_ROLE` (granted to Core). |
| `ZyrcleCertificate` (ZCC) | ERC-721 + URIStorage + Enumerable + AccessControl | Carbon-credit NFT. `safeMint` gated by `MINTER_ROLE` (granted to Core). |
| `ZyrcleCore` | AccessControl | Orchestrator: `depositWaste` → `verifyEvent` (reward), `confirmCollection` / `submitBatchDelivery`, `issueCertificate`, and `purchaseCertificate` (spend ZYR → mint NFT). |

### How the gaps were fixed
- **Gap #1 (no token charge):** `ZyrcleCore.purchaseCertificate(uri)` enforces an on-chain price and pulls ZYR from the buyer before minting.
- **Gap #2 (mint role):** minting flows through Core, which holds `MINTER_ROLE`. Users no longer call `safeMint` directly (which reverted).
- **Gap #3 (block-range scan):** `ZyrcleCertificate` is `ERC721Enumerable`, so the dApp lists a wallet's certificates with `balanceOf` + `tokenOfOwnerByIndex` — no event scanning.

## Setup

```bash
cd Contracts
npm install
cp .env.example .env   # then fill in PRIVATE_KEY
```

## Test (local, no network needed)

```bash
npm test
```

## Deploy to Avalanche Fuji

1. **Create a throwaway deployer wallet** in MetaMask and export its private key into `Contracts/.env`:
   ```
   PRIVATE_KEY=0xyour_test_key
   ```
2. **Fund it with test AVAX** from the faucet: https://faucet.avax.network (select *Fuji C-Chain*; coupon-free faucets also exist).
3. **Add Fuji to MetaMask** (Network name: Avalanche Fuji C-Chain, RPC `https://api.avax-test.network/ext/bc/C/rpc`, Chain ID `43113`, symbol `AVAX`, explorer `https://testnet.snowtrace.io`).
4. **Deploy:**
   ```bash
   npm run deploy:fuji
   ```

The deploy script automatically:
- deploys the 3 contracts and grants Core the `MINTER_ROLE` on token + certificate,
- seeds the 3 marketplace certificate prices (Bronze 50 / Silver 100 / Gold 200 ZYR),
- mints 1000 ZYR to the deployer for testing,
- writes `deployments.json`,
- copies the compiled ABIs into `../Frontend/FRONTEND-ZYRCLE/src/lib/abi/`,
- writes the deployed addresses + chainId into the frontend `.env` (`VITE_TOKEN_ADDRESS`, `VITE_CERTIFICATE_ADDRESS`, `VITE_CORE_ADDRESS`, `VITE_CHAIN_ID`).

After deploying, restart the frontend dev server so it picks up the new `.env`.

## Local deploy (optional, for development)

```bash
npx hardhat node          # terminal 1
npm run deploy:local      # terminal 2  (writes localhost addresses to the frontend .env)
```
Add the local network to MetaMask (RPC `http://127.0.0.1:8545`, Chain ID `31337`).
