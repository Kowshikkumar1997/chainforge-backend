/**
 * ChainForge — ERC721 Artifact Builder (Local Only)
 *
 * Purpose:
 * - Generate supported ERC721 variants into contracts/__generated__
 * - Compile once using Hardhat (local)
 * - Export production artifacts into artifacts-precompiled/
 *
 * Constraints:
 * - This script must never run in production
 * - Runtime deployments must consume only artifacts-precompiled/
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
    if (fs.statSync(full).isFile()) fs.unlinkSync(full);
  }
}

/**
 * Supported ERC721 variants (Phase 1)
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

  console.log("[build:erc721] starting");

  cleanDirFilesOnly(GENERATED_DIR);

  console.log("[build:erc721] generating solidity variants");

  for (const variant of VARIANTS) {
    const contractName = `ERC721_${variant.key}`;

    generateContract(
      {
        type: "ERC721",
        tokenName: contractName,
        tokenSymbol: "NFT",
        modules: variant.modules,
      },
      { outputDir: GENERATED_DIR }
    );

    console.log("[build:erc721] generated:", contractName);
  }

  console.log("[build:erc721] compiling (hardhat)");
  const hardhatBin =
  process.platform === "win32"
    ? path.join(REPO_ROOT, "node_modules", ".bin", "hardhat.cmd")
    : path.join(REPO_ROOT, "node_modules", ".bin", "hardhat");

if (!fs.existsSync(hardhatBin)) {
  throw new Error(`Hardhat binary not found at ${hardhatBin}`);
}

execSync(`"${hardhatBin}" compile`, { stdio: "inherit" });

  console.log("[build:erc721] exporting artifacts");

  for (const variant of VARIANTS) {
    const contractName = `ERC721_${variant.key}`;
    const src = artifactPathFor(contractName);

    if (!fs.existsSync(src)) {
      throw new Error(`[build:erc721] missing hardhat artifact: ${src}`);
    }

    const dest = path.join(OUTPUT_DIR, `ERC721__${variant.key}.json`);
    fs.copyFileSync(src, dest);

    console.log("[build:erc721] exported:", dest);
  }

  console.log("[build:erc721] completed successfully");
}

main();
