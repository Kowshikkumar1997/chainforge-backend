/**
 * ChainForge Solidity Contract Generator
 *
 * Purpose:
 * - Compose audited Solidity templates into deployable contracts
 * - Enforce ERC standard–specific feature compatibility
 * - Produce deterministic, reviewable Solidity output
 *
 * Design Principles:
 * - No dynamic Solidity logic generation
 * - No runtime mutation of contract behaviour
 * - All executable logic lives in version-controlled templates
 *
 * Operational Note (CRITICAL):
 * - The Hardhat orchestrator ONLY reads contracts from:
 *     {RUNTIME_BASE_DIR}/generated_contracts
 * - Solidity MUST NOT be written anywhere else.
 */

const fs = require("fs");
const path = require("path");
const { RUNTIME_BASE_DIR,generatedContractsDir } = require("./runtime");

/* ------------------------------------------------------------------
   Runtime directory (IMPORTED — SINGLE SOURCE OF TRUTH)
------------------------------------------------------------------- */

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

ensureDir(generatedContractsDir);

console.log("[generator] output dir:", generatedContractsDir);


/* ------------------------------------------------------------------
   Helpers
------------------------------------------------------------------- */

function sanitizeName(name) {
  return String(name || "").replace(/\s+/g, "").trim();
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function normalizeModules(modules) {
  if (!Array.isArray(modules)) return [];
  return modules.map(String).map((m) => m.trim()).filter(Boolean);
}
function resolveOutputDir(outputDir) {
  if (!outputDir) return generatedContractsDir;

  return path.isAbsolute(outputDir)
    ? outputDir
    : path.resolve(process.cwd(), outputDir);
}


/* ------------------------------------------------------------------
   Generator
------------------------------------------------------------------- */

function generateContract(
  {
    type,
    tokenName,
    tokenSymbol,
    baseURI,
    modules = [],
  },
  options = {}
) {
  console.log("[generator] generateContract invoked", {
    type,
    tokenName,
    modules,
  });

  const cleanModules = normalizeModules(modules);
  const contractName = sanitizeName(tokenName);
  assert(contractName, "tokenName is required");

  const imports = [];
  const inheritance = [];
  const constructorArgs = [];
  const constructorCalls = [];
  const constructorBody = [];
  const overrideFunctions = [];

  const tpl = (p) => `import "../templates/${p}";`;

  /* ---------------- ERC20 ---------------- */

  if (type === "ERC20") {
    assert(tokenSymbol, "tokenSymbol is required for ERC20");

    imports.push(tpl("ERC20/ERC20Base.sol"));
    inheritance.push("ERC20Base");

    constructorArgs.push("string memory name_", "string memory symbol_");
    constructorCalls.push("ERC20Base(name_, symbol_)");

    if (cleanModules.includes("mintable")) {
      imports.push(tpl("ERC20/ERC20Mintable.sol"));
      inheritance.push("ERC20MintableFeature");
      constructorBody.push(`_grantRole(MINTER_ROLE, msg.sender);`);
    }

    if (cleanModules.includes("burnable")) {
      imports.push(tpl("ERC20/ERC20Burnable.sol"));
      inheritance.push("ERC20BurnableFeature");
    }

    if (cleanModules.includes("pausable")) {
      imports.push(
        `import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";`
      );
      imports.push(tpl("ERC20/ERC20Pausable.sol"));
      inheritance.push("ERC20PausableFeature");
      constructorBody.push(`_grantRole(PAUSER_ROLE, msg.sender);`);

      overrideFunctions.push(`
  function _update(address from, address to, uint256 value)
    internal
    override(ERC20, ERC20Pausable)
  {
    super._update(from, to, value);
  }`);
    }
  }
  /* ---------------- ERC721 ---------------- */

if (type === "ERC721") {
  assert(tokenSymbol, "tokenSymbol is required for ERC721");

  imports.push(tpl("ERC721/ERC721Base.sol"));
  inheritance.push("ERC721Base");

  constructorArgs.push("string memory name_", "string memory symbol_");
  constructorCalls.push("ERC721Base(name_, symbol_)");

  if (cleanModules.includes("mintable")) {
    imports.push(tpl("ERC721/ERC721Mintable.sol"));
    inheritance.push("ERC721MintableFeature");
    constructorBody.push(`_grantRole(MINTER_ROLE, msg.sender);`);
  }

  if (cleanModules.includes("burnable")) {
    imports.push(tpl("ERC721/ERC721Burnable.sol"));
    inheritance.push("ERC721BurnableFeature");
    constructorBody.push(`_grantRole(BURNER_ROLE, msg.sender);`);
  }

  if (cleanModules.includes("pausable")) {
    imports.push(tpl("ERC721/ERC721Pausable.sol"));
    inheritance.push("ERC721PausableFeature");
    constructorBody.push(`_grantRole(PAUSER_ROLE, msg.sender);`);

    // OZ v5 safe: our Pausable feature uses Pausable only, so we enforce pause here.
    overrideFunctions.push(`
  function _update(address to, uint256 tokenId, address auth)
    internal
    override(ERC721)
    returns (address)
  {
    require(!paused(), "Pausable: paused");
    return super._update(to, tokenId, auth);
  }`);
  }
}
  /* ---------------- ERC1155 ---------------- */

  if (type === "ERC1155") {
    assert(baseURI, "baseURI is required for ERC1155");

    /**
     * ERC1155 Base Contract (Single Root)
     *
     * ERC1155Base is the only contract that introduces:
     * - ERC1155
     * - AccessControl
     *
     * Design constraint:
     * - Feature templates must remain logic-only.
     * - Feature templates must not inherit ERC1155 (directly or via OZ extensions).
     *   This prevents diamond inheritance and avoids _update / supportsInterface conflicts.
     */
    imports.push(tpl("ERC1155/ERC1155Base.sol"));
    inheritance.push("ERC1155Base");

    constructorArgs.push("string memory uri_");
    constructorCalls.push("ERC1155Base(uri_)");

    /**
     * Mintable (logic-only feature)
     *
     * Requirements:
     * - Template must inherit ERC1155Base (single chain)
     * - Template implements mint/mintBatch and enforces MINTER_ROLE
     *
     * Generator responsibilities:
     * - Include the module
     * - Grant MINTER_ROLE to deployer at deployment time
     */
    if (cleanModules.includes("mintable")) {
      imports.push(tpl("ERC1155/ERC1155Mintable.sol"));
      inheritance.push("ERC1155MintableFeature");
      constructorBody.push(`_grantRole(MINTER_ROLE, msg.sender);`);
    }

    /**
     * Burnable (logic-only feature)
     *
     * Requirements:
     * - Template must inherit ERC1155Base
     * - Template must NOT inherit OpenZeppelin ERC1155Burnable (it re-introduces ERC1155)
     * - burn/burnBatch authorization must match OpenZeppelin semantics:
     *   owner or approved operator
     */
    if (cleanModules.includes("burnable")) {
      imports.push(tpl("ERC1155/ERC1155Burnable.sol"));
      inheritance.push("ERC1155BurnableFeature");
    }

    /**
     * Pausable (logic-only feature)
     *
     * Requirements:
     * - Template must inherit ERC1155Base
     * - Template must NOT inherit OpenZeppelin ERC1155Pausable (it re-introduces ERC1155)
     * - Template must enforce pause at the transfer hook level by overriding _update
     *
     * Generator responsibilities:
     * - Include the module
     * - Grant PAUSER_ROLE to deployer at deployment time
     *
     * IMPORTANT:
     * - Generator does not emit _update overrides.
     * - Pausable enforcement lives inside the feature template to keep final contracts deterministic.
     */
    if (cleanModules.includes("pausable")) {
      imports.push(tpl("ERC1155/ERC1155Pausable.sol"));
      inheritance.push("ERC1155PausableFeature");
      constructorBody.push(`_grantRole(PAUSER_ROLE, msg.sender);`);
    }

    /**
     * Interface resolution
     *
     * supportsInterface is fully resolved inside ERC1155Base:
     * - override(ERC1155, AccessControl)
     *
     * Generator must NOT emit supportsInterface overrides for ERC1155 variants.
     *
     * Rationale:
     * - The final concrete contract does not directly inherit ERC1155
     * - Referencing ERC1155 in an override list triggers:
     *   "Invalid contract specified in override list"
     *
     * All interface resolution remains anchored in the single-root base.
     */
  }


  const source = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

${imports.join("\n")}

contract ${contractName} is
  ${inheritance.join(",\n  ")}
{
  constructor(${constructorArgs.join(", ")})
    ${constructorCalls.join(", ")}
  {
    ${constructorBody.join("\n    ")}
  }
${overrideFunctions.join("\n")}
}
`;

  const filename = `${contractName}.sol`;

const outDir = resolveOutputDir(options.outputDir);
ensureDir(outDir);

const outputPath = path.join(outDir, filename);
fs.writeFileSync(outputPath, source, "utf-8");

console.log("[generator] contract written to disk:", outputPath);

return filename;
}
/* ------------------------------------------------------------------
   Exports
------------------------------------------------------------------- */

module.exports = { generateContract };
