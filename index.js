/**
 * ChainForge Backend
 *
 * API entry point responsible for:
 * - Token generation (ERC20, ERC721, ERC1155)
 * - Contract deployment orchestration (via spawned Hardhat)
 * - Deployment metadata persistence
 * - Mint and balance operations
 */
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const archiver = require("archiver");

const { mintToken, checkBalance } = require("./routes/tokenActions");

const {
  generateERC20Contract,
  generateERC721Contract,
  generateERC1155Contract,
} = require("./utils/generateSolidityContract");

const runHardhatDeploy = require("./utils/runHardhatDeploy");

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

app.use(cors());
app.use(express.json());

// Static folders for downloads
app.use(
  "/generated_contracts",
  express.static(path.join(__dirname, "generated_contracts"))
);

app.use(
  "/generated_chains",
  express.static(path.join(__dirname, "generated_chains"))
);

// Ensure runtime directories exist
const deploymentsDir = path.join(__dirname, "deployments");
if (!fs.existsSync(deploymentsDir)) fs.mkdirSync(deploymentsDir, { recursive: true });

const generatedContractsDir = path.join(__dirname, "generated_contracts");
if (!fs.existsSync(generatedContractsDir)) fs.mkdirSync(generatedContractsDir, { recursive: true });

const generatedChainsDir = path.join(__dirname, "generated_chains");
if (!fs.existsSync(generatedChainsDir)) fs.mkdirSync(generatedChainsDir, { recursive: true });

function zipFolder(sourceDir, outPath) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", () => resolve(outPath));
    archive.on("error", (err) => reject(err));

    archive.pipe(output);
    archive.directory(sourceDir, false);
    archive.finalize();
  });
}

function sanitizeContractName(name) {
  return String(name || "").replace(/\s+/g, "").trim();
}

function badRequest(res, message) {
  return res.status(400).json({ message });
}

function serverError(res, message = "Internal server error") {
  return res.status(500).json({ message });
}

// -----------------------------
// Create Token (generate + deploy)
// -----------------------------
app.post("/create-token", async (req, res) => {
  const requestId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  try {
    const {
      type,
      tokenName,
      tokenSymbol,
      initialSupply,
      decimals,
      modules,
      baseURI,
    } = req.body || {};

    console.log("[create-token] Request received", {
      requestId,
      type,
      tokenName,
      timestamp: new Date().toISOString(),
    });

    // Validation
    if (!tokenName) return badRequest(res, "tokenName is required.");

    if ((type === "ERC20" || type === "ERC721") && !tokenSymbol) {
      return badRequest(res, "tokenSymbol is required for ERC20 and ERC721.");
    }

    if (type === "ERC1155" && !baseURI) {
      return badRequest(res, "baseURI is required for ERC1155.");
    }

    // Generate contract(s)
    let filenames = [];

    if (type === "ERC20") {
      filenames = generateERC20Contract({
        tokenName,
        tokenSymbol,
        initialSupply,
        decimals,
        modules,
      });
    } else if (type === "ERC721") {
      filenames = generateERC721Contract({
        tokenName,
        tokenSymbol,
      });
    } else if (type === "ERC1155") {
      filenames = generateERC1155Contract({
        tokenName,
        baseURI,
      });
    } else {
      return badRequest(res, "Invalid token type. Use ERC20, ERC721, or ERC1155.");
    }

    if (!Array.isArray(filenames) || filenames.length === 0) {
      console.error("[create-token] No contract files generated", { requestId, type, tokenName });
      return serverError(res, "Contract generation failed.");
    }

    console.log("[create-token] Generated contract files", { requestId, filenames });

    const contractFile = filenames[0];
    const cleanContractName = sanitizeContractName(tokenName);

    // Constructor args
    let constructorArgs = [];
    if (type === "ERC20") constructorArgs = [initialSupply];
    if (type === "ERC1155") constructorArgs = [baseURI];

    // Deploy (spawned Hardhat, public network)
    const network = "sepolia";
    const deployResult = await runHardhatDeploy({
      contractFile,
      contractName: cleanContractName,
      constructorArgs,
      network,
    });

    const contractAddress = deployResult?.address;
    const txHash = deployResult?.txHash;
    const deployerAddress = deployResult?.deployerAddress;
    const verified = deployResult?.verified ?? false;

    if (!contractAddress) {
      console.error("[create-token] Deploy returned no contract address", {
        requestId,
        deployResult,
      });
      return serverError(res, "Deployment failed (no contract address returned).");
    }

    // Persist deployment metadata (audit trail)
    const deploymentRecord = {
      project: "ChainForge",
      tokenType: type,
      token: {
        tokenName,
        tokenSymbol,
        initialSupply,
        decimals,
        baseURI,
        modules,
      },
      network,
      contractAddress,
      deployerAddress: deployerAddress || null,
      txHash: txHash || null,
      verified,
      deployedAt: new Date().toISOString(),
    };

    const deploymentFilename = `${cleanContractName}_${type}_${Date.now()}.json`;
    const deploymentPath = path.join(deploymentsDir, deploymentFilename);

    fs.writeFileSync(deploymentPath, JSON.stringify(deploymentRecord, null, 2), "utf-8");
    console.log("[create-token] Deployment record persisted", { requestId, file: deploymentFilename });

    // Save config file into generated_contracts (optional, used in zip bundle)
    const configFilename = `${cleanContractName}_config.json`;
    const configPath = path.join(generatedContractsDir, configFilename);
    fs.writeFileSync(configPath, JSON.stringify(deploymentRecord, null, 2), "utf-8");

    // Zip generated contracts folder for download
    const zipFilename = `${cleanContractName}_contracts.zip`;
    const zipPath = path.join(generatedContractsDir, zipFilename);
    await zipFolder(generatedContractsDir, zipPath);

    return res.json({
      message: `${type} token deployed successfully`,
      network,
      contractAddress,
      deployerAddress: deployerAddress || null,
      txHash: txHash || null,
      verified,
      deploymentFile: deploymentFilename,
      contracts: filenames,
      download: `/generated_contracts/${zipFilename}`,
    });
  } catch (err) {
    console.error("[create-token] Failed", { error: err?.message, stack: err?.stack });
    return serverError(res, "Token deployment failed.");
  }
});

// -----------------------------
// Create Chain (scaffold + zip)
// -----------------------------
app.post("/create-chain", async (req, res) => {
  try {
    const { chainName, consensusType, modules } = req.body || {};

    if (!chainName) return badRequest(res, "chainName is required.");

    const chainDir = path.join(generatedChainsDir, chainName);
    if (fs.existsSync(chainDir)) {
      return badRequest(res, "Chain already exists.");
    }

    fs.mkdirSync(chainDir, { recursive: true });

    const readmeContent = [
      `# ${chainName}`,
      "",
      `Consensus: ${consensusType || "Default"}`,
      `Modules: ${Array.isArray(modules) && modules.length ? modules.join(", ") : "None"}`,
      `Generated At: ${new Date().toISOString()}`,
      "",
    ].join("\n");

    fs.writeFileSync(path.join(chainDir, "README.md"), readmeContent, "utf-8");

    const zipFilename = `${chainName.replace(/\s+/g, "_")}_chain.zip`;
    const zipPath = path.join(generatedChainsDir, zipFilename);

    await zipFolder(chainDir, zipPath);

    return res.json({
      message: `Chain scaffolded successfully`,
      download: `/generated_chains/${zipFilename}`,
    });
  } catch (err) {
    console.error("[create-chain] Failed", { error: err?.message, stack: err?.stack });
    return serverError(res, "Chain scaffolding failed.");
  }
});

// -----------------------------
// Token actions
// -----------------------------
app.post("/mint", mintToken);
app.post("/balance", checkBalance);

// -----------------------------
// Deployment history
// -----------------------------
app.get("/deployments", (req, res) => {
  try {
    const files = fs.readdirSync(deploymentsDir);

    const deployments = files
      .filter((file) => file.endsWith(".json"))
      .map((file) => {
        const fullPath = path.join(deploymentsDir, file);
        const raw = fs.readFileSync(fullPath, "utf-8");
        const data = JSON.parse(raw);

        return {
          file,
          project: data.project,
          tokenType: data.tokenType,
          tokenName: data.token?.tokenName || "Unknown",
          network: data.network,
          contractAddress: data.contractAddress,
          deployerAddress: data.deployerAddress || null,
          txHash: data.txHash || null,
          deployedAt: data.deployedAt,
          verified: data.verified ?? false,
        };
      })
      // newest first
      .sort((a, b) => new Date(b.deployedAt).getTime() - new Date(a.deployedAt).getTime());

    return res.json({ count: deployments.length, deployments });
  } catch (err) {
    console.error("[deployments] Failed", { error: err?.message, stack: err?.stack });
    return serverError(res, "Failed to fetch deployments.");
  }
});

app.listen(PORT, () => {
  console.log(`[server] Listening on port ${PORT}`);
});
