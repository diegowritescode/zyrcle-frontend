// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title ZyrcleCertificate (ZCC)
 * @notice ERC-721 carbon-credit certificate. Reconstructed from the frontend
 *         ABI (`AbiCertificate.ts`): ERC721 + URIStorage + AccessControl with
 *         MINTER_ROLE and URI_SETTER_ROLE.
 *
 *         `safeMint` is gated behind MINTER_ROLE. In the original deployment a
 *         normal user wallet called `safeMint` directly and the tx reverted
 *         (the wallet lacked the role) — that was gap #2. We grant MINTER_ROLE
 *         to ZyrcleCore so minting always flows through the Core.
 *
 *         We also add ERC721Enumerable so the dApp can list a wallet's
 *         certificates with balanceOf + tokenOfOwnerByIndex, instead of scanning
 *         Transfer events (which broke against the 2048-block getLogs limit on
 *         public Avalanche RPCs — that was gap #3).
 */
contract ZyrcleCertificate is ERC721Enumerable, ERC721URIStorage, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant URI_SETTER_ROLE = keccak256("URI_SETTER_ROLE");

    uint256 private _nextTokenId;

    constructor(address admin) ERC721("Zyrcle Carbon Certificate", "ZCC") {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, admin);
        _grantRole(URI_SETTER_ROLE, admin);
    }

    /// @notice Mint a certificate to `to` with metadata at `uri`. Returns the new token id.
    function safeMint(address to, string memory uri)
        external
        onlyRole(MINTER_ROLE)
        returns (uint256)
    {
        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);
        return tokenId;
    }

    function setTokenURI(uint256 tokenId, string memory uri)
        external
        onlyRole(URI_SETTER_ROLE)
    {
        _setTokenURI(tokenId, uri);
    }

    // --- required overrides for multiple inheritance (OZ v5) ---

    function _update(address to, uint256 tokenId, address auth)
        internal
        override(ERC721, ERC721Enumerable)
        returns (address)
    {
        return super._update(to, tokenId, auth);
    }

    function _increaseBalance(address account, uint128 value)
        internal
        override(ERC721, ERC721Enumerable)
    {
        super._increaseBalance(account, value);
    }

    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721Enumerable, ERC721URIStorage, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
