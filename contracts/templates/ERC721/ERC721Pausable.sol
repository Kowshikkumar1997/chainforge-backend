// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * ChainForge — ERC721 Pausable Feature (Role-Based)
 *
 * Notes:
 * - Uses OZ Pausable only (NOT ERC721Pausable)
 * - Enforcement is done by overriding _update() in the FINAL contract
 *
 * Requirements:
 * - Host contract must inherit ERC721Base + Pausable + AccessControl
 */

import "@openzeppelin/contracts/utils/Pausable.sol";
import "./ERC721Base.sol";

abstract contract ERC721PausableFeature is ERC721Base, Pausable {
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }
}
