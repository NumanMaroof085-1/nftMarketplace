// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {
    ERC721,
    ERC721URIStorage
} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";

contract NFT is ERC721URIStorage {
    uint256 private _nextTokenId = 1;

    error EmptyTokenURI();

    event NFTMinted(
        address indexed creator,
        uint256 indexed tokenId,
        string tokenURI
    );

    constructor() ERC721("DaFi Marketplace NFT", "DMNFT") {}

    function mintNFT(
        string calldata metadataURI
    ) external returns (uint256 tokenId) {
        if (bytes(metadataURI).length == 0) {
            revert EmptyTokenURI();
        }

        tokenId = _nextTokenId;
        _nextTokenId += 1;

        _safeMint(msg.sender, tokenId);
        _setTokenURI(tokenId, metadataURI);

        emit NFTMinted(msg.sender, tokenId, metadataURI);
    }
}