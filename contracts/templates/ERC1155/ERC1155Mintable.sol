// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./ERC1155Base.sol";

/**
 * ERC1155MintableFeature
 *
 * Logic-only mint module.
 *
 * Notes:
 * - Inherits ERC1155 to access _mint/_mintBatch.
 * - Does not inherit AccessControl (avoids supportsInterface conflicts).
 * - Uses on-chain role check via hasRole on the final contract.
 */
abstract contract ERC1155MintableFeature is ERC1155Base {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    function mint(address to, uint256 id, uint256 amount, bytes calldata data) external {
        require(_hasRole(MINTER_ROLE, msg.sender), "ERC1155: missing MINTER_ROLE");
        _mint(to, id, amount, data);
    }

    function mintBatch(
        address to,
        uint256[] calldata ids,
        uint256[] calldata amounts,
        bytes calldata data
    )
        external
    {
        require(_hasRole(MINTER_ROLE, msg.sender), "ERC1155: missing MINTER_ROLE");
        _mintBatch(to, ids, amounts, data);
    }

    
}
