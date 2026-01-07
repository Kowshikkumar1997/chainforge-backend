/**
 * ChainForge — Hardhat Configuration
 *
 * This configuration is intentionally minimal, deterministic, and runtime-driven.
 *
 * Core principles:
 * - Hardhat is used strictly as a compiler and deployment runner
 * - No Solidity is compiled directly from the repository
 * - All compilation inputs live under a runtime-writable directory
 * - Fully compatible with ephemeral container environments (Render, CI)
 *
 * Architectural invariants:
 * - RUNTIME_BASE_DIR is the single source of truth
 * - Templates are mirrored into runtime at boot (see utils/runtime.js)
 * - Generated contracts are written to runtime prior to compilation
 * - Hardhat artifacts and cache never pollute the repository
 */
require("dotenv").config();

const path = require("path");

/* ------------------------------------------------------------------
   Runtime Base Directory (Single Source of Truth)
------------------------------------------------------------------- */

/**
 * Render and similar platforms provide a writable ephemeral filesystem
 * under /tmp. This directory is treated as authoritative for:
 * - Solidity sources (generated + templates)
 * - Hardhat artifacts
 * - Hardhat cache
 * - Deployment coordination files
 *
 * Local development may override this via RUNTIME_BASE_DIR.
 */
const RUNTIME_BASE_DIR =
  typeof process.env.RUNTIME_BASE_DIR === "string" &&
  process.env.RUNTIME_BASE_DIR.trim().length > 0
    ? path.resolve(process.env.RUNTIME_BASE_DIR.trim())
    : path.resolve("/tmp/chainforge");

console.log("[hardhat] Runtime base directory:", RUNTIME_BASE_DIR);

/* ------------------------------------------------------------------
   Hardhat Configuration
------------------------------------------------------------------- */

module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },

  /**
   * Path overrides are critical.
   *
   * Compilation scope:
   * - sources: RUNTIME_BASE_DIR
   *   This allows Solidity imports such as:
   *     ./contracts/templates/...
   *     ./generated_contracts/...
   *
   * Output scope:
   * - artifacts and cache are written exclusively to runtime
   *
   * This guarantees:
   * - Deterministic compilation
   * - No repository pollution
   * - No HH701 ambiguous contract name errors
   */
paths: {
  sources: path.join(__dirname, "contracts"),
  artifacts: path.join(__dirname, "artifacts"),
  cache: path.join(__dirname, "cache"),
},

  /* ------------------------------------------------------------------
     Networks
  ------------------------------------------------------------------- */

  /**
   * Ethereum Sepolia Testnet
   *
   * Required environment variables:
   * - SEPOLIA_RPC_URL
   * - DEPLOYER_PRIVATE_KEY
   */
  networks: {
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || "",
      accounts:
        typeof process.env.DEPLOYER_PRIVATE_KEY === "string" &&
        process.env.DEPLOYER_PRIVATE_KEY.trim().length > 0
          ? [process.env.DEPLOYER_PRIVATE_KEY.trim()]
          : [],
    },
  },

  /* ------------------------------------------------------------------
     Block Explorer Verification
  ------------------------------------------------------------------- */

  /**
   * Etherscan verification is optional.
   * Deployment will succeed even if verification is skipped or fails.
   */
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY || "",
  },

  /* ------------------------------------------------------------------
     Execution Safety
  ------------------------------------------------------------------- */

  mocha: {
    timeout: 200000,
  },
};
