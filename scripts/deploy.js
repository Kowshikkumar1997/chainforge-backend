/**
 * Hardhat Deployment Script
 *
 * This script is executed by Hardhat via:
 *   npx hardhat run scripts/deploy.js --network <network>
 *
 * Responsibilities:
 * - Load a generated Solidity contract into the Hardhat context
 * - Deploy the contract to the specified network
 * - Emit a machine-readable deployment result for backend consumption
 *
 * Note:
 * This script intentionally runs inside the Hardhat runtime environment.
 */

const hre = require("hardhat");
const path = require("path");
const fs = require("fs");

async function deployContract(contractFilename, contractName, constructorArgs = []) {
  console.log("[deploy-script] Starting deployment");
  console.log("[deploy-script] Contract:", contractName);
  console.log("[deploy-script] File:", contractFilename);
  console.log("[deploy-script] Network:", hre.network.name);

  const projectRoot = path.join(__dirname, "..");
  const generatedPath = path.join(projectRoot, "generated_contracts", contractFilename);
  const contractsDir = path.join(projectRoot, "contracts");

  if (!fs.existsSync(generatedPath)) {
    throw new Error(`Generated contract not found: ${generatedPath}`);
  }

  if (!fs.existsSync(contractsDir)) {
    fs.mkdirSync(contractsDir, { recursive: true });
  }

  fs.copyFileSync(generatedPath, path.join(contractsDir, contractFilename));

  await hre.run("clean");
  await hre.run("compile");

  const [deployer] = await hre.ethers.getSigners();
  console.log("[deploy-script] Deployer address:", deployer.address);

  const fqName = `contracts/${contractFilename}:${contractName}`;
  const Factory = await hre.ethers.getContractFactory(fqName);

  const contract = await Factory.deploy(...constructorArgs);
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  const tx = contract.deploymentTransaction();

  console.log("[deploy-script] Contract deployed at:", address);

  const result = {
    address,
    txHash: tx?.hash || null,
    deployerAddress: deployer.address,
    network: hre.network.name,
    contractName,
    contractFile: contractFilename,
    deployedAt: new Date().toISOString(),
  };

  /**
   * MVP NOTE:
   * This file is consumed by the backend after process completion.
   * In future versions, this can be replaced with a stream or IPC channel.
   */
  const outputPath = path.join(process.cwd(), "deploy-result.json");
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));

  console.log("[deploy-script] Deployment result written to deploy-result.json");
}

async function main() {
  const file = process.env.CONTRACT_FILE;
  const name = process.env.CONTRACT_NAME;
  const args = process.env.CONSTRUCTOR_ARGS
    ? JSON.parse(process.env.CONSTRUCTOR_ARGS)
    : [];

  if (!file || !name) {
    throw new Error("Missing required env vars: CONTRACT_FILE, CONTRACT_NAME");
  }

  await deployContract(file, name, args);
}

main().catch((err) => {
  console.error("[deploy-script] Failed:", err.message);
  process.exit(1);
});
