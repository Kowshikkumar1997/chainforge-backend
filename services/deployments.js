/**
 * ChainForge — Ethers.js Deployment Service (Runtime Only)
 *
 * Responsibilities:
 * - Deploy precompiled Solidity contracts using ethers v6
 * - Never compile Solidity in production
 * - Never depend on Hardhat
 * - Safe for ephemeral environments (Render)
 */

const fs = require("fs");
const path = require("path");

// ⚠️ Import ethers v6 symbols directly
const {
  JsonRpcProvider,
  Wallet,
  ContractFactory,
} = require("ethers");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function loadArtifact(artifactKey) {
  const artifactPath = path.join(
    __dirname,
    "..",
    "artifacts-precompiled",
    `${artifactKey}.json`
  );

  if (!fs.existsSync(artifactPath)) {
    throw new Error(`Artifact not found: ${artifactPath}`);
  }

  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

  assert(artifact.abi, "Artifact missing ABI");
  assert(artifact.bytecode, "Artifact missing bytecode");

  return artifact;
}

function getProvider() {
  assert(process.env.SEPOLIA_RPC_URL, "Missing SEPOLIA_RPC_URL");
  return new JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
}

function getDeployer(provider) {
  assert(process.env.DEPLOYER_PRIVATE_KEY, "Missing DEPLOYER_PRIVATE_KEY");
  return new Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);
}

async function deployFromArtifact({ artifactKey, constructorArgs = [] }) {
  const provider = getProvider();
  const deployer = getDeployer(provider);
  const artifact = loadArtifact(artifactKey);

  const factory = new ContractFactory(
    artifact.abi,
    artifact.bytecode,
    deployer
  );

  const contract = await factory.deploy(...constructorArgs);
  const tx = contract.deploymentTransaction();

  await contract.waitForDeployment();

  return {
    address: await contract.getAddress(),
    txHash: tx?.hash || null,
    deployerAddress: deployer.address,
    network: "sepolia",
  };
}

module.exports = {
  deployFromArtifact,
};
