/**
 * ChainForge — ERC20 Artifact Builder (Local Only)
 *
 * Purpose:
 * - Generate supported ERC20 variants deterministically into contracts/__generated__
 * - Compile once using Hardhat (local)
 * - Export production artifacts into artifacts-precompiled/
 *
 * Operational constraints:
 * - This script must never run in production (Render)
 * - Only artifacts-precompiled/ is intended to be committed for runtime deployments
 */

const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");

const { generateContract } = require("../utils/generateSolidityContract");

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
 * Governance is treated as standalone in Phase 1.
 * This avoids mixing incompatible role/control assumptions.
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

  // Standalone
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
  console.log("[build:erc20] generated dir:", GENERATED_DIR);
  console.log("[build:erc20] output dir:", OUTPUT_DIR);

  // Keep __generated__ deterministic for builds
  console.log("[build:erc20] cleaning contracts/__generated__ (files only)");
  cleanDirFilesOnly(GENERATED_DIR);

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

    console.log("[build:erc20] generated:", contractName, "modules:", variant.modules);
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

  console.log("[build:erc20] exporting artifacts");

  for (const variant of VARIANTS) {
    const contractName = `ERC20_${variant.key}`;
    const src = artifactPathFor(contractName);

    if (!fs.existsSync(src)) {
      throw new Error(`[build:erc20] missing hardhat artifact: ${src}`);
    }

    const dest = path.join(OUTPUT_DIR, `ERC20__${variant.key}.json`);
    fs.copyFileSync(src, dest);

    console.log("[build:erc20] exported:", dest);
  }

  console.log("[build:erc20] completed successfully");
}

main();
