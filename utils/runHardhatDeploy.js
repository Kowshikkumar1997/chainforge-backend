/**
 * ChainForge — Hardhat Deployment Orchestrator
 *
 * Responsibilities:
 * - Execute Hardhat as an isolated child process for contract deployment
 * - Inject deployment context via environment variables
 * - Consume machine-readable deployment artifacts
 * - Perform optional Etherscan verification
 *
 * Architectural Notes:
 * - Hardhat is executed out-of-process to avoid runtime contamination
 * - A single runtime directory is used as the source of truth
 * - execSync is intentional for deterministic, auditable execution
 */

const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const { RUNTIME_BASE_DIR } = require("./runtime");

async function runHardhatDeploy({
  contractFile,
  contractName,
  constructorArgs = [],
  network = "sepolia",
}) {
  if (!contractFile || !contractName) {
    throw new Error("Missing required deployment parameters.");
  }

  /* ------------------------------------------------------------------
     Runtime & Path Resolution (SINGLE SOURCE OF TRUTH)
  ------------------------------------------------------------------- */

  const projectRoot = path.join(__dirname, "..");

  // Ensure runtime base directory exists
  if (!fs.existsSync(RUNTIME_BASE_DIR)) {
    fs.mkdirSync(RUNTIME_BASE_DIR, { recursive: true });
  }

  const deployResultPath = path.join(
    RUNTIME_BASE_DIR,
    "deploy-result.json"
  );

  const hardhatBin = path.join(
    projectRoot,
    "node_modules",
    ".bin",
    "hardhat"
  );

  /* ------------------------------------------------------------------
     Environment Injection
  ------------------------------------------------------------------- */

  const env = {
    ...process.env,
    CONTRACT_FILE: contractFile,
    CONTRACT_NAME: contractName,
    CONSTRUCTOR_ARGS: JSON.stringify(constructorArgs),
    RUNTIME_BASE_DIR,
    DEPLOY_RESULT_PATH: deployResultPath,
  };

  /* ------------------------------------------------------------------
     Hardhat Execution
  ------------------------------------------------------------------- */

  let output;

  try {
    output = execSync(
      `${hardhatBin} run scripts/deploy.js --network ${network}`,
      {
        cwd: projectRoot,
        env,
        encoding: "utf-8",
        stdio: "pipe",
        timeout: 5 * 60 * 1000,
        maxBuffer: 10 * 1024 * 1024,
      }
    );
  } catch (err) {
    const stdout = err?.stdout?.toString() || "";
    const stderr = err?.stderr?.toString() || "";
    const message = err?.message || "";

    throw new Error(
      `Hardhat deployment failed:\n${[message, stdout, stderr]
        .filter(Boolean)
        .join("\n")}`
    );
  }

  /* ------------------------------------------------------------------
     Deployment Result Consumption
  ------------------------------------------------------------------- */

  if (!fs.existsSync(deployResultPath)) {
    throw new Error(
      `Deployment output file not found.\nHardhat output:\n${output}`
    );
  }

  const deployResult = JSON.parse(
    fs.readFileSync(deployResultPath, "utf-8")
  );

  fs.unlinkSync(deployResultPath);

  /* ------------------------------------------------------------------
     Optional Etherscan Verification
  ------------------------------------------------------------------- */

  let verified = false;

  try {
    const args = constructorArgs.map((arg) =>
      typeof arg === "string" ? `"${arg}"` : String(arg)
    );

    const verifyCmd =
      args.length > 0
        ? `${hardhatBin} verify --network ${network} ${deployResult.address} ${args.join(" ")}`
        : `${hardhatBin} verify --network ${network} ${deployResult.address}`;

    execSync(verifyCmd, {
      cwd: projectRoot,
      env: process.env,
      encoding: "utf-8",
      stdio: "pipe",
      timeout: 2 * 60 * 1000,
    });

    verified = true;
  } catch {
    verified = false;
  }

  /* ------------------------------------------------------------------
     Normalized Return
  ------------------------------------------------------------------- */

  return {
    address: deployResult.address,
    txHash: deployResult.txHash || null,
    deployerAddress: deployResult.deployerAddress || null,
    network: deployResult.network || network,
    verified,
  };
}

module.exports = runHardhatDeploy;