// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./ERC1155Base.sol";

abstract contract ERC1155Mintable is ERC1155Base {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    function mint(address to, uint256 id, uint256 amount, bytes memory data)
        external
        onlyRole(MINTER_ROLE)
    {
        _mint(to, id, amount, data);
    }
}
