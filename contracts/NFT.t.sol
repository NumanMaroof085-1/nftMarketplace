// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {NFT} from "./NFT.sol";
import {Test} from "forge-std/Test.sol";

contract NFTTest is Test {
    NFT private nft;

    address private alice;
    address private bob;

    string private constant METADATA_URI =
        "ipfs://bafy-example-metadata-cid";

    event NFTMinted(
        address indexed creator,
        uint256 indexed tokenId,
        string tokenURI
    );

    function setUp() public {
        nft = new NFT();

        alice = makeAddr("alice");
        bob = makeAddr("bob");
    }

    function test_CollectionHasCorrectNameAndSymbol() public view {
        assertEq(nft.name(), "DaFi Marketplace NFT");
        assertEq(nft.symbol(), "DMNFT");
    }

    function test_MintAssignsOwnershipAndTokenURI() public {
        vm.prank(alice);
        uint256 tokenId = nft.mintNFT(METADATA_URI);

        assertEq(tokenId, 1);
        assertEq(nft.ownerOf(tokenId), alice);
        assertEq(nft.tokenURI(tokenId), METADATA_URI);
        assertEq(nft.balanceOf(alice), 1);
    }

    function test_MintUsesSequentialTokenIds() public {
        vm.prank(alice);
        uint256 firstTokenId = nft.mintNFT(METADATA_URI);

        vm.prank(bob);
        uint256 secondTokenId = nft.mintNFT(
            "ipfs://bafy-second-metadata-cid"
        );

        assertEq(firstTokenId, 1);
        assertEq(secondTokenId, 2);
        assertEq(nft.ownerOf(firstTokenId), alice);
        assertEq(nft.ownerOf(secondTokenId), bob);
    }

    function test_MintEmitsNFTMintedEvent() public {
        vm.expectEmit(true, true, false, true);

        emit NFTMinted(alice, 1, METADATA_URI);

        vm.prank(alice);
        nft.mintNFT(METADATA_URI);
    }

    function test_MintRevertsForEmptyTokenURI() public {
        vm.prank(alice);
        vm.expectRevert(NFT.EmptyTokenURI.selector);

        nft.mintNFT("");
    }
}