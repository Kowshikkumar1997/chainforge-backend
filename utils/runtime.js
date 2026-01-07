/**
 * /**
 * IMPORTANT — Runtime filesystem helper
 *
 * This module:
 * - Does NOT execute Hardhat
 * - Does NOT compile Solidity
 * - Only prepares filesystem paths for legacy build tooling
 *
 * Runtime deployments use ethers.js exclusively.
 * 
 * ChainForge — Runtime Paths (Single Source of Truth)
 *
 * All filesystem writes must go to a runtime-writable directory.
 * Nothing should be written into the repository except templates and code.
 *
 * Responsibility:
 * - Define canonical runtime directories
 * - Ensure required runtime structure exists
 * - Materialize read-only repo assets into runtime for compilation and execution
 *
 * Runtime materialization scope:
 * - Solidity templates: required for import resolution during compilation
 * - Hardhat scripts: required when Hardhat is executed with cwd = RUNTIME_BASE_DIR
 */

const fs = require("fs");
const path = require("path");

/* ------------------------------------------------------------------
   Runtime base directory resolution
------------------------------------------------------------------- */

function defaultRuntimeBaseDir() {
  if (process.platform === "win32") {
    return path.join(process.env.SystemDrive || "C:", "tmp", "chainforge");
  }
  return "/tmp/chainforge";
}

const RUNTIME_BASE_DIR =
  typeof process.env.RUNTIME_BASE_DIR === "string" &&
  process.env.RUNTIME_BASE_DIR.trim().length > 0
    ? path.resolve(process.env.RUNTIME_BASE_DIR.trim())
    : path.resolve(defaultRuntimeBaseDir());

/* ------------------------------------------------------------------
   Standard runtime folders
------------------------------------------------------------------- */

const generatedContractsDir = path.join(RUNTIME_BASE_DIR, "generated_contracts");
const generatedChainsDir = path.join(RUNTIME_BASE_DIR, "generated_chains");
const deploymentsDir = path.join(RUNTIME_BASE_DIR, "deployments");
const bundlesDir = path.join(RUNTIME_BASE_DIR, "bundles");
const artifactsDir = path.join(RUNTIME_BASE_DIR, "artifacts");
const cacheDir = path.join(RUNTIME_BASE_DIR, "cache");

/**
 * Solidity template runtime mirror.
 *
 * IMPORTANT:
 * Generated contracts import templates using relative paths such as:
 *   ../contracts/templates/...
 *
 * Therefore templates MUST exist under:
 *   {RUNTIME_BASE_DIR}/contracts/templates
 */
const runtimeContractsDir = path.join(RUNTIME_BASE_DIR, "contracts");
const runtimeTemplatesDir = path.join(runtimeContractsDir, "templates");

/**
 * Hardhat runtime scripts.
 *
 * Hardhat is executed with cwd = RUNTIME_BASE_DIR and invoked via:
 *   hardhat run scripts/deploy.js
 *
 * Therefore scripts MUST exist under:
 *   {RUNTIME_BASE_DIR}/scripts
 */
const runtimeScriptsDir = path.join(RUNTIME_BASE_DIR, "scripts");

/* ------------------------------------------------------------------
   Filesystem helpers
------------------------------------------------------------------- */

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function copyDirRecursive(srcDir, destDir) {
  ensureDir(destDir);

  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);

    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/* ------------------------------------------------------------------
   Runtime initialization (repo materialization)
------------------------------------------------------------------- */

/**
 * Materialize Solidity templates into the runtime filesystem.
 *
 * Why:
 * - Repository files are read-only on Render
 * - Hardhat compilation is executed against runtime sources
 * - Solidity imports must resolve entirely within runtime
 *
 * This operation is:
 * - Deterministic
 * - Idempotent
 * - Safe to run on every boot
 */
function syncRuntimeTemplates() {
  const repoTemplatesDir = path.resolve(__dirname, "..", "contracts", "templates");

  if (!fs.existsSync(repoTemplatesDir)) {
    throw new Error(`[runtime] Solidity templates not found in repo: ${repoTemplatesDir}`);
  }

  ensureDir(runtimeTemplatesDir);
  copyDirRecursive(repoTemplatesDir, runtimeTemplatesDir);

  console.log("[runtime] Solidity templates synced", {
    source: repoTemplatesDir,
    destination: runtimeTemplatesDir,
  });
}

/**
 * Materialize Hardhat scripts into the runtime filesystem.
 *
 * Why:
 * - Hardhat is executed with cwd = RUNTIME_BASE_DIR
 * - Invocation references scripts using relative paths (e.g. scripts/deploy.js)
 * - The runtime filesystem must contain the scripts directory to execute deployments
 *
 * This operation is:
 * - Deterministic
 * - Idempotent
 * - Safe to run on every boot
 */
function syncRuntimeScripts() {
  const repoScriptsDir = path.resolve(__dirname, "..", "scripts");

  if (!fs.existsSync(repoScriptsDir)) {
    throw new Error(`[runtime] Hardhat scripts directory not found in repo: ${repoScriptsDir}`);
  }

  ensureDir(runtimeScriptsDir);
  copyDirRecursive(repoScriptsDir, runtimeScriptsDir);

  console.log("[runtime] Hardhat scripts synced", {
    source: repoScriptsDir,
    destination: runtimeScriptsDir,
  });
}

/* ------------------------------------------------------------------
   Boot-time guarantees
------------------------------------------------------------------- */

ensureDir(RUNTIME_BASE_DIR);
ensureDir(generatedContractsDir);
ensureDir(generatedChainsDir);
ensureDir(deploymentsDir);
ensureDir(bundlesDir);
ensureDir(artifactsDir);
ensureDir(cacheDir);
ensureDir(runtimeContractsDir);
ensureDir(runtimeScriptsDir);

// Required before any compile/deploy execution
syncRuntimeTemplates();
syncRuntimeScripts();
syncHardhatConfig();

function syncHardhatConfig() {
  const repoConfigPath = path.resolve(
    __dirname,
    "..",
    "hardhat.config.js"
  );

  const runtimeConfigPath = path.join(
    RUNTIME_BASE_DIR,
    "hardhat.config.js"
  );

  if (!fs.existsSync(repoConfigPath)) {
    throw new Error(
      `[runtime] hardhat.config.js not found in repo: ${repoConfigPath}`
    );
  }

  fs.copyFileSync(repoConfigPath, runtimeConfigPath);

  console.log("[runtime] Hardhat config synced", {
    source: repoConfigPath,
    destination: runtimeConfigPath,
  });
}

/* ------------------------------------------------------------------
   Exports
------------------------------------------------------------------- */

module.exports = {
  RUNTIME_BASE_DIR,

  generatedContractsDir,
  generatedChainsDir,
  deploymentsDir,
  bundlesDir,
  artifactsDir,
  cacheDir,

  runtimeContractsDir,
  runtimeTemplatesDir,
  runtimeScriptsDir,
};
