const path = require("path");
const { exportVerifyPayload } = require("./_exportVerificationPayload");// adjust path

const projectRoot = path.join(__dirname, "..");

const artifacts = [
  {
    artifactKey: "ERC20__base",
    sourceName: "contracts/__generated__/ERC20_base.sol",
    contractName: "ERC20_base",
  },
  {
    artifactKey: "ERC721__base",
    sourceName: "contracts/__generated__/ERC721_base.sol",
    contractName: "ERC721_base",
  },
  {
    artifactKey: "ERC1155__base",
    sourceName: "contracts/__generated__/ERC1155_base.sol",
    contractName: "ERC1155_base",
  },
];

for (const a of artifacts) {
  try {
    exportVerifyPayload({ projectRoot, artifact: a });
    console.log("✔ success:", a.artifactKey);
  } catch (err) {
    console.error("✖ failed:", a.artifactKey);
    console.error(err.message);
  }
}
