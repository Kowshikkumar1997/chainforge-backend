/**
 * ChainForge Backend
 *
 * Responsibilities:
 * - Accept token deployment requests (ERC20, ERC721, ERC1155)
 * - Validate ERC standard and module compatibility
 * - Deploy contracts using ethers.js and precompiled artifacts (Phase 1)
 * - Persist deployment metadata as immutable JSON records
 * - Package deterministic deployment bundles for user download
 * - Expose operational token actions (mint, balance)
 *
 * Phase 1 Deployment Model (Render / free hosting):
 * - Solidity is compiled locally only (Hardhat, build-time)
 * - Production deployments use ethers.js with committed artifacts
 * - No Solidity compilation occurs at runtime
 * - No repository writes are required in production
 *
 * Runtime Notes:
 * - Server listens on process.env.PORT
 * - Uses a writable runtime directory for deployments and bundles
 *
 * Security Notes:
 * - DEPLOYER_PRIVATE_KEY is a production secret
 */

require("dotenv").config();

console.log("[BOOT] index.js loaded at", new Date().toISOString());

const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const archiver = require("archiver");

const { mintToken, checkBalance } = require("./routes/tokenActions");
const { deployFromArtifact } = require("./services/deployments");

const {
  RUNTIME_BASE_DIR,
  generatedChainsDir,
  deploymentsDir,
  bundlesDir,
} = require("./utils/runtime");

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

/* ------------------------------------------------------------------
   CORS Configuration (Render / Vercel safe)
------------------------------------------------------------------- */

const allowedOrigins = new Set([
  process.env.FRONTEND_ORIGIN,
  "http://localhost:3000",
]);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.has(origin)) return callback(null, true);
      if (origin.endsWith(".vercel.app")) return callback(null, true);
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: "1mb" }));

/* ------------------------------------------------------------------
   Runtime Directories (Writable)
------------------------------------------------------------------- */

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

ensureDir(RUNTIME_BASE_DIR);
ensureDir(generatedChainsDir);
ensureDir(deploymentsDir);
ensureDir(bundlesDir);

/* ------------------------------------------------------------------
   Static Downloads
------------------------------------------------------------------- */

app.use("/generated_chains", express.static(generatedChainsDir));
app.use("/bundles", express.static(bundlesDir));

/* ------------------------------------------------------------------
   Helpers
------------------------------------------------------------------- */

function sanitizeContractName(name) {
  const cleaned = String(name || "").replace(/\s+/g, "").trim();
  return cleaned.length ? cleaned : null;
}

function normalizeModules(modules) {
  if (!Array.isArray(modules)) return [];
  return modules.map((m) => String(m).trim().toLowerCase()).filter(Boolean);
}

function badRequest(res, message) {
  return res.status(400).json({ message });
}

function serverError(res, message = "Internal server error") {
  return res.status(500).json({ message });
}

function zipFolder(sourceDir, outPath) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", () => resolve(outPath));
    archive.on("error", reject);

    archive.pipe(output);
    archive.directory(sourceDir, false);
    archive.finalize();
  });
}

/**
 * Artifact key resolution (Phase 1)
 * Matches artifacts generated under artifacts-precompiled/
 */
function artifactKeyForToken({ type, modules }) {
  const mods = normalizeModules(modules).sort();
  const suffix = mods.length ? mods.join("_") : "base";
  return `${type}__${suffix}`;
}

/**
 * Module compatibility matrix
 */
function validateModulesForType(type, modules) {
  const allowed = {
    ERC20: new Set(["mintable", "burnable", "pausable", "governance"]),
    ERC721: new Set(["mintable", "burnable", "pausable"]),
    ERC1155: new Set(["mintable", "burnable", "pausable"]),
  };

  if (!allowed[type]) {
    throw new Error(`Invalid token type: ${type}`);
  }

  const invalid = modules.filter((m) => !allowed[type].has(m));
  if (invalid.length) {
    throw new Error(`Invalid modules for ${type}: ${invalid.join(", ")}`);
  }
}

/**
 * Constructor argument mapping (Phase 1)
 */
function constructorArgsForRequest(input) {
  if (input.type === "ERC20") return [input.tokenName, input.tokenSymbol];
  if (input.type === "ERC721") return [input.tokenName, input.tokenSymbol];
  if (input.type === "ERC1155") return [input.baseURI];
  return [];
}

/* ------------------------------------------------------------------
   Health Check
------------------------------------------------------------------- */

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "chainforge-backend",
    timestamp: new Date().toISOString(),
  });
});

/* ------------------------------------------------------------------
   Create Token (ethers.js + precompiled artifact) — SYNCHRONOUS
------------------------------------------------------------------- */

app.post("/create-token", async (req, res) => {
  const requestId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  try {
    const { type, tokenName, tokenSymbol, modules, baseURI } = req.body || {};

    const cleanTokenName = sanitizeContractName(tokenName);
    if (!cleanTokenName) return badRequest(res, "tokenName is required.");

    const cleanModules = normalizeModules(modules);

    if ((type === "ERC20" || type === "ERC721") && !tokenSymbol) {
      return badRequest(res, "tokenSymbol is required.");
    }

    if (type === "ERC1155" && !baseURI) {
      return badRequest(res, "baseURI is required.");
    }

    validateModulesForType(type, cleanModules);

    console.log("[create-token] started", {
      requestId,
      type,
      tokenName: cleanTokenName,
      tokenSymbol,
      modules: cleanModules,
      baseURI,
    });

    const artifactKey = artifactKeyForToken({ type, modules: cleanModules });

    const constructorArgs = constructorArgsForRequest({
      type,
      tokenName: cleanTokenName,
      tokenSymbol,
      baseURI,
      modules: cleanModules,
    });

    console.log("[create-token] deploying from artifact", {
      artifactKey,
      constructorArgs,
    });

    const deployResult = await deployFromArtifact({
      artifactKey,
      constructorArgs,
    });

    console.log("[create-token] deploy completed", deployResult);

    const deploymentRecord = {
      project: "ChainForge",
      requestId,
      tokenType: type,
      token: {
        tokenName: cleanTokenName,
        tokenSymbol: tokenSymbol || null,
        baseURI: baseURI || null,
        modules: cleanModules || [],
      },
      artifactKey,
      network: deployResult.network || "sepolia",
      contractAddress: deployResult.address,
      deployerAddress: deployResult.deployerAddress || null,
      txHash: deployResult.txHash || null,
      verified: false,
      deployedAt: new Date().toISOString(),
    };

    const deploymentFile = `${cleanTokenName}_${type}_${Date.now()}.json`;
    const deploymentPath = path.join(deploymentsDir, deploymentFile);
    fs.writeFileSync(deploymentPath, JSON.stringify(deploymentRecord, null, 2));

    const bundleDir = path.join(bundlesDir, requestId);
    ensureDir(bundleDir);

    const artifactSource = path.join(
      process.cwd(),
      "artifacts-precompiled",
      `${artifactKey}.json`
    );

    fs.copyFileSync(artifactSource, path.join(bundleDir, `${artifactKey}.json`));
    fs.copyFileSync(deploymentPath, path.join(bundleDir, deploymentFile));

    const zipFilename = `${cleanTokenName}_${requestId}_bundle.zip`;
    const zipPath = path.join(bundlesDir, zipFilename);
    await zipFolder(bundleDir, zipPath);

    return res.status(200).json({
      message: `${type} token deployed successfully`,
      requestId,
      ...deployResult,
      artifactKey,
      deploymentFile,
      download: `/bundles/${zipFilename}`,
    });
  } catch (err) {
    console.error("[create-token] failed", err);
    return serverError(res, err.message);
  }
});

/* ------------------------------------------------------------------
   Create Chain Scaffold
------------------------------------------------------------------- */

function zipFolderToFile(sourceDir, zipPath) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", resolve);
    output.on("error", reject);
    archive.on("error", reject);

    archive.pipe(output);
    archive.directory(sourceDir, false);
    archive.finalize();
  });
}

app.post("/create-chain", async (req, res) => {
  try {
    const { chainName, consensusType, modules = [] } = req.body || {};

    if (!chainName) {
      return res.status(400).json({ message: "chainName is required" });
    }

    if (!consensusType) {
      return res.status(400).json({ message: "consensusType is required" });
    }

    const outputDir = generatedChainsDir;
    ensureDir(outputDir);

    const chainDir = path.join(outputDir, chainName);
    ensureDir(chainDir);

    const readme = `# ${chainName}

Consensus: ${consensusType}
Modules: ${modules.join(", ") || "none"}
Generated At: ${new Date().toISOString()}
`;

    fs.writeFileSync(path.join(chainDir, "README.md"), readme);

    const zipFilename = `${chainName}_chain.zip`;
    const zipPath = path.join(outputDir, zipFilename);

    await zipFolderToFile(chainDir, zipPath);

    if (!fs.existsSync(zipPath)) {
      throw new Error(`Chain zip was not created: ${zipPath}`);
    }

    const stat = fs.statSync(zipPath);
    console.log("[create-chain] zip generated", { zipPath, bytes: stat.size });

    console.log("[create-chain] generated_chains contents:", fs.readdirSync(outputDir));

    return res.json({
      message: "Chain scaffold generated successfully",
      download: `/generated_chains/${zipFilename}`,
    });
  } catch (err) {
    console.error("[create-chain] failed", err);
    return res.status(500).json({ message: err.message });
  }
});

/* ------------------------------------------------------------------
   Deployment History
------------------------------------------------------------------- */

app.get("/deployments", (req, res) => {
  try {
    ensureDir(deploymentsDir);

    const files = fs
      .readdirSync(deploymentsDir)
      .filter((f) => f.endsWith(".json"))
      .sort()
      .reverse();

    const records = files.map((file) => {
      const fullPath = path.join(deploymentsDir, file);
      const data = JSON.parse(fs.readFileSync(fullPath, "utf-8"));
      return { file, ...data };
    });

    res.json({ count: records.length, records });
  } catch (err) {
    console.error("[deployments] failed", err);
    return serverError(res, err.message);
  }
});

/* ------------------------------------------------------------------
   Token Actions
------------------------------------------------------------------- */

app.post("/mint", mintToken);
app.post("/balance", checkBalance);

/* ------------------------------------------------------------------
   Server
------------------------------------------------------------------- */

app.listen(PORT, () => {
  console.log(`[server] Listening on port ${PORT}`);
});
