// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * ChainForge — ERC721 Mintable Feature (Role-Based)
 *
 * Responsibilities:
 * - Adds MINTER_ROLE
 * - Exposes mint(to, tokenId)
 *
 * Requirements:
 * - Host contract must inherit ERC721Base (for _safeMint + AccessControl)
 */

import "./ERC721Base.sol";

abstract contract ERC721MintableFeature is ERC721Base {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    function mint(address to, uint256 tokenId) external onlyRole(MINTER_ROLE) {
        _safeMint(to, tokenId);
    }
}
