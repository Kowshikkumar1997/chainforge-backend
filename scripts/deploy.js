/**
 * ChainForge — Hardhat Deployment Script
 *
 * Responsibilities:
 * - Compile runtime-generated Solidity sources
 * - Deploy the specified contract to the active network
 * - Emit a machine-readable deployment artifact for backend consumption
 *
 * Execution Model:
 * - Invoked as an isolated Hardhat child process
 * - All deployment context is injected via environment variables
 *
 * Design Principles:
 * - Deterministic execution
 * - Explicit failure modes
 * - Auditable runtime artifacts
 */

const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  /* ------------------------------------------------------------------
     Environment Validation
  ------------------------------------------------------------------- */

  const {
    CONTRACT_NAME,
    CONSTRUCTOR_ARGS,
    DEPLOY_RESULT_PATH,
  } = process.env;

  if (!CONTRACT_NAME) {
    throw new Error("Missing required environment variable: CONTRACT_NAME");
  }

  if (!DEPLOY_RESULT_PATH) {
    throw new Error("Missing required environment variable: DEPLOY_RESULT_PATH");
  }

  let constructorArgs = [];

  if (CONSTRUCTOR_ARGS) {
    try {
      constructorArgs = JSON.parse(CONSTRUCTOR_ARGS);
      if (!Array.isArray(constructorArgs)) {
        throw new Error("CONSTRUCTOR_ARGS must be a JSON array");
      }
    } catch (err) {
      throw new Error(
        `Invalid CONSTRUCTOR_ARGS format: ${err.message}`
      );
    }
  }

  /* ------------------------------------------------------------------
     Execution Context Logging
  ------------------------------------------------------------------- */

  console.log("[deploy] Starting deployment");
  console.log("[deploy] Network:", hre.network.name);
  console.log("[deploy] Contract:", CONTRACT_NAME);
  console.log("[deploy] Constructor args:", constructorArgs);

  const sourcesDir = hre.config.paths.sources;
  console.log("[deploy] Sources directory:", sourcesDir);

  try {
    const sourceFiles = fs.readdirSync(sourcesDir);
    console.log("[deploy] Source files:", sourceFiles);
  } catch (err) {
    console.warn("[deploy] Unable to read sources directory:", err.message);
  }

  /* ------------------------------------------------------------------
     Compilation
  ------------------------------------------------------------------- */

  await hre.run("compile");

  /* ------------------------------------------------------------------
     Deployment
  ------------------------------------------------------------------- */

  const [deployer] = await hre.ethers.getSigners();
  console.log("[deploy] Deployer address:", deployer.address);

  const Factory = await hre.ethers.getContractFactory(CONTRACT_NAME);

  const contract = await Factory.deploy(...constructorArgs);
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  const tx = contract.deploymentTransaction();

  /* ------------------------------------------------------------------
     Deployment Artifact Emission
  ------------------------------------------------------------------- */

  const deploymentResult = {
    address,
    txHash: tx?.hash || null,
    deployerAddress: deployer.address,
    network: hre.network.name,
    contractName: CONTRACT_NAME,
    deployedAt: new Date().toISOString(),
  };

  const outputDir = path.dirname(DEPLOY_RESULT_PATH);

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(
    DEPLOY_RESULT_PATH,
    JSON.stringify(deploymentResult, null, 2),
    "utf-8"
  );

  console.log("[deploy] Contract deployed at:", address);
  console.log("[deploy] Deployment artifact written to:", DEPLOY_RESULT_PATH);
}

/* ------------------------------------------------------------------
   Entrypoint
------------------------------------------------------------------- */

main().catch((err) => {
  console.error("[deploy] Deployment failed");
  console.error(err);
  process.exit(1);
});
