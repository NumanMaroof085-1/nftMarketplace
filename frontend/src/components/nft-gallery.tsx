"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import type { MarketplaceNFT } from "@/types/nft";

async function fetchNFTs() {
  const response = await fetch("/api/nfts", { cache: "no-store" });
  const result = (await response.json()) as MarketplaceNFT[] | { error: string };

  if (!response.ok || "error" in result) {
    throw new Error("error" in result ? result.error : "Unable to load NFTs");
  }

  return result;
}

function shortenAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function NFTGallery() {
  const { data, error, isPending, refetch } = useQuery({
    queryKey: ["marketplace-nfts"],
    queryFn: fetchNFTs,
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
          <div className="nft-card-image">
            {nft.imageUrl ? (
              <img alt={nft.name} loading="lazy" src={nft.imageUrl} />
            ) : (
              <span>No image</span>
            )}
            <span className={`status-pill ${nft.listing ? "listed" : "owned"}`}>
              {nft.listing ? "For sale" : "Not listed"}
            </span>
          </div>
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
