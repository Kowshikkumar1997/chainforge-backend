/**
 * ChainForge — Hardhat Deployment Orchestrator
 * 
 * BUILD-ONLY UTILITY
 * 
 * This module must never be imported by runtime code.
 * Used exclusively for local compilation / tooling.
 * Responsibilities:
 * - Execute Hardhat from a locally-installed environment
 * - Compile runtime-generated Solidity contracts
 * - Deploy a single contract per invocation
 * - Emit a deterministic deployment artifact
 *
 * Architectural guarantees:
 * - Hardhat never compiles repository Solidity directly
 * - All Solidity sources live under RUNTIME_BASE_DIR
 * - Runtime artifacts never pollute the repository
 *
 * This module is intentionally minimal, explicit, and auditable.
 */


console.log("[BOOT] runHardhatDeploy loaded:", __filename);

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { RUNTIME_BASE_DIR } = require("./runtime");

/* ------------------------------------------------------------------
   Helpers
------------------------------------------------------------------- */

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/* ------------------------------------------------------------------
   Main
------------------------------------------------------------------- */

async function runHardhatDeploy({
  contractFile,
  contractName,
  constructorArgs = [],
  network = "sepolia",
}) {
  console.log("[deploy] runHardhatDeploy invoked", {
    contractFile,
    contractName,
    network,
    constructorArgs,
  });

  if (!contractFile || !contractName) {
    throw new Error(
      "Invalid deployment request: contractFile and contractName are required."
    );
  }

  ensureDir(RUNTIME_BASE_DIR);

  const generatedContractPath = path.join(
    RUNTIME_BASE_DIR,
    "generated_contracts",
    contractFile
  );

  if (!fs.existsSync(generatedContractPath)) {
    throw new Error(
      `Generated contract not found at runtime path: ${generatedContractPath}`
    );
  }

  const deployResultPath = path.join(
    RUNTIME_BASE_DIR,
    "deploy-result.json"
  );

  const repoRoot = path.join(__dirname, "..");
  const hardhatConfigPath = path.join(repoRoot, "hardhat.config.js");

  const hardhatBin =
    process.platform === "win32"
      ? path.join(repoRoot, "node_modules", ".bin", "hardhat.cmd")
      : path.join(repoRoot, "node_modules", ".bin", "hardhat");

  if (!fs.existsSync(hardhatBin)) {
    throw new Error(`Hardhat binary not found at: ${hardhatBin}`);
  }

  if (fs.existsSync(deployResultPath)) {
    fs.unlinkSync(deployResultPath);
  }

  const env = {
    ...process.env,
    CONTRACT_FILE: contractFile,
    CONTRACT_NAME: contractName,
    CONSTRUCTOR_ARGS: JSON.stringify(constructorArgs),
    RUNTIME_BASE_DIR,
    DEPLOY_RESULT_PATH: deployResultPath,
    HARDHAT_SHOW_STACK_TRACES: "true",
  };

  const args = [
    "run",
    "scripts/deploy.js",
    "--config",
    hardhatConfigPath,
    "--network",
    network,
    "--show-stack-traces",
  ];

  console.log("[deploy] executing Hardhat:", {
    command: hardhatBin,
    args: args.join(" "),
  });

  const result = spawnSync(hardhatBin, args, {
    cwd: repoRoot,
    env,
    stdio: "inherit",
    windowsHide: true,
    shell: true,
    timeout: 15 * 60 * 1000,
  });

  console.log("[deploy] hardhat exit status:", result.status);

  if (result.error) {
    throw new Error(`Hardhat execution error: ${result.error.message}`);
  }

  if (result.status !== 0) {
    throw new Error(`Hardhat failed with exit code: ${result.status}`);
  }

  if (!fs.existsSync(deployResultPath)) {
    throw new Error(
      `Deployment result not found at ${deployResultPath}. deploy.js did not emit output.`
    );
  }

  const deployResult = JSON.parse(
    fs.readFileSync(deployResultPath, "utf-8")
  );

  console.log("[deploy] deployment completed successfully", deployResult);

  return {
    address: deployResult.address,
    txHash: deployResult.txHash || null,
    deployerAddress: deployResult.deployerAddress || null,
    network: deployResult.network || network,

    constructorArgs: deployResult.constructorArgs || [],
    constructorArgsEncoded: deployResult.constructorArgsEncoded || "",

    deploymentPath: deployResultPath,
  };
}

module.exports = runHardhatDeploy;
