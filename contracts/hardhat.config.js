require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const FUJI_RPC_URL = process.env.FUJI_RPC_URL || "https://api.avax-test.network/ext/bc/C/rpc";
const PRIVATE_KEY = process.env.PRIVATE_KEY;

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      // Avalanche C-Chain supports Cancun (Durango upgrade); OZ v5 uses mcopy.
      evmVersion: "cancun",
    },
  },
  networks: {
    // Avalanche Fuji C-Chain testnet (chainId 43113)
    fuji: {
      url: FUJI_RPC_URL,
      chainId: 43113,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
    },
    // `npx hardhat node` then deploy:local
    localhost: {
      url: "http://127.0.0.1:8545",
    },
  },
};
