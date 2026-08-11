"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useConnection, usePublicClient, useWriteContract } from "wagmi";
import { sepolia } from "wagmi/chains";

import { MARKETPLACE_ADDRESS } from "@/config/contracts";
import { marketplaceAbi } from "@/contracts/marketplace-abi";
import type { NFTListing } from "@/types/nft";

type ListingActionsProps = {
  listing: NFTListing;
  onUpdated: () => Promise<unknown>;
};

type ListingAction = "idle" | "buying" | "cancelling";

function getErrorMessage(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "shortMessage" in error &&
    typeof error.shortMessage === "string"
  ) {
    return error.shortMessage;
  }

  return error instanceof Error
    ? error.message
    : "The marketplace transaction failed";
}

export function ListingActions({ listing, onUpdated }: ListingActionsProps) {
  const { address, chainId, isConnected } = useConnection();
  const publicClient = usePublicClient({ chainId: sepolia.id });
  const queryClient = useQueryClient();
  const { mutateAsync: writeContractAsync } = useWriteContract();
  const [action, setAction] = useState<ListingAction>("idle");
  const [error, setError] = useState<string | null>(null);

  const isSeller = address?.toLowerCase() === listing.seller.toLowerCase();
  const isBusy = action !== "idle";

  async function refreshMarketplace() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["marketplace-nfts"] }),
      onUpdated(),
    ]);
  }

  async function handleBuy() {
    setError(null);

    if (!isConnected || !address) {
      setError("Connect the wallet that will buy this NFT.");
      return;
    }

    if (chainId !== sepolia.id) {
      setError("Switch to Sepolia before buying this NFT.");
      return;
    }

    if (isSeller) {
      setError("The seller cannot buy their own listing.");
      return;
    }

    if (!publicClient) {
      setError("The Sepolia connection is unavailable. Try again.");
      return;
    }

    try {
      setAction("buying");
      const transactionHash = await writeContractAsync({
        abi: marketplaceAbi,
        address: MARKETPLACE_ADDRESS,
        functionName: "buyListing",
        args: [BigInt(listing.listingId)],
        value: BigInt(listing.priceWei),
      });
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: transactionHash,
      });

      if (receipt.status !== "success") {
        throw new Error("The purchase transaction failed on Sepolia");
      }

      await refreshMarketplace();
    } catch (transactionError) {
      setError(getErrorMessage(transactionError));
    } finally {
      setAction("idle");
    }
  }

  async function handleCancel() {
    setError(null);

    if (!isConnected || !address) {
      setError("Connect the seller wallet to cancel this listing.");
      return;
    }

    if (chainId !== sepolia.id) {
      setError("Switch to Sepolia before cancelling this listing.");
      return;
    }

    if (!isSeller) {
      setError("Only the seller can cancel this listing.");
      return;
    }

    if (!publicClient) {
      setError("The Sepolia connection is unavailable. Try again.");
      return;
    }

    try {
      setAction("cancelling");
      const transactionHash = await writeContractAsync({
        abi: marketplaceAbi,
        address: MARKETPLACE_ADDRESS,
        functionName: "cancelListing",
        args: [BigInt(listing.listingId)],
      });
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: transactionHash,
      });

      if (receipt.status !== "success") {
        throw new Error("The cancellation transaction failed on Sepolia");
      }

      await refreshMarketplace();
    } catch (transactionError) {
      setError(getErrorMessage(transactionError));
    } finally {
      setAction("idle");
    }
  }

  if (!isConnected) {
    return (
      <div className="listing-actions-message">
        Connect a wallet to buy this NFT or manage the listing.
      </div>
    );
  }

  return (
    <div className="listing-actions">
      {isSeller ? (
        <>
          <p>You created this listing. Cancel it to remove the NFT from sale.</p>
          <button
            className="cancel-listing-button"
            disabled={isBusy || chainId !== sepolia.id}
            onClick={handleCancel}
            type="button"
          >
            {action === "cancelling"
              ? "Confirming cancellation on Sepolia…"
              : chainId !== sepolia.id
                ? "Switch to Sepolia to cancel"
                : "Cancel listing"}
          </button>
        </>
      ) : (
        <>
          <p>
            You will pay exactly {listing.priceEth} ETH plus the Sepolia gas
            fee.
          </p>
          <button
            className="buy-listing-button"
            disabled={isBusy || chainId !== sepolia.id}
            onClick={handleBuy}
            type="button"
          >
            {action === "buying"
              ? "Confirming purchase on Sepolia…"
              : chainId !== sepolia.id
                ? "Switch to Sepolia to buy"
                : `Buy for ${listing.priceEth} ETH`}
          </button>
        </>
      )}

      {error && (
        <p className="form-alert error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
