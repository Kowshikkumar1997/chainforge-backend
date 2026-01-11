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
 * - Deterministic output suitable for CI/CD and audit workflows
 * - Verification pipeline compatibility (Etherscan / Sourcify)
 */

const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

/* ------------------------------------------------------------------
   Main Execution
------------------------------------------------------------------- */

async function main() {
  const {
    CONTRACT_NAME,
    CONSTRUCTOR_ARGS,
    DEPLOY_RESULT_PATH,
  } = process.env;

  if (!CONTRACT_NAME?.trim()) {
    throw new Error("Missing or invalid environment variable: CONTRACT_NAME");
  }

  if (!DEPLOY_RESULT_PATH?.trim()) {
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
     Execution Context
  ------------------------------------------------------------------- */

  console.log("[deploy] Execution started");
  console.log("[deploy] Network:", hre.network.name);
  console.log("[deploy] Contract name:", CONTRACT_NAME);
  console.log("[deploy] Constructor arguments:", constructorArgs);

  /* ------------------------------------------------------------------
     Compilation
  ------------------------------------------------------------------- */

  console.log("[deploy] Compiling contracts");
  await hre.run("compile");

  /* ------------------------------------------------------------------
     Deployment
  ------------------------------------------------------------------- */

  const [deployer] = await hre.ethers.getSigners();

  if (!deployer) {
    throw new Error("No deployer account available in Hardhat runtime");
  }

  console.log("[deploy] Deployer:", deployer.address);

  const ContractFactory = await hre.ethers.getContractFactory(CONTRACT_NAME);

  const deployTxRequest = await ContractFactory.getDeployTransaction(
    ...constructorArgs
  );

  const deployedContract = await ContractFactory.deploy(...constructorArgs);
  await deployedContract.waitForDeployment();

  const address = await deployedContract.getAddress();
  const deploymentTx = deployedContract.deploymentTransaction();

  console.log("[deploy] Contract address:", address);
  console.log("[deploy] Transaction hash:", deploymentTx?.hash || "N/A");

  /* ------------------------------------------------------------------
     Constructor Argument Encoding (for verification)
  ------------------------------------------------------------------- */

  let encodedConstructorArgs = "";

  if (deployTxRequest?.data && ContractFactory.bytecode) {
    const fullData = deployTxRequest.data.replace("0x", "");
    const bytecode = ContractFactory.bytecode.replace("0x", "");

    if (fullData.startsWith(bytecode)) {
      encodedConstructorArgs = fullData.slice(bytecode.length);
    }
  }

  /* ------------------------------------------------------------------
     Deployment Artifact
  ------------------------------------------------------------------- */

  const deploymentResult = {
    address,
    txHash: deploymentTx?.hash || null,
    deployerAddress: deployer.address,
    network: hre.network.name,
    contractName: CONTRACT_NAME,

    constructorArgs: constructorArgs,
    constructorArgsEncoded: encodedConstructorArgs,

    verificationStatus: "not_requested",
    verificationMessage: "",
    etherscanUrl: "",

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
