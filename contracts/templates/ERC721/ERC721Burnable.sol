// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * ChainForge — ERC721 Burnable Feature (Role-Based)
 *
 * Notes:
 * - Implements controlled burn via AccessControl
 * - Avoids inheriting OZ ERC721Burnable (prevents hook collisions)
 *
 * Requirements:
 * - Host contract must inherit ERC721Base (for _burn + AccessControl)
 */

import "./ERC721Base.sol";

abstract contract ERC721BurnableFeature is ERC721Base {
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");

    function burn(uint256 tokenId) external onlyRole(BURNER_ROLE) {
        _burn(tokenId);
    }
}
