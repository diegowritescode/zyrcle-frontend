const hre = require("hardhat");
const fs = require("fs");
const { ethers } = hre;

async function main() {
  const dep = JSON.parse(fs.readFileSync(__dirname + "/../deployments.json"));
  const c = dep.contracts;
  for (const [name, addr] of Object.entries(c)) {
    const code = await ethers.provider.getCode(addr);
    console.log(`${name.padEnd(18)} ${addr}  ${code !== "0x" ? "✅ deployed" : "❌ NO CODE"}`);
  }
  const token = await ethers.getContractAt("ZyrcleToken", c.ZyrcleToken);
  const cert  = await ethers.getContractAt("ZyrcleCertificate", c.ZyrcleCertificate);
  const core  = await ethers.getContractAt("ZyrcleCore", c.ZyrcleCore);

  const MINTER = await token.MINTER_ROLE();
  console.log("\nCore has MINTER_ROLE on Token:      ", (await token.hasRole(MINTER, c.ZyrcleCore)) ? "✅" : "❌");
  console.log("Core has MINTER_ROLE on Certificate:", (await cert.hasRole(await cert.MINTER_ROLE(), c.ZyrcleCore)) ? "✅" : "❌");
  console.log("Core.token() linked:      ", (await core.token()).toLowerCase() === c.ZyrcleToken.toLowerCase() ? "✅" : "❌");
  console.log("Core.certificate() linked:", (await core.certificate()).toLowerCase() === c.ZyrcleCertificate.toLowerCase() ? "✅" : "❌");

  const uris = {
    Bronze: "ipfs://bafkreiepxu3mqhu47q35p2fw2eb4gqtkogi3xnko7nxq7z4azwvt64rbgu",
    Silver: "ipfs://bafkreibc3z3545claecbpjhvu3nmxb7o3ewqafavpt4xst3kk6nuf4glui",
    Gold:   "ipfs://bafkreidtbeo2bu2tb5ztwifnnsd4fxumhevfbkto37grwvl6kdo2mowp2e",
  };
  console.log("\nCertificate prices:");
  for (const [lvl, uri] of Object.entries(uris)) {
    const p = await core.certificatePrice(ethers.keccak256(ethers.toUtf8Bytes(uri)));
    console.log(`  ${lvl.padEnd(7)} ${ethers.formatEther(p)} ZYR`);
  }
  console.log("\nDeployer ZYR balance:", ethers.formatEther(await token.balanceOf(dep.deployer)), "ZYR");
}
main().catch(e => { console.error("ERR:", e.message); process.exit(1); });
