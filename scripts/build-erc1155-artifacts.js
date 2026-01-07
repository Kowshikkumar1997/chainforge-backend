/**
 * ChainForge — ERC1155 Artifact Builder (Local Only)
 *
 * Purpose:
 * - Generate supported ERC1155 variants deterministically
 * - Compile via Hardhat (local)
 * - Export precompiled runtime artifacts (ABI + bytecode)
 *
 * This script must never be executed in production.
 */

const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");
const { generateContract } = require("../utils/generateSolidityContract");

const GENERATED_DIR = path.join(__dirname, "..", "contracts", "__generated__");
const OUTPUT_DIR = path.join(__dirname, "..", "artifacts-precompiled");

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

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

function main() {
  ensureDir(GENERATED_DIR);
  ensureDir(OUTPUT_DIR);

  console.log("[build:erc1155] generating contracts into:", GENERATED_DIR);

  for (const v of VARIANTS) {
    const contractName = `ERC1155_${v.key}`;

    generateContract(
      {
        type: "ERC1155",
        tokenName: contractName,
        baseURI: "ipfs://example/{id}.json",
        modules: v.modules,
      },
      { outputDir: GENERATED_DIR }
    );
  }

  console.log("[build:erc1155] compiling with Hardhat");
  execSync("npx hardhat compile", { stdio: "inherit" });

  console.log("[build:erc1155] exporting artifacts");

  for (const v of VARIANTS) {
    const contractName = `ERC1155_${v.key}`;

    const artifactPath = path.join(
      __dirname,
      "..",
      "artifacts",
      "contracts",
      "__generated__",
      `${contractName}.sol`,
      `${contractName}.json`
    );

    if (!fs.existsSync(artifactPath)) {
      throw new Error(`Missing artifact: ${artifactPath}`);
    }

    const outFile = path.join(OUTPUT_DIR, `ERC1155__${v.key}.json`);
    fs.copyFileSync(artifactPath, outFile);

    console.log("[build:erc1155] →", outFile);
  }

  console.log("[build:erc1155] completed");
}

main();
