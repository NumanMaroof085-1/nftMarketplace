// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC721} from
    "@openzeppelin/contracts/token/ERC721/IERC721.sol";

import {ReentrancyGuard} from
    "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract NFTMarketplace is ReentrancyGuard {
    uint256 public constant MARKETPLACE_FEE_BPS = 250;
    uint256 public constant BASIS_POINTS = 10_000;

    uint256 private _nextListingId = 1;

    address public immutable feeRecipient;

    enum ListingStatus {
        None,
        Active,
        Sold,
        Cancelled
    }

    struct Listing {
        uint256 listingId;
        address nftContract;
        uint256 tokenId;
        address seller;
        address buyer;
        uint256 price;
        ListingStatus status;
    }

    mapping(uint256 => Listing) private _listings;

    mapping(address => mapping(uint256 => uint256))
        public activeListingIdForToken;

    mapping(address => uint256) public pendingProceeds;

    error InvalidFeeRecipient();
    error InvalidPrice();
    error NotTokenOwner();
    error MarketplaceNotApproved();
    error AlreadyListed();
    error ListingNotActive();
    error NotListingSeller();
    error CannotBuyOwnListing();
    error IncorrectPayment(uint256 expected, uint256 received);
    error SellerNoLongerOwnsToken();
    error ApprovalRevoked();
    error NoProceeds();
    error PaymentTransferFailed();
    error InvalidNFTContract();
    error ListingNotFound();

    event NFTListed(
        uint256 indexed listingId,
        address indexed nftContract,
        address indexed seller,
        uint256 tokenId,
        uint256 price
    );

    event NFTSold(
        uint256 indexed listingId,
        address indexed seller,
        address indexed buyer,
        uint256 price,
        uint256 marketplaceFee
    );

    event ListingCancelled(
        uint256 indexed listingId,
        address indexed seller
    );

    event ProceedsWithdrawn(
        address indexed account,
        uint256 amount
    );

    constructor(address feeRecipient_) {
        if (feeRecipient_ == address(0)) {
            revert InvalidFeeRecipient();
        }

        feeRecipient = feeRecipient_;
    }

    function createListing(
        address nftContract,
        uint256 tokenId,
        uint256 price
    ) external returns (uint256 listingId) {
        if (price == 0) {
            revert InvalidPrice();
        }

        if (nftContract.code.length == 0) {
            revert InvalidNFTContract();
        }

        IERC721 nft = IERC721(nftContract);

        if (nft.ownerOf(tokenId) != msg.sender) {
            revert NotTokenOwner();
        }

        if (activeListingIdForToken[nftContract][tokenId] != 0) {
            revert AlreadyListed();
        }

        bool marketplaceApproved =
            nft.getApproved(tokenId) == address(this) ||
            nft.isApprovedForAll(msg.sender, address(this));

        if (!marketplaceApproved) {
            revert MarketplaceNotApproved();
        }

        listingId = _nextListingId;
        _nextListingId += 1;

        _listings[listingId] = Listing({
            listingId: listingId,
            nftContract: nftContract,
            tokenId: tokenId,
            seller: msg.sender,
            buyer: address(0),
            price: price,
            status: ListingStatus.Active
        });

        activeListingIdForToken[nftContract][tokenId] = listingId;

        emit NFTListed(
            listingId,
            nftContract,
            msg.sender,
            tokenId,
            price
        );
    }

    function cancelListing(uint256 listingId) external {
        Listing storage listing = _listings[listingId];

        if (listing.status == ListingStatus.None) {
            revert ListingNotFound();
        }

        if (listing.status != ListingStatus.Active) {
            revert ListingNotActive();
        }

        if (listing.seller != msg.sender) {
            revert NotListingSeller();
        }

        listing.status = ListingStatus.Cancelled;

        activeListingIdForToken[
            listing.nftContract
        ][listing.tokenId] = 0;

        emit ListingCancelled(listingId, msg.sender);
    }

    function buyListing(uint256 listingId) external payable nonReentrant {
        Listing storage listing = _listings[listingId];

        if (listing.status == ListingStatus.None) {
            revert ListingNotFound();
        }

        if (listing.status != ListingStatus.Active) {
            revert ListingNotActive();
        }

        if (msg.sender == listing.seller) {
            revert CannotBuyOwnListing();
        }

        if (msg.value != listing.price) {
            revert IncorrectPayment(listing.price, msg.value);
        }

        IERC721 nft = IERC721(listing.nftContract);

        if (nft.ownerOf(listing.tokenId) != listing.seller) {
            revert SellerNoLongerOwnsToken();
        }

        bool marketplaceApproved =
            nft.getApproved(listing.tokenId) == address(this) ||
            nft.isApprovedForAll(listing.seller, address(this));

        if (!marketplaceApproved) {
            revert ApprovalRevoked();
        }

        uint256 marketplaceFee =
            (listing.price * MARKETPLACE_FEE_BPS) / BASIS_POINTS;
        uint256 sellerProceeds = listing.price - marketplaceFee;

        listing.status = ListingStatus.Sold;
        listing.buyer = msg.sender;

        activeListingIdForToken[
            listing.nftContract
        ][listing.tokenId] = 0;

        pendingProceeds[listing.seller] += sellerProceeds;
        pendingProceeds[feeRecipient] += marketplaceFee;

        nft.safeTransferFrom(
            listing.seller,
            msg.sender,
            listing.tokenId
        );

        emit NFTSold(
            listingId,
            listing.seller,
            msg.sender,
            listing.price,
            marketplaceFee
        );
    }

    function withdrawProceeds() external nonReentrant {
        uint256 amount = pendingProceeds[msg.sender];

        if (amount == 0) {
            revert NoProceeds();
        }

        pendingProceeds[msg.sender] = 0;

        (bool success, ) = payable(msg.sender).call{value: amount}("");

        if (!success) {
            revert PaymentTransferFailed();
        }

        emit ProceedsWithdrawn(msg.sender, amount);
    }

    function getListing(
        uint256 listingId
    ) external view returns (Listing memory) {
        Listing memory listing = _listings[listingId];

        if (listing.status == ListingStatus.None) {
            revert ListingNotFound();
        }

        return listing;
    }

    function totalListings() external view returns (uint256) {
        return _nextListingId - 1;
    }
}
