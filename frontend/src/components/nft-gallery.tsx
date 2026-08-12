"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import type { MarketplaceNFT } from "@/types/nft";

async function fetchNFTs() {
  let response: Response;

  try {
    response = await fetch("/api/nfts", {
      signal: AbortSignal.timeout(22_000),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") {
      throw new Error("Sepolia data took too long to respond. Please try again.");
    }

    throw error;
  }

  const result = (await response.json().catch(() => ({
    error: `The marketplace data service returned status ${response.status}`,
  }))) as MarketplaceNFT[] | { error: string };

  if (!response.ok || "error" in result) {
    throw new Error("error" in result ? result.error : "Unable to load NFTs");
  }

  return result;
}

function shortenAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function NFTCardArtwork({ nft }: { nft: MarketplaceNFT }) {
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = nft.imageUrl && !imageFailed;

  return (
    <div className="nft-card-image">
      {showImage ? (
        <img
          alt={nft.name}
          loading="lazy"
          onError={() => setImageFailed(true)}
          src={nft.imageUrl}
        />
      ) : (
        <span>
          {nft.metadataAvailable ? "Image unavailable" : "Metadata unavailable"}
        </span>
      )}
      <span className={`status-pill ${nft.listing ? "listed" : "owned"}`}>
        {nft.listing ? "For sale" : "Not listed"}
      </span>
      {!nft.metadataAvailable && (
        <span className="metadata-status">IPFS file missing</span>
      )}
    </div>
  );
}

export function NFTGallery() {
  const { data, error, isPending, refetch } = useQuery({
    queryKey: ["marketplace-nfts"],
    queryFn: fetchNFTs,
    retry: false,
    staleTime: 15_000,
  });

  if (isPending) {
    return (
      <div className="nft-grid" aria-label="Loading NFTs">
        {[0, 1, 2].map((item) => (
          <div className="nft-card skeleton-card" key={item} aria-hidden="true">
            <div />
            <span />
            <span />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="gallery-state error-state" role="alert">
        <strong>Couldn’t load Sepolia NFTs.</strong>
        <p>{error.message}</p>
        <button onClick={() => refetch()}>Try again</button>
      </div>
    );
  }

  if (!data?.length) {
    return (
      <div className="gallery-state">
        <strong>No NFTs have been minted yet.</strong>
        <p>Create the first token in this verified Sepolia collection.</p>
        <Link href="/create">Create an NFT</Link>
      </div>
    );
  }

  return (
    <div className="nft-grid">
      {data.map((nft) => (
        <Link className="nft-card" href={`/nft/${nft.tokenId}`} key={nft.tokenId}>
          <NFTCardArtwork nft={nft} />
          <div className="nft-card-body">
            <div>
              <p>Token #{nft.tokenId}</p>
              <h3>{nft.name}</h3>
            </div>
            <div className="nft-card-meta">
              <span>
                Owner <strong>{shortenAddress(nft.owner)}</strong>
              </span>
              <span>
                {nft.listing ? (
                  <>
                    Price <strong>{nft.listing.priceEth} ETH</strong>
                  </>
                ) : (
                  <strong>View details</strong>
                )}
              </span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
