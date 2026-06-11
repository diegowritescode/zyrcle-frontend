const { expect } = require("chai");
const { ethers } = require("hardhat");

const BRONZE_URI = "ipfs://bronze";

async function deployAll() {
  const [admin, verifier, user, collector] = await ethers.getSigners();

  const token = await (await ethers.getContractFactory("ZyrcleToken")).deploy(admin.address);
  const cert = await (await ethers.getContractFactory("ZyrcleCertificate")).deploy(admin.address);
  const core = await (await ethers.getContractFactory("ZyrcleCore")).deploy(
    await token.getAddress(),
    await cert.getAddress()
  );

  await token.grantRole(await token.MINTER_ROLE(), await core.getAddress());
  await cert.grantRole(await cert.MINTER_ROLE(), await core.getAddress());

  return { token, cert, core, admin, verifier, user, collector };
}

describe("Zyrcle", () => {
  it("rewards a user when a deposited waste event is verified", async () => {
    const { token, core, verifier, user } = await deployAll();
    await core.grantRole(await core.VERIFIER_ROLE(), verifier.address);

    await core.connect(user).depositWaste(5n);
    expect(await token.balanceOf(user.address)).to.equal(0n);

    await core.connect(verifier).verifyEvent(0);
    // rewardPerKg defaults to 1e18, weight 5 -> 5 ZYR
    expect(await token.balanceOf(user.address)).to.equal(ethers.parseEther("5"));

    // `getEvent` collides with ethers' built-in helper, so call it explicitly.
    const ev = await core.getFunction("getEvent").staticCall(0);
    expect(ev.verified).to.equal(true);
  });

  it("blocks a normal wallet from minting certificates directly (gap #2)", async () => {
    const { cert, user } = await deployAll();
    await expect(
      cert.connect(user).safeMint(user.address, BRONZE_URI)
    ).to.be.revertedWithCustomError(cert, "AccessControlUnauthorizedAccount");
  });

  it("lets a user buy a certificate by spending ZYR (gaps #1 + #2)", async () => {
    const { token, cert, core, admin, user } = await deployAll();
    const price = ethers.parseEther("50");
    await core.setCertificatePrice(BRONZE_URI, price);

    // Give the user ZYR and approve the Core to spend it.
    await token.mint(user.address, ethers.parseEther("100"));
    await token.connect(user).approve(await core.getAddress(), price);

    await core.connect(user).purchaseCertificate(BRONZE_URI);

    expect(await cert.balanceOf(user.address)).to.equal(1n);
    expect(await cert.tokenURI(0)).to.equal(BRONZE_URI);
    expect(await token.balanceOf(user.address)).to.equal(ethers.parseEther("50"));
    // treasury (admin) received the payment
    expect(await token.balanceOf(admin.address)).to.equal(price);
  });

  it("reverts a purchase without enough ZYR allowance/balance", async () => {
    const { core, user } = await deployAll();
    await core.setCertificatePrice(BRONZE_URI, ethers.parseEther("50"));
    await expect(core.connect(user).purchaseCertificate(BRONZE_URI)).to.be.reverted;
  });

  it("aggregates container weights into a delivery batch", async () => {
    const { core, collector } = await deployAll();
    await core.confirmCollection(collector.address, 1, "Plastic", "cid1", 7000);
    await core.confirmCollection(collector.address, 2, "Glass", "cid2", 3000);

    await expect(core.connect(collector).submitBatchDelivery([1, 2]))
      .to.emit(core, "BatchDelivered");

    const batch = await core.batches(0);
    expect(batch.totalWeight).to.equal(10000n);
  });
});
