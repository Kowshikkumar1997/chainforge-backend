// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./ERC20Base.sol";

abstract contract ERC20MintableFeature is ERC20Base {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        _mint(to, amount);
    }
}
