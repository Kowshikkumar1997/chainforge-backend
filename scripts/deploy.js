/**
 * ChainForge — Hardhat Deployment Script
 *
 * Purpose:
 * - Compile runtime-scoped Solidity sources
 * - Deploy a single, explicitly specified contract
 * - Emit a deterministic, machine-readable deployment artifact
 *
 * Invocation Model:
 * - Executed via `hardhat run` as an isolated child process
 * - All execution context is injected via environment variables
 *
 * Architectural guarantees:
 * - Exactly one contract is deployed per execution
 * - No shared mutable state between deployments
 * - No dependency on repository-local artifacts or paths
 *
 * This script is intentionally minimal, deterministic, and auditable.
 */

const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

/* ------------------------------------------------------------------
   Main Execution
------------------------------------------------------------------- */

async function main() {
  /* ------------------------------------------------------------------
     Environment Validation (Fail Fast)
  ------------------------------------------------------------------- */

  const {
    CONTRACT_NAME,
    CONSTRUCTOR_ARGS,
    DEPLOY_RESULT_PATH,
  } = process.env;

  if (typeof CONTRACT_NAME !== "string" || CONTRACT_NAME.trim().length === 0) {
    throw new Error("Missing or invalid environment variable: CONTRACT_NAME");
  }

  if (typeof DEPLOY_RESULT_PATH !== "string" || DEPLOY_RESULT_PATH.trim().length === 0) {
    throw new Error("Missing or invalid environment variable: DEPLOY_RESULT_PATH");
  }

  let constructorArgs = [];

  if (typeof CONSTRUCTOR_ARGS === "string" && CONSTRUCTOR_ARGS.trim().length > 0) {
    let parsed;
    try {
      parsed = JSON.parse(CONSTRUCTOR_ARGS);
    } catch {
      throw new Error("CONSTRUCTOR_ARGS must be valid JSON");
    }

    if (!Array.isArray(parsed)) {
      throw new Error("CONSTRUCTOR_ARGS must be a JSON array");
    }

    constructorArgs = parsed;
  }

  /* ------------------------------------------------------------------
     Execution Context Logging
  ------------------------------------------------------------------- */

  console.log("[deploy] Execution started");
  console.log("[deploy] Network:", hre.network.name);
  console.log("[deploy] Contract name:", CONTRACT_NAME);
  console.log("[deploy] Constructor arguments:", constructorArgs);
  console.log("[deploy] Hardhat sources directory:", hre.config.paths.sources);

  /* ------------------------------------------------------------------
     Compilation
  ------------------------------------------------------------------- */

  /**
   * Compilation is explicitly invoked to guarantee:
   * - Fresh artifacts
   * - No reliance on stale cache
   * - Deterministic behavior across ephemeral environments
   */
  console.log("[deploy] Compiling contracts (runtime scope)");
  await hre.run("compile");

  /* ------------------------------------------------------------------
     Deployment
  ------------------------------------------------------------------- */

  const [deployer] = await hre.ethers.getSigners();

  if (!deployer) {
    throw new Error("No deployer account available in Hardhat runtime");
  }

  console.log("[deploy] Deployer address:", deployer.address);

  const ContractFactory = await hre.ethers.getContractFactory(CONTRACT_NAME);

  const contract = await ContractFactory.deploy(...constructorArgs);

  /**
   * Explicit wait ensures:
   * - Deployment transaction is mined
   * - Contract address is stable before emitting result
   */
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  const deploymentTx = contract.deploymentTransaction();

  console.log("[deploy] Contract deployed at:", address);
  console.log("[deploy] Deployment transaction hash:", deploymentTx?.hash || "N/A");

  /* ------------------------------------------------------------------
     Deployment Artifact Emission
  ------------------------------------------------------------------- */

  const deploymentResult = {
    address,
    txHash: deploymentTx?.hash || null,
    deployerAddress: deployer.address,
    network: hre.network.name,
    contractName: CONTRACT_NAME,
    deployedAt: new Date().toISOString(),
  };

  const outputDir = path.dirname(DEPLOY_RESULT_PATH);
  fs.mkdirSync(outputDir, { recursive: true });

  fs.writeFileSync(
    DEPLOY_RESULT_PATH,
    JSON.stringify(deploymentResult, null, 2),
    "utf-8"
  );

  console.log("[deploy] Deployment artifact written:", DEPLOY_RESULT_PATH);
  console.log("[deploy] Execution completed successfully");

  /**
   * CRITICAL:
   * Explicit exit ensures the parent process (spawnSync)
   * receives a clean termination signal.
   */
  process.exit(0);
}

/* ------------------------------------------------------------------
   Entrypoint
------------------------------------------------------------------- */

main().catch((err) => {
  console.error("[deploy] Execution failed");
  console.error(err);
  process.exit(1);
});
