// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./ERC721Base.sol";

abstract contract ERC721Mintable is ERC721Base {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    uint256 internal _nextTokenId;

    function safeMint(address to) external onlyRole(MINTER_ROLE) returns (uint256) {
        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        return tokenId;
    }
}
