// utils/deployContract.js

const hre = require("hardhat");
const path = require("path");
const fs = require("fs");

// ---------------- Deploy Helper ----------------
async function deployContract(contractFilename, contractName, constructorArgs = []) {
  try {
    console.log(`\n🚀 Deploying contract ${contractName}`);
    console.log(`📄 File: ${contractFilename}`);
    console.log("⚙️ Constructor Args:", constructorArgs);

    // Paths
    const generatedPath = path.join(__dirname, "generated_contracts", contractFilename);
    const hardhatContractsDir = path.join(__dirname, "contracts");

    // Ensure contracts folder exists
    if (!fs.existsSync(hardhatContractsDir)) fs.mkdirSync(hardhatContractsDir);

    // ============================================================
    // 🧹 CLEANUP OLD CONTRACTS WITH SAME NAME
    // ============================================================
    const files = fs.readdirSync(hardhatContractsDir);
    files.forEach((file) => {
      if (file.startsWith(contractName)) {
        fs.unlinkSync(path.join(hardhatContractsDir, file));
        console.log("🗑️ Deleted old contract:", file);
      }
    });
    // ============================================================

    // Copy new file into /contracts
    const destinationPath = path.join(hardhatContractsDir, contractFilename);
    fs.copyFileSync(generatedPath, destinationPath);
    console.log("📁 Copied contract into /contracts");

    // Clean + compile
    await hre.run("clean");
    console.log("🧹 Hardhat cleaned");

    await hre.run("compile");
    console.log("🔨 Hardhat compiled contracts");

    // Deploy
    const [deployer] = await hre.ethers.getSigners();
    console.log("👤 Deployer Address:", deployer.address);

    // Fully qualified name (prevents HH701)
    const fqName = `contracts/${contractFilename}:${contractName}`;

    const ContractFactory = await hre.ethers.getContractFactory(fqName);
    const contract = await ContractFactory.deploy(...constructorArgs);

    console.log("⏳ Waiting for deployment...");
    await contract.waitForDeployment();

    const deployedAddress = await contract.getAddress();
    console.log(`🎉 SUCCESS — Deployed at: ${deployedAddress}`);

    return deployedAddress;

  } catch (error) {
    console.error("❌ DEPLOY ERROR:", error);
    throw error;
  }
}


module.exports = deployContract;
