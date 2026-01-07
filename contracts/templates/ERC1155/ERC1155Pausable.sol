// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./ERC1155Base.sol";

abstract contract ERC1155PausableFeature is ERC1155Base {
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    function pause() external {
        require(_hasRole(PAUSER_ROLE, msg.sender), "ERC1155: missing PAUSER_ROLE");
        _pause();
    }

    function unpause() external {
        require(_hasRole(PAUSER_ROLE, msg.sender), "ERC1155: missing PAUSER_ROLE");
        _unpause();
    }
}
