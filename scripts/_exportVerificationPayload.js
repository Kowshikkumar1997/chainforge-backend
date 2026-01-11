/**
 * ChainForge — Etherscan Verify Payload Exporter (Build-Time Only)
 *
 * Purpose:
 * - Export a deterministic, compiler-accurate Etherscan v2 verification payload
 *   ("solidity-standard-json-input") for a given compiled contract artifact.
 *
 * Why this exists:
 * - Etherscan verification requires the exact Standard JSON input and compiler version
 *   used to produce the deployed bytecode.
 * - In Hardhat projects, this information is stored under artifacts/build-info/*.json.
 *
 * Design guarantees:
 * - Never assumes the "latest" build-info file is correct.
 * - Deterministically finds the build-info file that actually contains the target
 *   contract (sourceName + contractName).
 * - Emits a stable payload under artifacts-precompiled/<artifactKey>.verify.json.
 *
 * Operational constraints:
 * - This module must run only in build-time tooling (local/CI), never in production runtime.
 */

const fs = require("fs");
const path = require("path");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function listBuildInfoFiles(buildInfoDir) {
  if (!fs.existsSync(buildInfoDir)) return [];
  return fs
    .readdirSync(buildInfoDir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => path.join(buildInfoDir, f));
}

/**
 * Finds the Hardhat build-info JSON that contains the compiled output entry
 * for the given sourceName + contractName.
 */
function findBuildInfoForContract({ buildInfoFiles, artifact }) {
  const targetBytecode = artifact.bytecode?.replace(/^0x/, "").toLowerCase();

  for (const filePath of buildInfoFiles) {
    const bi = readJson(filePath);
    const contracts = bi?.output?.contracts || {};

    // 1. Try exact sourceName + contractName match
    if (
      contracts[artifact.sourceName]?.[artifact.contractName]
    ) {
      return { filePath, buildInfo: bi };
    }

    // 2. Fallback: match by bytecode
    for (const src of Object.keys(contracts)) {
      for (const name of Object.keys(contracts[src])) {
        const compiled =
          contracts[src][name]?.evm?.bytecode?.object || "";
        if (compiled.toLowerCase() === targetBytecode) {
          return { filePath, buildInfo: bi };
        }
      }
    }
  }

  return null;
}


/**
 * Exports the verification payload for a single artifact descriptor.
 *
 * Expected artifact shape:
 * {
 *   artifactKey: "ERC721__base",
 *   contractName: "ERC721_base",
 *   sourceName: "contracts/__generated__/ERC721_base.sol"
 * }
 */
function exportVerifyPayload({ projectRoot, artifact }) {
  assert(projectRoot, "projectRoot is required");
  assert(artifact?.artifactKey, "artifact.artifactKey is required");
  assert(artifact?.contractName, "artifact.contractName is required");
  assert(artifact?.sourceName, "artifact.sourceName is required");

  const buildInfoDir = path.join(projectRoot, "artifacts", "build-info");
  const buildInfoFiles = listBuildInfoFiles(buildInfoDir);

  assert(
    buildInfoFiles.length > 0,
    `No build-info files found at: ${buildInfoDir}`
  );

  const match = findBuildInfoForContract({
    buildInfoFiles,
    artifact,
  });
  

  if (!match) {
    throw new Error(
      [
        "No matching build-info file found for contract.",
        `artifactKey: ${artifact.artifactKey}`,
        `sourceName: ${artifact.sourceName}`,
        `contractName: ${artifact.contractName}`,
        "",
        "This usually means one of:",
        "- Hardhat compile has not been run for this generated contract",
        "- artifact.sourceName/contractName do not match the compiled output keys",
        "- build-info directory was cleaned or is stale",
      ].join("\n")
    );
  }

  const { buildInfo } = match;

  // Prefer solcLongVersion when present (Etherscan-compatible),
  // fall back to solcVersion if needed.
  const solcLongVersion =
    buildInfo.solcLongVersion || buildInfo.solcVersion || null;

  assert(solcLongVersion, "build-info missing solc version (solcLongVersion/solcVersion)");
  assert(buildInfo.input, "build-info missing standard JSON input (input)");

  const payload = {
    artifactKey: artifact.artifactKey,
    contractName: artifact.contractName,
    sourceName: artifact.sourceName,

    // Etherscan expects compiler version formatted like "v0.8.20+commit...."
    compilerVersion: solcLongVersion.startsWith("v")
      ? solcLongVersion
      : `v${solcLongVersion}`,

    // The exact "solidity-standard-json-input"
    standardJsonInput: buildInfo.input,

    generatedAt: new Date().toISOString(),
  };

  const outPath = path.join(
    projectRoot,
    "artifacts-precompiled",
    `${artifact.artifactKey}.verify.json`
  );

  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf-8");
  console.log("[verify-export] wrote:", outPath);

  return outPath;
}

module.exports = { exportVerifyPayload };
