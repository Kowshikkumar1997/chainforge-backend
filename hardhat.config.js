require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const path = require("path");

const RUNTIME_BASE_DIR =
  process.env.RUNTIME_BASE_DIR && process.env.RUNTIME_BASE_DIR.length > 0
    ? process.env.RUNTIME_BASE_DIR
    : "/tmp/chainforge";

console.log("[hardhat-config] Using runtime base:", RUNTIME_BASE_DIR);

module.exports = {
  solidity: "0.8.20",

  paths: {
    sources: path.join(RUNTIME_BASE_DIR, "generated_contracts"),
    artifacts: path.join(RUNTIME_BASE_DIR, "artifacts"),
    cache: path.join(RUNTIME_BASE_DIR, "cache"),
  },

  networks: {
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL,
      accounts: process.env.DEPLOYER_PRIVATE_KEY
        ? [process.env.DEPLOYER_PRIVATE_KEY]
        : [],
    },
  },

  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
};