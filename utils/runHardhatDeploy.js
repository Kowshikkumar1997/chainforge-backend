/**
 * Hardhat Deployment Orchestrator
 *
 * Responsibility:
 * - Spawn Hardhat as a child process for contract deployment
 * - Pass deployment context via environment variables
 * - Parse machine-readable deployment output
 * - Optionally verify deployed contracts on Etherscan
 *
 * Note:
 * Hardhat is intentionally not imported directly to avoid
 * in-process network context and signer issues.
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

  const projectRoot = path.join(__dirname, "..");
  const resultPath = path.join(projectRoot, "deploy-result.json");

  const env = {
    ...process.env,
    CONTRACT_FILE: contractFile,
    CONTRACT_NAME: contractName,
    CONSTRUCTOR_ARGS: JSON.stringify(constructorArgs),
  };

  let output;

  try {
    output = execSync(
      `npx hardhat run scripts/deploy.js --network ${network}`,
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
    const details = err.stdout || err.stderr || err.message;
    throw new Error(`Hardhat deployment failed:\n${details}`);
  }

  if (!fs.existsSync(resultPath)) {
    throw new Error(
      `Deployment output file not found. Hardhat output:\n${output}`
    );
  }

  const deployResult = JSON.parse(
    fs.readFileSync(resultPath, "utf-8")
  );

  // Clean up deployment result file
  fs.unlinkSync(resultPath);

  let verified = false;

  try {
    const args = constructorArgs.map((arg) =>
      typeof arg === "string" ? `"${arg}"` : String(arg)
    );

    const verifyCmd =
      args.length > 0
        ? `npx hardhat verify --network ${network} ${deployResult.address} ${args.join(" ")}`
        : `npx hardhat verify --network ${network} ${deployResult.address}`;

    execSync(verifyCmd, {
      cwd: projectRoot,
      env: process.env,
      stdio: "pipe",
      encoding: "utf-8",
      timeout: 2 * 60 * 1000,
    });

    verified = true;
  } catch (err) {
    verified = false;
  }

  return {
    address: deployResult.address,
    txHash: deployResult.txHash || null,
    deployerAddress: deployResult.deployerAddress || null,
    network: deployResult.network || network,
    verified,
  };
}

module.exports = runHardhatDeploy;
