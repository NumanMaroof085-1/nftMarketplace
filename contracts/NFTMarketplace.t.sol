// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {NFT} from "./NFT.sol";
import {NFTMarketplace} from "./NFTMarketplace.sol";
import {IERC721Receiver} from
    "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {Test} from "forge-std/Test.sol";

contract RejectingSeller is IERC721Receiver {
    function mintAndList(
        NFT nft,
        NFTMarketplace marketplace,
        string calldata tokenURI,
        uint256 price
    ) external returns (uint256 listingId) {
        uint256 mintedTokenId = nft.mintNFT(tokenURI);
        nft.approve(address(marketplace), mintedTokenId);

        listingId = marketplace.createListing(
            address(nft),
            mintedTokenId,
            price
        );
    }

    function withdraw(NFTMarketplace marketplace) external {
        marketplace.withdrawProceeds();
    }

    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }

    receive() external payable {
        revert("RejectingSeller: payment rejected");
    }
}

contract NFTMarketplaceTest is Test {
    NFT private nft;
    NFTMarketplace private marketplace;

    address private seller;
    address private buyer;
    address private feeRecipient;
    address private thirdParty;

    uint256 private tokenId;

    uint256 private constant PRICE = 1 ether;
    string private constant TOKEN_URI =
        "ipfs://bafy-marketplace-test-metadata";

    event NFTListed(
        uint256 indexed listingId,
        address indexed nftContract,
        address indexed seller,
        uint256 tokenId,
        uint256 price
    );

    event ListingCancelled(
        uint256 indexed listingId,
        address indexed seller
    );

    event NFTSold(
        uint256 indexed listingId,
        address indexed seller,
        address indexed buyer,
        uint256 price,
        uint256 marketplaceFee
    );

    event ProceedsWithdrawn(
        address indexed account,
        uint256 amount
    );

    function setUp() public {
        seller = makeAddr("seller");
        buyer = makeAddr("buyer");
        feeRecipient = makeAddr("feeRecipient");
        thirdParty = makeAddr("thirdParty");

        vm.deal(seller, 10 ether);
        vm.deal(buyer, 10 ether);
        vm.deal(thirdParty, 10 ether);

        nft = new NFT();
        marketplace = new NFTMarketplace(feeRecipient);

        vm.prank(seller);
        tokenId = nft.mintNFT(TOKEN_URI);
    }

    function test_ConstructorStoresConfiguration() public view {
        assertEq(marketplace.feeRecipient(), feeRecipient);
        assertEq(marketplace.MARKETPLACE_FEE_BPS(), 250);
        assertEq(marketplace.BASIS_POINTS(), 10_000);
    }

    function test_ConstructorRevertsForZeroFeeRecipient() public {
        vm.expectRevert(
            NFTMarketplace.InvalidFeeRecipient.selector
        );

        new NFTMarketplace(address(0));
    }

    function test_CreateListingStoresListingData() public {
        vm.prank(seller);
        nft.approve(address(marketplace), tokenId);

        vm.prank(seller);
        uint256 listingId = marketplace.createListing(
            address(nft),
            tokenId,
            PRICE
        );

        NFTMarketplace.Listing memory listing =
            marketplace.getListing(listingId);

        assertEq(listing.listingId, 1);
        assertEq(listing.nftContract, address(nft));
        assertEq(listing.tokenId, tokenId);
        assertEq(listing.seller, seller);
        assertEq(listing.buyer, address(0));
        assertEq(listing.price, PRICE);

        assertEq(
            uint256(listing.status),
            uint256(NFTMarketplace.ListingStatus.Active)
        );

        assertEq(
            marketplace.activeListingIdForToken(
                address(nft),
                tokenId
            ),
            listingId
        );

        assertEq(marketplace.totalListings(), 1);
    }

    function test_CreateListingEmitsNFTListedEvent() public {
        vm.prank(seller);
        nft.approve(address(marketplace), tokenId);

        vm.expectEmit(true, true, true, true);

        emit NFTListed(
            1,
            address(nft),
            seller,
            tokenId,
            PRICE
        );

        vm.prank(seller);
        marketplace.createListing(address(nft), tokenId, PRICE);
    }

    function test_CreateListingRevertsForZeroPrice() public {
        vm.prank(seller);
        vm.expectRevert(NFTMarketplace.InvalidPrice.selector);

        marketplace.createListing(address(nft), tokenId, 0);
    }

    function test_CreateListingRevertsForInvalidNFTContract() public {
        vm.expectRevert(
            NFTMarketplace.InvalidNFTContract.selector
        );

        marketplace.createListing(address(0), tokenId, PRICE);
    }

    function test_CreateListingRevertsWhenCallerIsNotOwner() public {
        vm.prank(buyer);
        vm.expectRevert(
            NFTMarketplace.NotTokenOwner.selector
        );

        marketplace.createListing(
            address(nft),
            tokenId,
            PRICE
        );
    }

    function test_CreateListingRevertsWithoutApproval() public {
        vm.prank(seller);
        vm.expectRevert(
            NFTMarketplace.MarketplaceNotApproved.selector
        );

        marketplace.createListing(
            address(nft),
            tokenId,
            PRICE
        );
    }

    function test_CreateListingAllowsApprovalForAll() public {
        vm.prank(seller);
        nft.setApprovalForAll(address(marketplace), true);

        vm.prank(seller);
        uint256 listingId = marketplace.createListing(
            address(nft),
            tokenId,
            PRICE
        );

        assertEq(listingId, 1);
    }

    function test_CreateListingRevertsWhenAlreadyListed() public {
        vm.prank(seller);
        nft.approve(address(marketplace), tokenId);

        vm.prank(seller);
        marketplace.createListing(address(nft), tokenId, PRICE);

        vm.prank(seller);
        vm.expectRevert(NFTMarketplace.AlreadyListed.selector);

        marketplace.createListing(address(nft), tokenId, PRICE);
    }

    function test_GetListingRevertsForUnknownListing() public {
        vm.expectRevert(
            NFTMarketplace.ListingNotFound.selector
        );

        marketplace.getListing(999);
    }

    function test_CreateListingRejectsNonexistentToken() public {
        vm.expectRevert();

        marketplace.createListing(
            address(nft),
            999,
            PRICE
        );
    }

    function test_CancelListingUpdatesListingState() public {
        uint256 listingId = _createListing();

        vm.prank(seller);
        marketplace.cancelListing(listingId);

        NFTMarketplace.Listing memory listing =
            marketplace.getListing(listingId);

        assertEq(
            uint256(listing.status),
            uint256(NFTMarketplace.ListingStatus.Cancelled)
        );

        assertEq(
            marketplace.activeListingIdForToken(
                address(nft),
                tokenId
            ),
            0
        );

        assertEq(nft.ownerOf(tokenId), seller);
    }

    function test_CancelListingEmitsEvent() public {
        uint256 listingId = _createListing();

        vm.expectEmit(true, true, false, false);
        emit ListingCancelled(listingId, seller);

        vm.prank(seller);
        marketplace.cancelListing(listingId);
    }

    function test_CancelListingRevertsForNonSeller() public {
        uint256 listingId = _createListing();

        vm.prank(buyer);
        vm.expectRevert(
            NFTMarketplace.NotListingSeller.selector
        );

        marketplace.cancelListing(listingId);
    }

    function test_CancelListingRevertsForUnknownListing() public {
        vm.prank(seller);
        vm.expectRevert(
            NFTMarketplace.ListingNotFound.selector
        );

        marketplace.cancelListing(999);
    }

    function test_CancelListingRevertsWhenAlreadyCancelled() public {
        uint256 listingId = _createListing();

        vm.prank(seller);
        marketplace.cancelListing(listingId);

        vm.prank(seller);
        vm.expectRevert(
            NFTMarketplace.ListingNotActive.selector
        );

        marketplace.cancelListing(listingId);
    }

    function test_TokenCanBeListedAgainAfterCancellation() public {
        uint256 firstListingId = _createListing();

        vm.prank(seller);
        marketplace.cancelListing(firstListingId);

        vm.prank(seller);
        uint256 secondListingId = marketplace.createListing(
            address(nft),
            tokenId,
            PRICE
        );

        assertEq(firstListingId, 1);
        assertEq(secondListingId, 2);

        assertEq(
            marketplace.activeListingIdForToken(
                address(nft),
                tokenId
            ),
            secondListingId
        );
    }

    function test_BuyListingTransfersNFTAndRecordsProceeds() public {
        uint256 listingId = _createListing();
        uint256 expectedFee =
            (PRICE * marketplace.MARKETPLACE_FEE_BPS()) /
            marketplace.BASIS_POINTS();
        uint256 expectedSellerProceeds = PRICE - expectedFee;

        vm.prank(buyer);
        marketplace.buyListing{value: PRICE}(listingId);

        NFTMarketplace.Listing memory listing =
            marketplace.getListing(listingId);

        assertEq(
            uint256(listing.status),
            uint256(NFTMarketplace.ListingStatus.Sold)
        );
        assertEq(listing.buyer, buyer);
        assertEq(nft.ownerOf(tokenId), buyer);

        assertEq(
            marketplace.activeListingIdForToken(
                address(nft),
                tokenId
            ),
            0
        );

        assertEq(
            marketplace.pendingProceeds(seller),
            expectedSellerProceeds
        );
        assertEq(
            marketplace.pendingProceeds(feeRecipient),
            expectedFee
        );
        assertEq(address(marketplace).balance, PRICE);
    }

    function test_BuyListingEmitsNFTSoldEvent() public {
        uint256 listingId = _createListing();
        uint256 expectedFee =
            (PRICE * marketplace.MARKETPLACE_FEE_BPS()) /
            marketplace.BASIS_POINTS();

        vm.expectEmit(true, true, true, true);
        emit NFTSold(
            listingId,
            seller,
            buyer,
            PRICE,
            expectedFee
        );

        vm.prank(buyer);
        marketplace.buyListing{value: PRICE}(listingId);
    }

    function test_BuyListingRevertsForUnknownListing() public {
        vm.prank(buyer);
        vm.expectRevert(
            NFTMarketplace.ListingNotFound.selector
        );

        marketplace.buyListing{value: PRICE}(999);
    }

    function test_BuyListingRevertsForCancelledListing() public {
        uint256 listingId = _createListing();

        vm.prank(seller);
        marketplace.cancelListing(listingId);

        vm.prank(buyer);
        vm.expectRevert(
            NFTMarketplace.ListingNotActive.selector
        );

        marketplace.buyListing{value: PRICE}(listingId);
    }

    function test_BuyListingRevertsWhenSellerIsBuyer() public {
        uint256 listingId = _createListing();

        vm.prank(seller);
        vm.expectRevert(
            NFTMarketplace.CannotBuyOwnListing.selector
        );

        marketplace.buyListing{value: PRICE}(listingId);
    }

    function test_BuyListingRevertsForUnderpayment() public {
        uint256 listingId = _createListing();
        uint256 payment = PRICE - 1;

        vm.prank(buyer);
        vm.expectRevert(
            abi.encodeWithSelector(
                NFTMarketplace.IncorrectPayment.selector,
                PRICE,
                payment
            )
        );

        marketplace.buyListing{value: payment}(listingId);
    }

    function test_BuyListingRevertsForOverpayment() public {
        uint256 listingId = _createListing();
        uint256 payment = PRICE + 1;

        vm.prank(buyer);
        vm.expectRevert(
            abi.encodeWithSelector(
                NFTMarketplace.IncorrectPayment.selector,
                PRICE,
                payment
            )
        );

        marketplace.buyListing{value: payment}(listingId);
    }

    function test_BuyListingRevertsWhenSellerTransferredNFT() public {
        uint256 listingId = _createListing();

        vm.prank(seller);
        nft.transferFrom(seller, thirdParty, tokenId);

        vm.prank(buyer);
        vm.expectRevert(
            NFTMarketplace.SellerNoLongerOwnsToken.selector
        );

        marketplace.buyListing{value: PRICE}(listingId);
    }

    function test_BuyListingRevertsWhenApprovalWasRevoked() public {
        uint256 listingId = _createListing();

        vm.prank(seller);
        nft.approve(address(0), tokenId);

        vm.prank(buyer);
        vm.expectRevert(
            NFTMarketplace.ApprovalRevoked.selector
        );

        marketplace.buyListing{value: PRICE}(listingId);
    }

    function test_BuyListingRevertsWhenAlreadySold() public {
        uint256 listingId = _createListing();

        vm.prank(buyer);
        marketplace.buyListing{value: PRICE}(listingId);

        vm.prank(thirdParty);
        vm.expectRevert(
            NFTMarketplace.ListingNotActive.selector
        );

        marketplace.buyListing{value: PRICE}(listingId);
    }

    function test_BuyerCanRelistPurchasedNFT() public {
        uint256 firstListingId = _createListing();

        vm.prank(buyer);
        marketplace.buyListing{value: PRICE}(firstListingId);

        vm.prank(buyer);
        nft.approve(address(marketplace), tokenId);

        vm.prank(buyer);
        uint256 secondListingId = marketplace.createListing(
            address(nft),
            tokenId,
            2 ether
        );

        NFTMarketplace.Listing memory listing =
            marketplace.getListing(secondListingId);

        assertEq(secondListingId, 2);
        assertEq(listing.seller, buyer);
        assertEq(listing.price, 2 ether);
        assertEq(
            uint256(listing.status),
            uint256(NFTMarketplace.ListingStatus.Active)
        );
    }

    function test_SellerCanWithdrawProceeds() public {
        uint256 listingId = _createListing();
        uint256 expectedFee =
            (PRICE * marketplace.MARKETPLACE_FEE_BPS()) /
            marketplace.BASIS_POINTS();
        uint256 expectedSellerProceeds = PRICE - expectedFee;

        vm.prank(buyer);
        marketplace.buyListing{value: PRICE}(listingId);

        uint256 sellerBalanceBefore = seller.balance;

        vm.prank(seller);
        marketplace.withdrawProceeds();

        assertEq(
            seller.balance,
            sellerBalanceBefore + expectedSellerProceeds
        );
        assertEq(marketplace.pendingProceeds(seller), 0);
        assertEq(address(marketplace).balance, expectedFee);
    }

    function test_FeeRecipientCanWithdrawFees() public {
        uint256 listingId = _createListing();
        uint256 expectedFee =
            (PRICE * marketplace.MARKETPLACE_FEE_BPS()) /
            marketplace.BASIS_POINTS();
        uint256 expectedSellerProceeds = PRICE - expectedFee;

        vm.prank(buyer);
        marketplace.buyListing{value: PRICE}(listingId);

        uint256 feeRecipientBalanceBefore = feeRecipient.balance;

        vm.prank(feeRecipient);
        marketplace.withdrawProceeds();

        assertEq(
            feeRecipient.balance,
            feeRecipientBalanceBefore + expectedFee
        );
        assertEq(marketplace.pendingProceeds(feeRecipient), 0);
        assertEq(
            address(marketplace).balance,
            expectedSellerProceeds
        );
    }

    function test_WithdrawProceedsRevertsWhenBalanceIsZero() public {
        vm.prank(buyer);
        vm.expectRevert(NFTMarketplace.NoProceeds.selector);

        marketplace.withdrawProceeds();
    }

    function test_WithdrawProceedsEmitsEvent() public {
        uint256 listingId = _createListing();
        uint256 expectedFee =
            (PRICE * marketplace.MARKETPLACE_FEE_BPS()) /
            marketplace.BASIS_POINTS();
        uint256 expectedSellerProceeds = PRICE - expectedFee;

        vm.prank(buyer);
        marketplace.buyListing{value: PRICE}(listingId);

        vm.expectEmit(true, false, false, true);
        emit ProceedsWithdrawn(seller, expectedSellerProceeds);

        vm.prank(seller);
        marketplace.withdrawProceeds();
    }

    function test_ProceedsAccumulateAcrossMultipleSales() public {
        uint256 firstListingId = _createListing();

        vm.prank(buyer);
        marketplace.buyListing{value: PRICE}(firstListingId);

        vm.prank(seller);
        uint256 secondTokenId = nft.mintNFT(
            "ipfs://bafy-second-sale-metadata"
        );

        vm.prank(seller);
        nft.approve(address(marketplace), secondTokenId);

        vm.prank(seller);
        uint256 secondListingId = marketplace.createListing(
            address(nft),
            secondTokenId,
            PRICE
        );

        vm.prank(buyer);
        marketplace.buyListing{value: PRICE}(secondListingId);

        uint256 expectedFeePerSale =
            (PRICE * marketplace.MARKETPLACE_FEE_BPS()) /
            marketplace.BASIS_POINTS();
        uint256 expectedProceedsPerSale =
            PRICE - expectedFeePerSale;

        assertEq(
            marketplace.pendingProceeds(seller),
            expectedProceedsPerSale * 2
        );
        assertEq(
            marketplace.pendingProceeds(feeRecipient),
            expectedFeePerSale * 2
        );
    }

    function test_FailedWithdrawalPreservesPendingProceeds() public {
        RejectingSeller rejectingSeller = new RejectingSeller();

        uint256 listingId = rejectingSeller.mintAndList(
            nft,
            marketplace,
            "ipfs://bafy-rejecting-seller-metadata",
            PRICE
        );

        vm.prank(buyer);
        marketplace.buyListing{value: PRICE}(listingId);

        uint256 expectedFee =
            (PRICE * marketplace.MARKETPLACE_FEE_BPS()) /
            marketplace.BASIS_POINTS();
        uint256 expectedSellerProceeds = PRICE - expectedFee;

        vm.expectRevert(
            NFTMarketplace.PaymentTransferFailed.selector
        );
        rejectingSeller.withdraw(marketplace);

        assertEq(
            marketplace.pendingProceeds(address(rejectingSeller)),
            expectedSellerProceeds
        );
    }

    function _createListing() internal returns (uint256 listingId) {
        vm.prank(seller);
        nft.approve(address(marketplace), tokenId);

        vm.prank(seller);
        listingId = marketplace.createListing(
            address(nft),
            tokenId,
            PRICE
        );
    }
}
