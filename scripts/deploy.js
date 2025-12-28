/**
 * ChainForge Hardhat Deployment Script
 *
 * This script is executed by the backend via a spawned Hardhat process.
 * It deploys a dynamically generated contract from the runtime directory
 * and emits a machine-readable deployment result.
 */

const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const {
    CONTRACT_NAME,
    CONSTRUCTOR_ARGS,
    DEPLOY_RESULT_PATH,
  } = process.env;

  if (!CONTRACT_NAME) {
    throw new Error("Missing required env var: CONTRACT_NAME");
  }

  const args = CONSTRUCTOR_ARGS ? JSON.parse(CONSTRUCTOR_ARGS) : [];

  console.log("[deploy-script] Starting deployment");
  console.log("[deploy-script] Contract:", CONTRACT_NAME);
  console.log("[deploy-script] Network:", hre.network.name);
    const sourcesDir = hre.config.paths.sources;
  console.log("[deploy-script] Sources dir:", sourcesDir);

  try {
    const files = fs.existsSync(sourcesDir) ? fs.readdirSync(sourcesDir) : [];
    console.log("[deploy-script] Sources files:", files);
  } catch (e) {
    console.log("[deploy-script] Sources scan failed:", e?.message);
  }

  // Compile contracts from runtime-generated sources
  await hre.run("compile");

  const [deployer] = await hre.ethers.getSigners();
  console.log("[deploy-script] Deployer address:", deployer.address);

  // Load factory from compiled artifacts (Hardhat paths are already configured)
  const Factory = await hre.ethers.getContractFactory(CONTRACT_NAME);

  const contract = await Factory.deploy(...args);
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  const tx = contract.deploymentTransaction();

  const result = {
    address,
    txHash: tx?.hash || null,
    deployerAddress: deployer.address,
    network: hre.network.name,
    contractName: CONTRACT_NAME,
    deployedAt: new Date().toISOString(),
  };

  const outputPath =
    DEPLOY_RESULT_PATH ||
    path.join(process.cwd(), "deploy-result.json");

  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), "utf-8");

  console.log("[deploy-script] Contract deployed at:", address);
  console.log("[deploy-script] Deployment result written");
}

main().catch((err) => {
  console.error("[deploy-script] Deployment failed");
  console.error(err);
  process.exit(1);
});
