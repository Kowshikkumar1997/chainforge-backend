const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");

const REPO_ROOT = path.join(__dirname, "..");
const GENERATED_DIR = path.join(REPO_ROOT, "contracts", "__generated__");

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

ensureDir(GENERATED_DIR);

console.log("[build-all] starting unified artifact generation");

/* ---------------------------------------------------
   Run individual generators WITHOUT wiping directory
--------------------------------------------------- */

console.log("[build-all] generating ERC20...");
execSync("node scripts/build-erc20-artifacts.js --no-clean", {
  stdio: "inherit",
});

console.log("[build-all] generating ERC721...");
execSync("node scripts/build-erc721-artifacts.js --no-clean", {
  stdio: "inherit",
});

console.log("[build-all] generating ERC1155...");
execSync("node scripts/build-erc1155-artifacts.js --no-clean", {
  stdio: "inherit",
});

/* ---------------------------------------------------
   Compile everything together
--------------------------------------------------- */

console.log("[build-all] compiling with hardhat...");
execSync("npx hardhat compile", { stdio: "inherit" });

console.log("[build-all] completed");
