/**
 * Local build script: ERC20 Mintable
 *
 * Purpose:
 * - Generate Solidity into contracts/__generated__
 * - Intended for local compilation only
 * - Never used in production
 */

const path = require("path");
const { generateContract } = require("../utils/generateSolidityContract");

generateContract(
  {
    type: "ERC20",
    tokenName: "ERC20Mintable",
    tokenSymbol: "MTK",
    modules: ["mintable"],
  },
  {
    outputDir: path.join(__dirname, "..", "contracts", "__generated__"),
  }
);

console.log("ERC20Mintable.sol generated successfully");
