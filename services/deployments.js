/**
 * ChainForge — Ethers.js Deployment Service (Runtime Only)
 *
 * Responsibilities:
 * - Deploy precompiled Solidity contracts using ethers v6
 * - Persist a deterministic deployment artifact
 * - Return encoded constructor args for verification
 */

const fs = require("fs");
const path = require("path");

const {
  JsonRpcProvider,
  Wallet,
  ContractFactory,
} = require("ethers");

const { RUNTIME_BASE_DIR } = require("../utils/runtime");

/* -------------------------------------------------------
   Helpers
------------------------------------------------------- */

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
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

/* -------------------------------------------------------
   Main
------------------------------------------------------- */

async function deployFromArtifact({ artifactKey, constructorArgs = [] }) {
  ensureDir(RUNTIME_BASE_DIR);

  const provider = getProvider();
  const deployer = getDeployer(provider);
  const artifact = loadArtifact(artifactKey);

  const factory = new ContractFactory(
    artifact.abi,
    artifact.bytecode,
    deployer
  );

  // Used for constructor encoding
  const deployTxRequest = await factory.getDeployTransaction(
    ...constructorArgs
  );

  const contract = await factory.deploy(...constructorArgs);
  const tx = contract.deploymentTransaction();

  await contract.waitForDeployment();

  const address = await contract.getAddress();

  /* -------------------------------------------------------
     Encode constructor args (for Etherscan)
  ------------------------------------------------------- */

  let encodedConstructorArgs = "";

  if (deployTxRequest?.data) {
    const fullData = deployTxRequest.data.replace(/^0x/, "");
    const bytecode = artifact.bytecode.replace(/^0x/, "");

    if (fullData.startsWith(bytecode)) {
      encodedConstructorArgs = fullData.slice(bytecode.length);
    }
  }

  /* -------------------------------------------------------
     Write deployment artifact
  ------------------------------------------------------- */

  const deploymentArtifact = {
    address,
    txHash: tx?.hash || null,
    deployerAddress: deployer.address,
    network: "sepolia",

    constructorArgs,
    constructorArgsEncoded: encodedConstructorArgs,

    deployedAt: new Date().toISOString(),
  };

  const deploymentPath = path.join(RUNTIME_BASE_DIR, "deploy-result.json");

  fs.writeFileSync(
    deploymentPath,
    JSON.stringify(deploymentArtifact, null, 2),
    "utf-8"
  );

  /* -------------------------------------------------------
     Return to API
  ------------------------------------------------------- */

  return {
    address,
    txHash: tx?.hash || null,
    deployerAddress: deployer.address,
    network: "sepolia",

    constructorArgs,
    constructorArgsEncoded: encodedConstructorArgs,

    deploymentPath,
  };
}

module.exports = {
  deployFromArtifact,
};
