/**
 * ChainForge Solidity Contract Generators
 *
 * This module programmatically generates OpenZeppelin-based Solidity contracts
 * for ERC20, ERC721, and ERC1155 standards.
 *
 * Design goals:
 * - Deterministic, auditable contract generation
 * - No Solidity knowledge required from end users
 * - Modular feature composition without runtime mutation
 *
 * NOTE:
 * Contracts are generated as plain Solidity source files and compiled
 * via Hardhat as part of the deployment pipeline.
 */

const fs = require("fs");
const path = require("path");

/* ------------------------------------------------------------------
   Runtime-safe output directory
------------------------------------------------------------------- */

/**
 * Render (and similar platforms) provide a writable ephemeral filesystem
 * under /tmp. This base directory is configurable for local development
 * but defaults to a safe production location.
 */
const RUNTIME_BASE_DIR = process.env.RUNTIME_BASE_DIR || "/tmp/chainforge";
const GENERATED_CONTRACTS_DIR = path.join(
  RUNTIME_BASE_DIR,
  "generated_contracts"
);

// Ensure output directory exists
if (!fs.existsSync(GENERATED_CONTRACTS_DIR)) {
  fs.mkdirSync(GENERATED_CONTRACTS_DIR, { recursive: true });
}

/* ------------------------------------------------------------------
   Shared helpers
------------------------------------------------------------------- */

function sanitizeName(name) {
  return String(name || "").replace(/\s+/g, "").trim();
}

function writeContract(filename, source) {
  const outputPath = path.join(GENERATED_CONTRACTS_DIR, filename);
  fs.writeFileSync(outputPath, source, "utf-8");
  return outputPath;
}

/* ------------------------------------------------------------------
   ERC20 Generator
------------------------------------------------------------------- */

function generateERC20Contract({
  tokenName,
  tokenSymbol,
  initialSupply,
  decimals,
  modules = [],
}) {
  const timestamp = Date.now();
  const contractName = sanitizeName(tokenName);
  const filename = `${contractName}_ERC20_${timestamp}.sol`;

  const features = {
    burnable: modules.includes("burnable"),
    pausable: modules.includes("pausable"),
    mintable: modules.includes("mintable"),
    governance: modules.includes("governance"),
    tokenTransfer: modules.includes("tokenTransfer"),
  };

  const imports = [
    `import "@openzeppelin/contracts/token/ERC20/ERC20.sol";`,
    `import "@openzeppelin/contracts/access/AccessControl.sol";`,
  ];

  if (features.burnable) {
    imports.push(
      `import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";`
    );
  }

  if (features.pausable) {
    imports.push(`import "@openzeppelin/contracts/utils/Pausable.sol";`);
  }

  const inheritance = [
    "ERC20",
    "AccessControl",
    features.burnable && "ERC20Burnable",
    features.pausable && "Pausable",
  ].filter(Boolean);

  const roles = [
    `bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");`,
    features.pausable &&
      `bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");`,
    features.governance &&
      `bytes32 public constant GOVERNANCE_ROLE = keccak256("GOVERNANCE_ROLE");`,
  ].filter(Boolean);

  const resolvedDecimals =
    Number.isFinite(Number(decimals)) && Number(decimals) > 0
      ? Number(decimals)
      : 18;

  const constructorBody = [
    `_customDecimals = uint8(${resolvedDecimals});`,
    `_grantRole(DEFAULT_ADMIN_ROLE, msg.sender);`,
    `_grantRole(MINTER_ROLE, msg.sender);`,
    features.pausable && `_grantRole(PAUSER_ROLE, msg.sender);`,
    features.governance && `_grantRole(GOVERNANCE_ROLE, msg.sender);`,
    Number(initialSupply) > 0 &&
      `_mint(msg.sender, initialSupply * (10 ** uint256(_customDecimals)));`,
  ].filter(Boolean);

  const functions = [];

  functions.push(`
    function decimals() public view override returns (uint8) {
        return _customDecimals;
    }
  `);

  if (features.mintable) {
    functions.push(`
    function mint(address to, uint256 amount)
        public
        onlyRole(MINTER_ROLE)
    {
        _mint(to, amount);
    }
    `);
  }

  if (features.pausable) {
    functions.push(`
    function pause() public onlyRole(PAUSER_ROLE) { _pause(); }
    function unpause() public onlyRole(PAUSER_ROLE) { _unpause(); }
    `);
  }

  if (features.pausable || features.tokenTransfer) {
    const checks = [];
    if (features.pausable)
      checks.push(`require(!paused(), "Token is paused");`);
    checks.push(`super._update(from, to, value);`);

    functions.push(`
    function _update(address from, address to, uint256 value)
        internal
        override(ERC20)
    {
        ${checks.join("\n        ")}
    }
    `);
  }

  if (features.governance) {
    functions.push(`
    struct Proposal {
        string description;
        uint256 voteCount;
        bool executed;
    }

    mapping(uint256 => Proposal) public proposals;

    event ProposalCreated(uint256 id, string description);
    event Voted(uint256 id, address voter, uint256 weight);
    event ProposalExecuted(uint256 id);

    function createProposal(uint256 id, string memory description)
        public
        onlyRole(GOVERNANCE_ROLE)
    {
        require(bytes(proposals[id].description).length == 0, "Already exists");
        proposals[id] = Proposal(description, 0, false);
        emit ProposalCreated(id, description);
    }

    function vote(uint256 id, uint256 weight) public {
        Proposal storage p = proposals[id];
        require(!p.executed, "Executed");
        require(balanceOf(msg.sender) >= weight, "Insufficient balance");
        p.voteCount += weight;
        emit Voted(id, msg.sender, weight);
    }

    function executeProposal(uint256 id)
        public
        onlyRole(GOVERNANCE_ROLE)
    {
        Proposal storage p = proposals[id];
        require(!p.executed, "Executed");
        require(p.voteCount > 0, "No votes");
        p.executed = true;
        emit ProposalExecuted(id);
    }
    `);
  }

  const solidity = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

${imports.join("\n")}

contract ${contractName} is ${inheritance.join(", ")} {
    ${roles.join("\n    ")}

    uint8 private _customDecimals;

    constructor(uint256 initialSupply)
        ERC20("${tokenName}", "${tokenSymbol}")
    {
        ${constructorBody.join("\n        ")}
    }

    ${functions.join("\n")}
}
`;

  writeContract(filename, solidity);
  return [filename];
}

/* ------------------------------------------------------------------
   ERC721 Generator
------------------------------------------------------------------- */

function generateERC721Contract({ tokenName, tokenSymbol }) {
  const timestamp = Date.now();
  const contractName = sanitizeName(tokenName);
  const filename = `${contractName}_ERC721_${timestamp}.sol`;

  const solidity = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract ${contractName} is ERC721, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    uint256 private _nextTokenId = 1;

    constructor() ERC721("${tokenName}", "${tokenSymbol}") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
    }

    function safeMint(address to)
        public
        onlyRole(MINTER_ROLE)
        returns (uint256)
    {
        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        return tokenId;
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
`;

  writeContract(filename, solidity);
  return [filename];
}

/* ------------------------------------------------------------------
   ERC1155 Generator
------------------------------------------------------------------- */

function generateERC1155Contract({ tokenName, baseURI }) {
  const timestamp = Date.now();
  const contractName = sanitizeName(tokenName);
  const filename = `${contractName}_ERC1155_${timestamp}.sol`;

  const solidity = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract ${contractName} is ERC1155, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    constructor(string memory uri) ERC1155(uri) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
    }

    function mint(address to, uint256 id, uint256 amount)
        public
        onlyRole(MINTER_ROLE)
    {
        _mint(to, id, amount, "");
    }

    function mintBatch(
        address to,
        uint256[] memory ids,
        uint256[] memory amounts
    )
        public
        onlyRole(MINTER_ROLE)
    {
        _mintBatch(to, ids, amounts, "");
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC1155, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
`;

  writeContract(filename, solidity);
  return [filename];
}

/* ------------------------------------------------------------------
   Exports
------------------------------------------------------------------- */

module.exports = {
  generateERC20Contract,
  generateERC721Contract,
  generateERC1155Contract,
};
