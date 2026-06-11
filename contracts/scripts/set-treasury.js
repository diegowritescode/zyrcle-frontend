const hre = require("hardhat");
const fs = require("fs");
const { ethers } = hre;

// Burn address: ZYR spent on certificates is removed from circulation, so the
// buyer's balance visibly decreases (the deployer was both buyer AND treasury).
const TREASURY = "0x000000000000000000000000000000000000dEaD";

async function main() {
  const dep = JSON.parse(fs.readFileSync(__dirname + "/../deployments.json"));
  const core = await ethers.getContractAt("ZyrcleCore", dep.contracts.ZyrcleCore);

  console.log("Current treasury:", await core.treasury());
  const tx = await core.setTreasury(TREASURY);
  await tx.wait();
  console.log("New treasury:    ", await core.treasury(), "✅");
}
main().catch((e) => { console.error("ERR:", e.message); process.exit(1); });
