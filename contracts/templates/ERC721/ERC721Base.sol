// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * ChainForge — ERC721 Base (OZ v5 Compatible)
 *
 * Responsibilities:
 * - Establishes admin authority via AccessControl
 * - Provides deterministic supportsInterface override bridge
 *
 * Design:
 * - Does NOT include optional features (burn/pause/mint)
 * - Used as a shared base for generated ERC721 variants
 */

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

abstract contract ERC721Base is ERC721, AccessControl {
    constructor(string memory name_, string memory symbol_)
        ERC721(name_, symbol_)
    {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    /**
     * OZ v5: ERC721 and AccessControl both implement supportsInterface.
     * Any contract inheriting both must override and unify resolution.
     */
    function supportsInterface(bytes4 interfaceId)
        public
        view
        virtual
        override(ERC721, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
