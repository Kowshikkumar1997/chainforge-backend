/**
 * ChainForge Token Actions
 *
 * Responsibilities:
 * - Load contract ABI from Hardhat artifacts
 * - Interact with deployed contracts for minting and balance queries
 *
 * Notes:
 * - This module intentionally does not import Hardhat runtime (hre).
 * - It uses ethers with an RPC provider to support public networks (e.g., Sepolia).
 */
console.log("[tokenActions] Loaded from:", __filename);
const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

function requireEnv(name) {
  const value = process.env[name];
  if (!value || !String(value).trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function isValidAddress(addr) {
  try {
    return Boolean(addr) && ethers.isAddress(addr);
  } catch {
    return false;
  }
}

function parsePositiveInt(value, fieldName) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) {
    throw new Error(`${fieldName} must be a non-negative integer`);
  }
  return n;
}

/**
 * Load ABI for a compiled contract from Hardhat artifacts.
 * Looks inside:
 *   artifacts/contracts/<contractFileName>/<ContractName>.json
 *
 * contractFileName example:
 *   MyNFT_ERC721_123.sol
 */
function loadArtifactAbi(contractFileName, contractNameOptional) {
  const safeFileName = path.basename(contractFileName || "").trim();
  if (!safeFileName) {
    throw new Error("contractFileName is required (e.g., MyNFT_ERC721_123.sol)");
  }

  const artifactsFolder = path.join(
    __dirname,
    "..",
    "artifacts",
    "contracts",
    safeFileName
  );

  if (!fs.existsSync(artifactsFolder)) {
    throw new Error(`Artifacts folder not found: artifacts/contracts/${safeFileName}`);
  }

  const jsonFiles = fs
    .readdirSync(artifactsFolder)
    .filter((f) => f.endsWith(".json") && !f.endsWith(".dbg.json"));

  if (jsonFiles.length === 0) {
    throw new Error(`No ABI artifact found in artifacts/contracts/${safeFileName}`);
  }

  const wanted = (contractNameOptional || "").trim();
  const chosen =
    wanted.length > 0
      ? jsonFiles.find((f) => f === `${wanted}.json`)
      : jsonFiles[0];

  if (!chosen) {
    throw new Error(
      `ABI not found for contractName "${wanted}". Available: ${jsonFiles.join(", ")}`
    );
  }

  const artifactPath = path.join(artifactsFolder, chosen);
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

  if (!artifact.abi) {
    throw new Error(`Invalid artifact (missing abi): ${artifactPath}`);
  }

  return artifact.abi;
}

/**
 * Create an ethers Contract instance against Sepolia with a signer.
 * Used for minting and read operations.
 */
function getContract(contractAddress, contractFileName, contractNameOptional) {
  if (!isValidAddress(contractAddress)) {
    throw new Error("Invalid contractAddress");
  }

  const rpcUrl = requireEnv("SEPOLIA_RPC_URL");
  const privateKey = requireEnv("DEPLOYER_PRIVATE_KEY");

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const signer = new ethers.Wallet(privateKey, provider);

  const abi = loadArtifactAbi(contractFileName, contractNameOptional);
  return new ethers.Contract(contractAddress, abi, signer);
}

// -----------------------------
// Mint
// -----------------------------
exports.mintToken = async (req, res) => {
  try {
    const {
      contractAddress,
      contractFileName,
      contractName,
      tokenType,
      to,
      id,
      amount,
    } = req.body || {};

    if (!contractAddress || !contractFileName || !tokenType) {
      return res.status(400).json({
        error: "Missing required fields: contractAddress, contractFileName, tokenType",
      });
    }

    if (!["ERC20", "ERC721", "ERC1155"].includes(tokenType)) {
      return res.status(400).json({ error: `Unsupported tokenType: ${tokenType}` });
    }

    if (tokenType === "ERC20") {
      return res.status(400).json({ error: "ERC20 minting is disabled (fixed supply)." });
    }

    const contract = getContract(contractAddress, contractFileName, contractName);

    if (!isValidAddress(to)) {
      return res.status(400).json({ error: "Invalid 'to' wallet address" });
    }

    let tx;

    if (tokenType === "ERC721") {
      // Assumes your generated ERC721 implements safeMint(address)
      tx = await contract.safeMint(to);
    } else if (tokenType === "ERC1155") {
      const tokenId = parsePositiveInt(id, "id");
      const qty = parsePositiveInt(amount, "amount");

      // Assumes your generated ERC1155 implements mint(address,uint256,uint256)
      tx = await contract.mint(to, tokenId, qty);
    }

    if (!tx) {
      return res.status(400).json({ error: `No mint method executed for tokenType: ${tokenType}` });
    }

    const receipt = await tx.wait();
    return res.json({ success: true, txHash: tx.hash, blockNumber: receipt.blockNumber });
  } catch (err) {
  console.error("[token-actions][mint] Failed:", err.message);
  return res.status(500).json({ error: "Mint failed." });
}
};

// -----------------------------
// Balance
// -----------------------------
exports.checkBalance = async (req, res) => {
  try {
    const {
      contractAddress,
      contractFileName,
      contractName,
      wallet,
      tokenType,
      id,
    } = req.body || {};

    if (!contractAddress || !contractFileName || !wallet || !tokenType) {
      return res.status(400).json({
        error: "Missing required fields: contractAddress, contractFileName, wallet, tokenType",
      });
    }

    if (!["ERC20", "ERC721", "ERC1155"].includes(tokenType)) {
      return res.status(400).json({ error: `Unsupported tokenType: ${tokenType}` });
    }

    if (!isValidAddress(wallet)) {
      return res.status(400).json({ error: "Invalid wallet address" });
    }

    const contract = getContract(contractAddress, contractFileName, contractName);

    let balance;

    if (tokenType === "ERC20") {
      balance = await contract.balanceOf(wallet);
    } else if (tokenType === "ERC721") {
      balance = await contract.balanceOf(wallet);
    } else if (tokenType === "ERC1155") {
      const tokenId = parsePositiveInt(id, "id");
      balance = await contract.balanceOf(wallet, tokenId);
    }

    return res.json({ balance: balance.toString() });
  } catch (err) {
  console.error("[token-actions][balance] Failed:", err.message);
  return res.status(500).json({ error: "Balance check failed." });
}
};
