"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { ListingForm } from "@/components/listing-form";
import { ListingActions } from "@/components/listing-actions";
import {
  NFT_ADDRESS,
  SEPOLIA_EXPLORER_URL,
} from "@/config/contracts";
import type { MarketplaceNFT } from "@/types/nft";

async function fetchNFT(tokenId: string) {
  const response = await fetch(`/api/nfts/${tokenId}`, { cache: "no-store" });
  const result = (await response.json()) as MarketplaceNFT | { error: string };

  if (!response.ok || "error" in result) {
    throw new Error("error" in result ? result.error : "Unable to load NFT");
  }

  return result;
}

function shortenAddress(address: string) {
  return `${address.slice(0, 8)}…${address.slice(-6)}`;
}

export function NFTDetails({ tokenId }: { tokenId: string }) {
  const { data: nft, error, isPending, refetch } = useQuery({
    queryKey: ["marketplace-nft", tokenId],
    queryFn: () => fetchNFT(tokenId),
  });

  if (isPending) {
    return <div className="details-state">Loading NFT from Sepolia and IPFS…</div>;
  }

  if (error || !nft) {
    return (
      <div className="details-state error-state">
        <strong>NFT #{tokenId} could not be loaded.</strong>
        <p>{error?.message}</p>
        <button onClick={() => refetch()}>Try again</button>
      </div>
    );
  }

  return (
    <div className="nft-details-grid">
      <section className="details-image-panel">
        {nft.imageUrl ? (
          <img alt={nft.name} src={nft.imageUrl} />
        ) : (
          <span>No NFT image available</span>
        )}
      </section>

      <section className="details-content">
        <div className="details-title">
          <div>
            <p className="eyebrow">DaFi Marketplace NFT #{nft.tokenId}</p>
            <h1>{nft.name}</h1>
          </div>
          <span className={`status-pill ${nft.listing ? "listed" : "owned"}`}>
            {nft.listing ? "For sale" : "Owned"}
          </span>
        </div>

        <p className="details-description">{nft.description}</p>

        {nft.attributes.length > 0 && (
          <div className="attribute-grid">
            {nft.attributes.map((attribute, index) => (
              <div key={`${attribute.trait_type}-${index}`}>
                <span>{attribute.trait_type}</span>
                <strong>{attribute.value}</strong>
              </div>
            ))}
          </div>
        )}

        <dl className="details-facts">
          <div>
            <dt>Current owner</dt>
            <dd>{shortenAddress(nft.owner)}</dd>
          </div>
          <div>
            <dt>Creator</dt>
            <dd>{shortenAddress(nft.creator)}</dd>
          </div>
          <div>
            <dt>Contract</dt>
            <dd>
              <a
                href={`${SEPOLIA_EXPLORER_URL}/address/${NFT_ADDRESS}`}
                rel="noreferrer"
                target="_blank"
              >
                {shortenAddress(NFT_ADDRESS)}
              </a>
            </dd>
          </div>
          <div>
            <dt>Token ID</dt>
            <dd>{nft.tokenId}</dd>
          </div>
        </dl>

        <div className="sale-panel">
          {nft.listing ? (
            <div className="active-listing">
              <span>Current price</span>
              <strong>{nft.listing.priceEth} ETH</strong>
              <p>Seller {shortenAddress(nft.listing.seller)}</p>
              <ListingActions listing={nft.listing} onUpdated={refetch} />
            </div>
          ) : (
            <>
              <div className="sale-panel-heading">
                <h2>List this NFT</h2>
                <p>Approval and listing are separate Sepolia transactions.</p>
              </div>
              <ListingForm
                onListed={refetch}
                owner={nft.owner}
                tokenId={nft.tokenId}
              />
            </>
          )}
        </div>

        <Link className="back-link" href="/#discover">
          Back to discovery
        </Link>
      </section>
    </div>
  );
}
