// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

abstract contract ERC1155Base is ERC1155, ERC1155Pausable, AccessControl {
    constructor(string memory uri_) ERC1155(uri_) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        virtual
        override(ERC1155, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    function _hasRole(bytes32 role, address account)
        internal
        view
        returns (bool)
    {
        return hasRole(role, account);
    }

    //  SINGLE _update override (authoritative)
    function _update(
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory values
    )
        internal
        virtual
        override(ERC1155, ERC1155Pausable)
    {
        super._update(from, to, ids, values);
    }
}
