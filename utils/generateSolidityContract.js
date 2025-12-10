const fs = require("fs");
const path = require("path");

/* ============================================================
   ERC20 CONTRACT GENERATOR
   ============================================================ */
function generateERC20Contract({ tokenName, tokenSymbol, initialSupply, decimals, modules = [] }) {
  const timestamp = Date.now();
  const safeName = tokenName.replace(/\s+/g, "");
  const filename = `${safeName}_ERC20_${timestamp}.sol`;

  const useBurnable = modules.includes("burnable");
  const usePausable = modules.includes("pausable");
  const useMintable = modules.includes("mintable");
  const useGovernance = modules.includes("governance");
  const useTokenTransfer = modules.includes("tokenTransfer");

  const imports = [
    `import "@openzeppelin/contracts/token/ERC20/ERC20.sol";`,
    `import "@openzeppelin/contracts/access/AccessControl.sol";`,
  ];

  if (useBurnable) imports.push(`import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";`);
  if (usePausable) imports.push(`import "@openzeppelin/contracts/utils/Pausable.sol";`);

  const bases = ["ERC20", "AccessControl"];
  if (useBurnable) bases.push("ERC20Burnable");
  if (usePausable) bases.push("Pausable");

  const baseContracts = bases.join(", ");

  const roleLines = [
    `bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");`,
  ];
  if (usePausable) roleLines.push(`bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");`);
  if (useGovernance) roleLines.push(`bytes32 public constant GOVERNANCE_ROLE = keccak256("GOVERNANCE_ROLE");`);

  const stateVars = [`uint8 private _customDecimals;`];

  if (useGovernance) {
    stateVars.push(`
    struct Proposal {
        string description;
        uint256 voteCount;
        bool executed;
    }

    mapping(uint256 => Proposal) public proposals;
    `);
  }

  const ctorBody = [];
  const finalDecimals = Number.isFinite(Number(decimals)) && Number(decimals) > 0 ? Number(decimals) : 18;
  ctorBody.push(`_customDecimals = uint8(${finalDecimals});`);

  ctorBody.push(`_grantRole(DEFAULT_ADMIN_ROLE, msg.sender);`);
  ctorBody.push(`_grantRole(MINTER_ROLE, msg.sender);`);
  if (usePausable) ctorBody.push(`_grantRole(PAUSER_ROLE, msg.sender);`);
  if (useGovernance) ctorBody.push(`_grantRole(GOVERNANCE_ROLE, msg.sender);`);

  if (Number(initialSupply) > 0) {
    ctorBody.push(`
      _mint(msg.sender, initialSupply * (10 ** uint256(_customDecimals)));
    `);
  }

  const functions = [];

  functions.push(`
    function decimals() public view override returns (uint8) {
        return _customDecimals;
    }
  `);

  if (useMintable) {
    functions.push(`
    function mint(address to, uint256 amount) public onlyRole(MINTER_ROLE) {
        _mint(to, amount);
    }
    `);
  }

  if (usePausable) {
    functions.push(`
    function pause() public onlyRole(PAUSER_ROLE) { _pause(); }
    function unpause() public onlyRole(PAUSER_ROLE) { _unpause(); }
    `);
  }

  if (usePausable || useTokenTransfer) {
    let body = [];
    if (usePausable) body.push(`require(!paused(), "Token is paused");`);
    if (useTokenTransfer) body.push(`// Custom token transfer logic placeholder`);  
    body.push(`super._update(from, to, value);`);

    functions.push(`
    function _update(address from, address to, uint256 value)
        internal override(ERC20)
    {
        ${body.join("\n        ")}
    }
    `);
  }

  if (useGovernance) {
    functions.push(`
    event ProposalCreated(uint256 id, string description);
    event Voted(uint256 id, address voter, uint256 weight);
    event ProposalExecuted(uint256 id);

    function createProposal(uint256 id, string memory description) public onlyRole(GOVERNANCE_ROLE) { 
        require(bytes(proposals[id].description).length == 0, "Already exists");
        proposals[id] = Proposal(description, 0, false);
        emit ProposalCreated(id, description);
    }

    function vote(uint256 id, uint256 weight) public {
        Proposal storage p = proposals[id];
        require(!p.executed, "Executed");
        require(balanceOf(msg.sender) >= weight, "Not enough tokens");
        p.voteCount += weight;
        emit Voted(id, msg.sender, weight);
    }

    function executeProposal(uint256 id) public onlyRole(GOVERNANCE_ROLE) {
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

contract ${safeName} is ${baseContracts} {
    ${roleLines.join("\n    ")}

    ${stateVars.join("\n    ")}

    constructor(uint256 initialSupply) ERC20("${tokenName}", "${tokenSymbol}") {
        ${ctorBody.join("\n        ")}
    }

    ${functions.join("\n")}
}
`;

  const savePath = path.join(__dirname, "..", "generated_contracts", filename);
  fs.writeFileSync(savePath, solidity);

  return [filename];
}

/* ============================================================
   ERC721 CONTRACT GENERATOR
   ============================================================ */
function generateERC721Contract({ tokenName, tokenSymbol, modules = [] }) {
  const timestamp = Date.now();
  const safeName = tokenName.replace(/\s+/g, "");
  const filename = `${safeName}_ERC721_${timestamp}.sol`;

  const imports = [
    `import "@openzeppelin/contracts/token/ERC721/ERC721.sol";`,
    `import "@openzeppelin/contracts/access/AccessControl.sol";`,
  ];

  const bases = ["ERC721", "AccessControl"];

  const solidity = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

${imports.join("\n")}

contract ${safeName} is ${bases.join(", ")} {

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    uint256 private _nextTokenId = 1;

    constructor() ERC721("${tokenName}", "${tokenSymbol}") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
    }

    function safeMint(address to) public onlyRole(MINTER_ROLE) returns (uint256) {
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

  const savePath = path.join(__dirname, "..", "generated_contracts", filename);
  fs.writeFileSync(savePath, solidity);

  return [filename];
}

/* ============================================================
   ERC1155 CONTRACT GENERATOR (MISSING BEFORE — NOW FIXED)
   ============================================================ */
function generateERC1155Contract({ tokenName, baseURI }) {
  const timestamp = Date.now();
  const safeName = tokenName.replace(/\s+/g, "");
  const filename = `${safeName}_ERC1155_${timestamp}.sol`;

  const solidity = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract ${safeName} is ERC1155, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    constructor(string memory uri) ERC1155(uri) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
    }

    function mint(address to, uint256 id, uint256 amount) public onlyRole(MINTER_ROLE) {
        _mint(to, id, amount, "");
    }

    function mintBatch(address to, uint256[] memory ids, uint256[] memory amounts)
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

  const savePath = path.join(__dirname, "..", "generated_contracts", filename);
  fs.writeFileSync(savePath, solidity);

  return [filename];
}

/* ============================================================
   EXPORT ALL GENERATORS
   ============================================================ */
module.exports = {
  generateERC20Contract,
  generateERC721Contract,
  generateERC1155Contract,
};
