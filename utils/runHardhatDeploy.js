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
 * - Hardhat is intentionally executed out-of-process to avoid
 *   provider/signer contamination inside the API runtime.
 * - execSync is used deliberately to ensure deterministic execution,
 *   strict failure propagation, and audit-friendly behavior.
 * - The locally installed Hardhat binary is used (not npx) to ensure
 *   compatibility with restricted production runtimes (e.g. Render).
 */

const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

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
     Runtime & Path Resolution
  ------------------------------------------------------------------- */

  /**
   * Render (and similar platforms) provide a writable ephemeral filesystem
   * under /tmp. This directory is configurable for local development but
   * defaults to a safe production location.
   */
  const RUNTIME_BASE_DIR = process.env.RUNTIME_BASE_DIR || "/tmp/chainforge";
  const projectRoot = path.join(__dirname, "..");

  // Path where the deployment script writes machine-readable output
  const resultPath = path.join(RUNTIME_BASE_DIR, "deploy-result.json");

  // Resolve the locally installed Hardhat binary
  const hardhatBin = path.join(
    projectRoot,
    "node_modules",
    ".bin",
    "hardhat"
  );

  // Ensure runtime directory exists
  if (!fs.existsSync(RUNTIME_BASE_DIR)) {
    fs.mkdirSync(RUNTIME_BASE_DIR, { recursive: true });
  }

  /* ------------------------------------------------------------------
     Environment Injection
  ------------------------------------------------------------------- */

  const env = {
  ...process.env, 
  CONTRACT_FILE: contractFile,
  CONTRACT_NAME: contractName,
  CONSTRUCTOR_ARGS: JSON.stringify(constructorArgs),
  RUNTIME_BASE_DIR: process.env.RUNTIME_BASE_DIR || "/tmp/chainforge",
};

  /* ------------------------------------------------------------------
     Deployment Execution
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
        timeout: 5 * 60 * 1000, // 5 minutes
        maxBuffer: 10 * 1024 * 1024,
      }
    );
    } catch (err) {
    const stdout = err?.stdout ? err.stdout.toString() : "";
    const stderr = err?.stderr ? err.stderr.toString() : "";
    const message = err?.message ? String(err.message) : "";

    const details = [message, stdout, stderr].filter(Boolean).join("\n");

    throw new Error(`Hardhat deployment failed:\n${details}`);
  }

  /* ------------------------------------------------------------------
     Deployment Result Consumption
  ------------------------------------------------------------------- */

  if (!fs.existsSync(resultPath)) {
    throw new Error(
      `Deployment output file not found.\nHardhat output:\n${output}`
    );
  }

  const deployResult = JSON.parse(
    fs.readFileSync(resultPath, "utf-8")
  );

  // Clean up ephemeral artifact
  fs.unlinkSync(resultPath);

  /* ------------------------------------------------------------------
     Optional Etherscan Verification
  ------------------------------------------------------------------- */

  let verified = false;

  try {
    const args = constructorArgs.map((arg) =>
      typeof arg === "string" ? `"${arg}"` : String(arg)
    );

    const verifyCommand =
      args.length > 0
        ? `${hardhatBin} verify --network ${network} ${deployResult.address} ${args.join(
            " "
          )}`
        : `${hardhatBin} verify --network ${network} ${deployResult.address}`;

    execSync(verifyCommand, {
      cwd: projectRoot,
      env: process.env,
      encoding: "utf-8",
      stdio: "pipe",
      timeout: 2 * 60 * 1000,
    });

    verified = true;
  } catch (_) {
    /**
     * Verification failure should not invalidate a successful deployment.
     * Common causes include:
     * - Indexing delay on Etherscan
     * - Transient API issues
     */
    verified = false;
  }

  /* ------------------------------------------------------------------
     Return Normalized Result
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
