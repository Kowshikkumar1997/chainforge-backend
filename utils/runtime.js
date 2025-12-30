/**
 * Runtime filesystem configuration
 *
 * All generated artifacts, deployment metadata, and temporary
 * Hardhat outputs MUST live in a writable, ephemeral directory.
 *
 * On Render, /tmp is the only safe location for runtime writes.
 */

const fs = require("fs");
const path = require("path");

const RUNTIME_BASE_DIR =
  process.env.RUNTIME_BASE_DIR || "/tmp/chainforge";

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

const deploymentsDir = path.join(RUNTIME_BASE_DIR, "deployments");
const generatedContractsDir = path.join(
  RUNTIME_BASE_DIR,
  "generated_contracts"
);
const generatedChainsDir = path.join(
  RUNTIME_BASE_DIR,
  "generated_chains"
);

[
  RUNTIME_BASE_DIR,
  deploymentsDir,
  generatedContractsDir,
  generatedChainsDir,
].forEach(ensureDir);

module.exports = {
  RUNTIME_BASE_DIR,
  deploymentsDir,
  generatedContractsDir,
  generatedChainsDir,
};