/**
 * ChainForge — ERC20 Deployment Service (ethers.js)
 *
 * Purpose:
 * - Deploy precompiled ERC20 artifacts using ethers.js
 * - No Hardhat usage at runtime
 * - Compatible with stateless hosting (Render)
 */

const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");

const { resolveERC20ArtifactKey } = require("./erc20Artifacts");

const ARTIFACTS_DIR = path.join(
  __dirname,
  "..",
  "artifacts-precompiled"
);

async function deployERC20({
  rpcUrl,
  privateKey,
  tokenName,
  tokenSymbol,
  modules = [],
}) {
  const artifactKey = resolveERC20ArtifactKey(modules);
  const artifactPath = path.join(ARTIFACTS_DIR, `${artifactKey}.json`);

  if (!fs.existsSync(artifactPath)) {
    throw new Error(`ERC20 artifact not found: ${artifactKey}`);
  }

  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf-8"));

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);

  const factory = new ethers.ContractFactory(
    artifact.abi,
    artifact.bytecode,
    wallet
  );

  const contract = await factory.deploy(tokenName, tokenSymbol);
  await contract.waitForDeployment();

  return {
    address: await contract.getAddress(),
    txHash: contract.deploymentTransaction()?.hash || null,
    deployerAddress: wallet.address,
    artifactKey,
  };
}

module.exports = { deployERC20 };
