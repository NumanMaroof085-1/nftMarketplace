import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { network } from "hardhat";
import { parseEther } from "viem";

const TOKEN_ID = 1n;
const LISTING_ID = 1n;
const RESALE_LISTING_ID = 2n;
const PRICE = parseEther("1");
const RESALE_PRICE = parseEther("2");
const TOKEN_URI = "ipfs://bafy-end-to-end-metadata";

describe("NFT marketplace end-to-end lifecycle", function () {
  it("mints, lists, buys, withdraws, resells, and cancels", async function () {
    const { viem } = await network.create();
    const publicClient = await viem.getPublicClient();
    const [, seller, buyer, feeRecipient] =
      await viem.getWalletClients();

    const nft = await viem.deployContract("NFT");
    const marketplace = await viem.deployContract("NFTMarketplace", [
      feeRecipient.account.address,
    ]);

    await nft.write.mintNFT([TOKEN_URI], {
      account: seller.account,
    });

    assert.equal(
      (await nft.read.ownerOf([TOKEN_ID])).toLowerCase(),
      seller.account.address.toLowerCase(),
    );

    await nft.write.approve([marketplace.address, TOKEN_ID], {
      account: seller.account,
    });

    await marketplace.write.createListing(
      [nft.address, TOKEN_ID, PRICE],
      { account: seller.account },
    );

    const activeListing = await marketplace.read.getListing([
      LISTING_ID,
    ]);

    assert.equal(activeListing.seller.toLowerCase(), seller.account.address);
    assert.equal(activeListing.price, PRICE);
    assert.equal(activeListing.status, 1);

    await marketplace.write.buyListing([LISTING_ID], {
      account: buyer.account,
      value: PRICE,
    });

    const soldListing = await marketplace.read.getListing([LISTING_ID]);
    const expectedFee = (PRICE * 250n) / 10_000n;
    const expectedSellerProceeds = PRICE - expectedFee;

    assert.equal(soldListing.status, 2);
    assert.equal(
      soldListing.buyer.toLowerCase(),
      buyer.account.address.toLowerCase(),
    );
    assert.equal(
      (await nft.read.ownerOf([TOKEN_ID])).toLowerCase(),
      buyer.account.address.toLowerCase(),
    );
    assert.equal(
      await marketplace.read.pendingProceeds([
        seller.account.address,
      ]),
      expectedSellerProceeds,
    );
    assert.equal(
      await marketplace.read.pendingProceeds([
        feeRecipient.account.address,
      ]),
      expectedFee,
    );

    await marketplace.write.withdrawProceeds({
      account: seller.account,
    });

    assert.equal(
      await marketplace.read.pendingProceeds([
        seller.account.address,
      ]),
      0n,
    );
    assert.equal(
      await publicClient.getBalance({ address: marketplace.address }),
      expectedFee,
    );

    await nft.write.approve([marketplace.address, TOKEN_ID], {
      account: buyer.account,
    });

    await marketplace.write.createListing(
      [nft.address, TOKEN_ID, RESALE_PRICE],
      { account: buyer.account },
    );

    const resaleListing = await marketplace.read.getListing([
      RESALE_LISTING_ID,
    ]);

    assert.equal(
      resaleListing.seller.toLowerCase(),
      buyer.account.address.toLowerCase(),
    );
    assert.equal(resaleListing.price, RESALE_PRICE);
    assert.equal(resaleListing.status, 1);
    assert.equal(await marketplace.read.totalListings(), 2n);

    await marketplace.write.cancelListing([RESALE_LISTING_ID], {
      account: buyer.account,
    });

    const cancelledResale = await marketplace.read.getListing([
      RESALE_LISTING_ID,
    ]);

    assert.equal(cancelledResale.status, 3);
    assert.equal(
      await marketplace.read.activeListingIdForToken([
        nft.address,
        TOKEN_ID,
      ]),
      0n,
    );
  });
});
