const hre = require("hardhat");

/**
 * Deploy any type of token/asset
 * type: "ERC20" | "ERC721" | "ERC1155"
 * params:
 *   ERC20: { initialSupply }
 *   ERC721: none
 *   ERC1155: { uri }
 */
async function deployAsset(type, params = {}) {
  const [deployer] = await hre.ethers.getSigners();
  console.log(`🚀 Deploying ${type} with deployer: ${deployer.address}`);

  let ContractFactory, contract;

  switch (type) {
    case "ERC20":
      ContractFactory = await hre.ethers.getContractFactory("MyToken");
      contract = await ContractFactory.deploy(deployer.address, params.initialSupply);
      break;

    case "ERC721":
      ContractFactory = await hre.ethers.getContractFactory("MyNFT");
      contract = await ContractFactory.deploy(deployer.address);
      break;

    case "ERC1155":
      ContractFactory = await hre.ethers.getContractFactory("MyMultiToken");
      contract = await ContractFactory.deploy(deployer.address, params.uri);
      break;

    default:
      throw new Error("Invalid type. Must be ERC20, ERC721, or ERC1155.");
  }

  await contract.waitForDeployment?.(); // Hardhat v2.22+ or fallback
  const address = contract.getAddress ? await contract.getAddress() : contract.address;

  console.log(`✅ ${type} deployed at: ${address}`);
  return address;
}

// If run directly
if (require.main === module) {
  (async () => {
    try {
      // Example deploy ERC721
      const addr = await deployAsset("ERC721");
      console.log("Deployed at:", addr);
    } catch (err) {
      console.error(err);
    }
  })();
}

module.exports = deployAsset;
