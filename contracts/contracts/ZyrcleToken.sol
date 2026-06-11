// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title ZyrcleToken (ZYR)
 * @notice ERC-20 reward token for the Zyrcle recycling platform.
 *         Reconstructed from the frontend ABI (`TokenAbi.ts`): the app only
 *         used `balanceOf` and `mint`, but a full ERC-20 (with approve /
 *         transferFrom) is required so the marketplace can charge ZYR for
 *         certificates.
 *
 *         Minting is gated behind MINTER_ROLE, which is granted to ZyrcleCore
 *         so that verified recycling events can reward users on-chain.
 */
contract ZyrcleToken is ERC20, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    constructor(address admin) ERC20("Zyrcle Token", "ZYR") {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, admin);
    }

    /// @notice Mint reward tokens. Only callable by holders of MINTER_ROLE (e.g. ZyrcleCore).
    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        _mint(to, amount);
    }
}
