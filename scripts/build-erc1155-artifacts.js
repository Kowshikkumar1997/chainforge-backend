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
const { RUNTIME_BASE_DIR } = require("../utils/runtime");

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

    const artifactKey = `ERC1155__${v.key}`;
    const outFile = path.join(OUTPUT_DIR, `${artifactKey}.json`);
    
    fs.copyFileSync(artifactPath, outFile);
    console.log("[build:erc1155] →", outFile);
    exportVerifyPayload({
      artifactKey,
      contractName,
      sourceName: `contracts/__generated__/${contractName}.sol`,
    });

  }

  console.log("[build:erc1155] completed");
}
function exportVerifyPayload({ artifactKey, contractName, sourceName }) {
  const buildInfoDir = path.join(__dirname, "..", "artifacts", "build-info");

  const files = fs
    .readdirSync(buildInfoDir)
    .filter(f => f.endsWith(".json"))
    .map(f => ({
      name: f,
      path: path.join(buildInfoDir, f),
    }));

  if (!files.length) {
    throw new Error("No Hardhat build-info found");
  }

  let matched = null;

  for (const f of files) {
    const json = JSON.parse(fs.readFileSync(f.path, "utf-8"));
    if (json.input?.sources?.[sourceName]) {
      matched = json;
      break;
    }
  }

  if (!matched) {
    throw new Error(`No build-info matched source: ${sourceName}`);
  }

  const payload = {
    contractName,
    sourceName,
    compilerVersion: matched.solcLongVersion.startsWith("v")
      ? matched.solcLongVersion
      : `v${matched.solcLongVersion}`,
    standardJsonInput: matched.input,
    generatedAt: new Date().toISOString(),
  };

  const outPath = path.join(OUTPUT_DIR, `${artifactKey}.verify.json`);
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2));

  console.log("[build:erc1155] verify →", outPath);
}

main();
