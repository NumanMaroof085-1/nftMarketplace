"use client";

import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { parseEther } from "viem";
import { useConnection, usePublicClient, useWriteContract } from "wagmi";
import { sepolia } from "wagmi/chains";

import { MARKETPLACE_ADDRESS, NFT_ADDRESS } from "@/config/contracts";
import { marketplaceAbi } from "@/contracts/marketplace-abi";
import { nftAbi } from "@/contracts/nft-abi";

type ListingFormProps = {
  tokenId: string;
  owner: `0x${string}`;
  onListed: () => Promise<unknown>;
};

type ListingPhase = "idle" | "approving" | "listing";

function getErrorMessage(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "shortMessage" in error &&
    typeof error.shortMessage === "string"
  ) {
    return error.shortMessage;
  }

  return error instanceof Error ? error.message : "The listing failed";
}

export function ListingForm({ tokenId, owner, onListed }: ListingFormProps) {
  const { address, chainId, isConnected } = useConnection();
  const publicClient = usePublicClient({ chainId: sepolia.id });
  const queryClient = useQueryClient();
  const { mutateAsync: writeContractAsync } = useWriteContract();
  const [phase, setPhase] = useState<ListingPhase>("idle");
  const [error, setError] = useState<string | null>(null);

  const isOwner = address?.toLowerCase() === owner.toLowerCase();
  const isBusy = phase !== "idle";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!isConnected || !address) {
      setError("Connect the wallet that owns this NFT.");
      return;
    }

    if (chainId !== sepolia.id) {
      setError("Switch to Sepolia before listing this NFT.");
      return;
    }

    if (!isOwner) {
      setError("Only the current NFT owner can create this listing.");
      return;
    }

    if (!publicClient) {
      setError("The Sepolia connection is unavailable. Try again.");
      return;
    }

    const formData = new FormData(event.currentTarget);
    const priceText = String(formData.get("price") ?? "").trim();

    if (!/^\d+(\.\d{1,18})?$/.test(priceText)) {
      setError("Enter a valid ETH price with no more than 18 decimals.");
      return;
    }

    const price = parseEther(priceText);

    if (price === BigInt(0)) {
      setError("The listing price must be greater than zero.");
      return;
    }

    const numericTokenId = BigInt(tokenId);

    try {
      const [approvedAddress, approvedForAll] = await Promise.all([
        publicClient.readContract({
          abi: nftAbi,
          address: NFT_ADDRESS,
          functionName: "getApproved",
          args: [numericTokenId],
        }),
        publicClient.readContract({
          abi: nftAbi,
          address: NFT_ADDRESS,
          functionName: "isApprovedForAll",
          args: [address, MARKETPLACE_ADDRESS],
        }),
      ]);

      if (
        approvedAddress.toLowerCase() !== MARKETPLACE_ADDRESS.toLowerCase() &&
        !approvedForAll
      ) {
        setPhase("approving");
        const approvalHash = await writeContractAsync({
          abi: nftAbi,
          address: NFT_ADDRESS,
          functionName: "approve",
          args: [MARKETPLACE_ADDRESS, numericTokenId],
        });
        const approvalReceipt = await publicClient.waitForTransactionReceipt({
          hash: approvalHash,
        });

        if (approvalReceipt.status !== "success") {
          throw new Error("Marketplace approval failed on Sepolia");
        }
      }

      setPhase("listing");
      const listingHash = await writeContractAsync({
        abi: marketplaceAbi,
        address: MARKETPLACE_ADDRESS,
        functionName: "createListing",
        args: [NFT_ADDRESS, numericTokenId, price],
      });
      const listingReceipt = await publicClient.waitForTransactionReceipt({
        hash: listingHash,
      });

      if (listingReceipt.status !== "success") {
        throw new Error("Listing transaction failed on Sepolia");
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["marketplace-nfts"] }),
        onListed(),
      ]);
    } catch (transactionError) {
      setError(getErrorMessage(transactionError));
    } finally {
      setPhase("idle");
    }
  }

  if (!isConnected) {
    return (
      <div className="listing-message">
        Connect the owner wallet to list this NFT for sale.
      </div>
    );
  }

  if (!isOwner) {
    return (
      <div className="listing-message">
        This NFT can only be listed by its current owner.
      </div>
    );
  }

  return (
    <form className="listing-form" onSubmit={handleSubmit}>
      <div>
        <label htmlFor="listing-price">Price in ETH</label>
        <div className="price-input">
          <input
            autoComplete="off"
            disabled={isBusy}
            id="listing-price"
            inputMode="decimal"
            name="price"
            placeholder="0.05"
            required
          />
          <span>ETH</span>
        </div>
        <small>A 2.5% marketplace fee is collected after a successful sale.</small>
      </div>

      <ol className="listing-progress" aria-label="Listing progress">
        <li className={phase === "approving" ? "active" : ""}>
          <span>1</span> Approve marketplace
        </li>
        <li className={phase === "listing" ? "active" : ""}>
          <span>2</span> Create listing
        </li>
      </ol>

      {error && (
        <p className="form-alert error" role="alert">
          {error}
        </p>
      )}

      <button disabled={isBusy || chainId !== sepolia.id} type="submit">
        {phase === "approving"
          ? "Approve in MetaMask…"
          : phase === "listing"
            ? "Create listing in MetaMask…"
            : chainId !== sepolia.id
              ? "Switch to Sepolia to list"
              : "List NFT for sale"}
      </button>
    </form>
  );
}
