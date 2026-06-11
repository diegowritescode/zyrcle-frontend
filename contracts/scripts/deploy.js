const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

// The 3 marketplace certificates (URIs must match the frontend's ProductGrid).
const CERTIFICATES = [
  { level: "Bronze", uri: "ipfs://bafkreiepxu3mqhu47q35p2fw2eb4gqtkogi3xnko7nxq7z4azwvt64rbgu", price: "50" },
  { level: "Silver", uri: "ipfs://bafkreibc3z3545claecbpjhvu3nmxb7o3ewqafavpt4xst3kk6nuf4glui", price: "100" },
  { level: "Gold", uri: "ipfs://bafkreidtbeo2bu2tb5ztwifnnsd4fxumhevfbkto37grwvl6kdo2mowp2e", price: "200" },
];

async function main() {
  const { ethers, network } = hre;
  const [deployer] = await ethers.getSigners();
  console.log(`Network: ${network.name}`);
  console.log(`Deployer: ${deployer.address}`);

  // 1. Token
  const Token = await ethers.getContractFactory("ZyrcleToken");
  const token = await Token.deploy(deployer.address);
  await token.waitForDeployment();
  const tokenAddr = await token.getAddress();
  console.log(`ZyrcleToken:       ${tokenAddr}`);

  // 2. Certificate
  const Cert = await ethers.getContractFactory("ZyrcleCertificate");
  const cert = await Cert.deploy(deployer.address);
  await cert.waitForDeployment();
  const certAddr = await cert.getAddress();
  console.log(`ZyrcleCertificate: ${certAddr}`);

  // 3. Core
  const Core = await ethers.getContractFactory("ZyrcleCore");
  const core = await Core.deploy(tokenAddr, certAddr);
  await core.waitForDeployment();
  const coreAddr = await core.getAddress();
  console.log(`ZyrcleCore:        ${coreAddr}`);

  // 4. Wire roles: Core must be able to mint tokens (rewards) and certificates.
  const MINTER_ROLE = await token.MINTER_ROLE();
  await (await token.grantRole(MINTER_ROLE, coreAddr)).wait();
  await (await cert.grantRole(await cert.MINTER_ROLE(), coreAddr)).wait();
  console.log("Granted MINTER_ROLE on token + certificate to Core");

  // 5. Seed marketplace certificate prices.
  for (const c of CERTIFICATES) {
    await (await core.setCertificatePrice(c.uri, ethers.parseEther(c.price))).wait();
    console.log(`Price set: ${c.level} = ${c.price} ZYR`);
  }

  // 6. Mint some ZYR to the deployer so the purchase flow can be tested immediately.
  await (await token.mint(deployer.address, ethers.parseEther("1000"))).wait();
  console.log("Minted 1000 ZYR to deployer for testing");

  // 7. Persist addresses + sync ABIs to the frontend.
  const deployment = {
    network: network.name,
    chainId: Number((await ethers.provider.getNetwork()).chainId),
    deployer: deployer.address,
    contracts: { ZyrcleToken: tokenAddr, ZyrcleCertificate: certAddr, ZyrcleCore: coreAddr },
  };
  fs.writeFileSync(path.join(__dirname, "..", "deployments.json"), JSON.stringify(deployment, null, 2));
  console.log("Wrote deployments.json");

  syncFrontend(deployment);
}

function syncFrontend(deployment) {
  // contracts/ lives inside the frontend repo: scripts/ -> contracts/ -> FRONTEND-ZYRCLE
  const feRoot = path.join(__dirname, "..", "..");
  if (!fs.existsSync(feRoot)) {
    console.warn("Frontend not found; skipping sync.");
    return;
  }

  // Copy compiled ABIs into the frontend.
  const abiDir = path.join(feRoot, "src", "lib", "abi");
  fs.mkdirSync(abiDir, { recursive: true });
  for (const name of ["ZyrcleToken", "ZyrcleCertificate", "ZyrcleCore"]) {
    const artifact = require(path.join(__dirname, "..", "artifacts", "contracts", `${name}.sol`, `${name}.json`));
    fs.writeFileSync(path.join(abiDir, `${name}.json`), JSON.stringify(artifact.abi, null, 2));
  }
  console.log("Copied ABIs to frontend src/lib/abi/");

  // Update the frontend .env with the deployed addresses + chain id.
  const envPath = path.join(feRoot, ".env");
  let env = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
  const upsert = (key, value) => {
    const line = `${key}=${value}`;
    env = new RegExp(`^${key}=.*$`, "m").test(env)
      ? env.replace(new RegExp(`^${key}=.*$`, "m"), line)
      : (env.endsWith("\n") || env === "" ? env : env + "\n") + line + "\n";
  };
  upsert("VITE_CHAIN_ID", deployment.chainId);
  upsert("VITE_TOKEN_ADDRESS", deployment.contracts.ZyrcleToken);
  upsert("VITE_CERTIFICATE_ADDRESS", deployment.contracts.ZyrcleCertificate);
  upsert("VITE_CORE_ADDRESS", deployment.contracts.ZyrcleCore);
  fs.writeFileSync(envPath, env);
  console.log("Updated frontend .env with contract addresses");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
