const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const hre = require("hardhat");
const archiver = require("archiver");

const {
  generateERC20Contract,
  generateERC721Contract,
  generateERC1155Contract,
} = require("./utils/generateSolidityContract");
// const deployDynamicToken = require("./utils/deployDynamicAsset"); // only if you actually use this

const app = express();
const PORT = 4000;

// ---------------- Middleware ----------------
app.use(cors());
app.use(express.json());
app.use("/generated_contracts", express.static(path.join(__dirname, "generated_contracts")));
app.use("/generated_chains", express.static(path.join(__dirname, "generated_chains")));

// ---------------- Zip Helper ----------------
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

// ---------------- Deploy Helper (SAFE, FINAL) ----------------
async function deployContract(contractFilename, constructorArgs = []) {
  try {
    console.log("\n===============================");
    console.log("🚀 Starting Deployment");
    console.log("===============================");
    console.log("📄 File:", contractFilename);
    console.log("⚙️ Constructor Args:", constructorArgs);

    // 1. Read generated contract
    const generatedPath = path.join(__dirname, "generated_contracts", contractFilename);
    const solidityCode = fs.readFileSync(generatedPath, "utf8");

    // 2. Extract contract name from Solidity
    const match = solidityCode.match(/contract\s+(\w+)/);
    if (!match) throw new Error(`❌ Could not extract contract name from ${contractFilename}`);
    const contractName = match[1];
    console.log("📝 Extracted Contract Name:", contractName);

    // 3. Prepare Hardhat contracts dir
    const contractsDir = path.join(__dirname, "contracts");
    if (!fs.existsSync(contractsDir)) fs.mkdirSync(contractsDir);

    // 4. CLEAN OLD VERSIONS OF THIS CONTRACT (by prefix)
    const existing = fs.readdirSync(contractsDir);
    existing.forEach((file) => {
      // Example: firsttoken_ERC20_... starts with "firsttoken"
      if (file.startsWith(contractName + "_")) {
        fs.unlinkSync(path.join(contractsDir, file));
        console.log("🗑️ Deleted old contract file:", file);
      }
    });

    // 5. Copy new .sol into /contracts
    const destinationPath = path.join(contractsDir, contractFilename);
    fs.copyFileSync(generatedPath, destinationPath);
    console.log("📁 Copied contract into /contracts:", destinationPath);

    // 6. Clean + Compile (wipes old artifacts safely)
    await hre.run("clean");
    console.log("🧹 Hardhat cleaned");

    await hre.run("compile");
    console.log("🔨 Hardhat compiled contracts");

    // 7. Deploy
    const [deployer] = await hre.ethers.getSigners();
    console.log("👤 Deployer Address:", deployer.address);

    // IMPORTANT: use only contractName here, NOT filename
    const ContractFactory = await hre.ethers.getContractFactory(contractName);
    const contract = await ContractFactory.deploy(...constructorArgs);

    console.log("⏳ Waiting for deployment...");
    await contract.waitForDeployment();

    const deployedAddress = await contract.getAddress();
    console.log(`🎉 SUCCESS — ${contractName} deployed at: ${deployedAddress}`);

    return deployedAddress;
  } catch (error) {
    console.error("❌ DEPLOY ERROR:", error);
    throw error;
  }
}

// ---------------- Create Token Endpoint ----------------
app.post("/create-token", async (req, res) => {
  try {
    const { type, tokenName, tokenSymbol, initialSupply, decimals, modules, baseURI } = req.body;

    // Validation
    if (!tokenName) {
      return res.status(400).json({ message: "Token Name is required." });
    }

    // ERC20 & ERC721 require symbol, ERC1155 does not
    if ((type === "ERC20" || type === "ERC721") && !tokenSymbol) {
      return res.status(400).json({ message: "Token Symbol is required for ERC20 and ERC721." });
    }
    // ✅ ERC1155 requires baseURI
    if (type === "ERC1155" && !baseURI) {
      return res.status(400).json({ message: "baseURI is required for ERC1155." });
    }

    let filenames;

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
      return res.status(400).json({ message: "Invalid token type." });
    }

    console.log("📄 Generated Contract Files:", filenames);

    const contractFile = filenames[0];

    // Constructor args per type
    let constructorArgs = [];
    if (type === "ERC20") constructorArgs = [initialSupply];
    if (type === "ERC1155") constructorArgs = [baseURI];

    // Deploy
    const contractAddress = await deployContract(contractFile, constructorArgs);

    // Save config JSON
    const config = {
      tokenType: type,
      token: { tokenName, tokenSymbol, initialSupply, decimals, baseURI, modules },
      contractAddress,
      generatedAt: new Date().toISOString(),
    };

    const configFilename = `${tokenName.replace(/\s+/g, "_")}_config.json`;
    const configPath = path.join(__dirname, "generated_contracts", configFilename);
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log("💾 Config Saved:", configFilename);

    // Zip generated_contracts
    const contractsDir = path.join(__dirname, "generated_contracts");
    const zipFilename = `${tokenName.replace(/\s+/g, "_")}_contracts.zip`;
    const zipPath = path.join(contractsDir, zipFilename);
    await zipFolder(contractsDir, zipPath);

    res.json({
      message: `✅ ${type} Token "${tokenName}" deployed successfully!`,
      contractAddress,
      contracts: filenames,
      configFile: configFilename,
      download: `/generated_contracts/${zipFilename}`,
    });
  } catch (err) {
    console.error("❌ Error creating token:", err);
    res.status(500).json({ message: "Internal Server Error", error: err.message });
  }
});

// ---------------- Create Blockchain Endpoint ----------------
app.post("/create-chain", async (req, res) => {
  try {
    console.log("Create chain request received:", req.body);

    const { chainName, consensusType, modules } = req.body;

    if (!chainName) return res.status(400).json({ message: "Chain Name is required." });

    const chainsDir = path.join(__dirname, "generated_chains");
    if (!fs.existsSync(chainsDir)) fs.mkdirSync(chainsDir);

    const chainDir = path.join(chainsDir, chainName);
    if (fs.existsSync(chainDir)) {
      return res.status(400).json({ message: "Chain already exists." });
    }

    fs.mkdirSync(chainDir);

    const readmeContent = `
# ${chainName}
Consensus Type: ${consensusType || "Default"}
Modules: ${modules ? modules.join(", ") : "None"}
Generated At: ${new Date().toISOString()}
    `;
    fs.writeFileSync(path.join(chainDir, "README.md"), readmeContent);

    console.log(`Chain scaffolded at ${chainDir}`);

    const zipFilename = `${chainName.replace(/\s+/g, "_")}_chain.zip`;
    const zipPath = path.join(chainsDir, zipFilename);
    await zipFolder(chainDir, zipPath);

    res.json({
      message: `✅ Chain "${chainName}" scaffolded successfully!`,
      path: chainDir,
      download: `/generated_chains/${zipFilename}`,
    });
  } catch (err) {
    console.error("❌ Error creating chain:", err);
    res.status(500).json({ message: "Internal Server Error", error: err.message });
  }
});

// ---------------- (Optional) Dynamic Deployment Endpoint ----------------
// Uncomment only if deployDynamicToken exists and works
/*
app.post("/deploy-dynamic-token", async (req, res) => {
  try {
    const { tokenName, tokenSymbol, initialSupply } = req.body;

    if (!tokenName || !tokenSymbol || !initialSupply) {
      return res.status(400).json({ message: "Token name, symbol, and supply are required." });
    }

    console.log(`📦 Deploy request received for ${tokenName} (${tokenSymbol}) with supply ${initialSupply}`);

    const address = await deployDynamicToken(tokenName, tokenSymbol, initialSupply);

    res.json({
      success: true,
      message: `✅ ${tokenName} deployed successfully!`,
      contractAddress: address,
    });
  } catch (error) {
    console.error("❌ Deployment error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});
*/

// ---------------- Start Server ----------------
app.listen(PORT, () => {
  console.log(`🚀 Backend is running at: http://localhost:${PORT}`);
});
