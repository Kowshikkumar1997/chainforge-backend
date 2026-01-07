// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./ERC1155Base.sol";

abstract contract ERC1155BurnableFeature is ERC1155Base {
    function burn(address from, uint256 id, uint256 amount) external {
        require(
            from == msg.sender || isApprovedForAll(from, msg.sender),
            "ERC1155: caller is not owner nor approved"
        );
        _burn(from, id, amount);
    }

    function burnBatch(
        address from,
        uint256[] calldata ids,
        uint256[] calldata amounts
    ) external {
        require(
            from == msg.sender || isApprovedForAll(from, msg.sender),
            "ERC1155: caller is not owner nor approved"
        );
        _burnBatch(from, ids, amounts);
    }
}
