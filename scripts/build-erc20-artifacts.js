/**
 * ChainForge — ERC20 Artifact Builder (Build-Time Only)
 *
 * Responsibilities:
 * - Generate supported ERC20 Solidity variants
 * - Compile with Hardhat
 * - Export runtime deployment artifacts
 * - Export Etherscan verification payloads
 *
 * This script must never run in production environments.
 */

const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");

const { generateContract } = require("../utils/generateSolidityContract");
const { exportVerifyPayload } = require("./_exportVerificationPayload.js");

const REPO_ROOT = path.join(__dirname, "..");
const GENERATED_DIR = path.join(REPO_ROOT, "contracts", "__generated__");
const OUTPUT_DIR = path.join(REPO_ROOT, "artifacts-precompiled");

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function cleanDirFilesOnly(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    const stat = fs.statSync(full);
    if (stat.isFile()) fs.unlinkSync(full);
  }
}

/**
 * ERC20 variants
 */
const VARIANTS = [
  { key: "base", modules: [] },
  { key: "mintable", modules: ["mintable"] },
  { key: "burnable", modules: ["burnable"] },
  { key: "pausable", modules: ["pausable"] },
  { key: "burnable_mintable", modules: ["burnable", "mintable"] },
  { key: "mintable_pausable", modules: ["mintable", "pausable"] },
  { key: "burnable_pausable", modules: ["burnable", "pausable"] },
  { key: "burnable_mintable_pausable", modules: ["burnable", "mintable", "pausable"] },
  { key: "governance", modules: ["governance"] },
];

function artifactPathFor(contractName) {
  return path.join(
    REPO_ROOT,
    "artifacts",
    "contracts",
    "__generated__",
    `${contractName}.sol`,
    `${contractName}.json`
  );
}

function main() {
  ensureDir(GENERATED_DIR);
  ensureDir(OUTPUT_DIR);

  console.log("[build:erc20] starting");

  if (!process.argv.includes("--no-clean")) {
    cleanDirFilesOnly(GENERATED_DIR);
  }

  console.log("[build:erc20] generating solidity variants");

  for (const variant of VARIANTS) {
    const contractName = `ERC20_${variant.key}`;

    generateContract(
      {
        type: "ERC20",
        tokenName: contractName,
        tokenSymbol: "TMP",
        modules: variant.modules,
      },
      { outputDir: GENERATED_DIR }
    );

    console.log("[build:erc20] generated:", contractName);
  }

  console.log("[build:erc20] compiling (hardhat)");

  const hardhatBin =
    process.platform === "win32"
      ? path.join(REPO_ROOT, "node_modules", ".bin", "hardhat.cmd")
      : path.join(REPO_ROOT, "node_modules", ".bin", "hardhat");

  if (!fs.existsSync(hardhatBin)) {
    throw new Error(`Hardhat binary not found at ${hardhatBin}`);
  }

  execSync(`"${hardhatBin}" compile`, { stdio: "inherit" });

  console.log("[build:erc20] exporting artifacts + verification payloads");

  for (const variant of VARIANTS) {
    const contractName = `ERC20_${variant.key}`;
    const artifactKey = `ERC20__${variant.key}`;

    const src = artifactPathFor(contractName);

    if (!fs.existsSync(src)) {
      throw new Error(`[build:erc20] missing hardhat artifact: ${src}`);
    }

    const dest = path.join(OUTPUT_DIR, `${artifactKey}.json`);
    fs.copyFileSync(src, dest);

    console.log("[build:erc20] exported artifact:", dest);

    // ---- Verification payload export ----
    exportVerifyPayload({
      projectRoot: REPO_ROOT,
      artifact: {
        artifactKey,
        contractName,
        sourceName: `contracts/__generated__/${contractName}.sol`,
      },
    });
  }

  console.log("[build:erc20] completed successfully");
}

main();
