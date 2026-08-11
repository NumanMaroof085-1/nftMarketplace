"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useConnection } from "wagmi";

import { SEPOLIA_EXPLORER_URL } from "@/config/contracts";
import type {
  AccountListingRecord,
  MarketplaceAccountData,
  MarketplaceNFT,
} from "@/types/nft";

type AccountTab = "myNfts" | "myListings" | "purchased" | "sold";

type ActivityItem = {
  key: string;
  nft: MarketplaceNFT;
  priceEth: string | null;
  status: "owned" | "listed" | "active" | "purchased" | "sold" | "cancelled";
  transactionHash: `0x${string}` | null;
};

const tabs: { id: AccountTab; label: string }[] = [
  { id: "myNfts", label: "My NFTs" },
  { id: "myListings", label: "My Listings" },
  { id: "purchased", label: "Purchased NFTs" },
  { id: "sold", label: "Sold NFTs" },
];

const emptyMessages: Record<AccountTab, string> = {
  myNfts: "This wallet does not currently own an NFT from this collection.",
  myListings: "This wallet has not created any marketplace listings.",
  purchased: "This wallet has not purchased an NFT through the marketplace.",
  sold: "This wallet has not completed an NFT sale yet.",
};

async function fetchAccountData(address: `0x${string}`) {
  const response = await fetch(`/api/account/${address}`, { cache: "no-store" });
  const result = (await response.json()) as
    | MarketplaceAccountData
    | { error: string };

  if (!response.ok || "error" in result) {
    throw new Error(
      "error" in result ? result.error : "Unable to load account activity",
    );
  }

  return result;
}

function toActivityItem(
  tab: AccountTab,
  nftOrRecord: MarketplaceNFT | AccountListingRecord,
): ActivityItem {
  if (tab === "myNfts") {
    const nft = nftOrRecord as MarketplaceNFT;

    return {
      key: `nft-${nft.tokenId}`,
      nft,
      priceEth: nft.listing?.priceEth ?? null,
      status: nft.listing ? "listed" : "owned",
      transactionHash: null,
    };
  }

  const record = nftOrRecord as AccountListingRecord;

  return {
    key: `${tab}-${record.listingId}`,
    nft: record.nft,
    priceEth: record.priceEth,
    status:
      tab === "purchased"
        ? "purchased"
        : tab === "sold"
          ? "sold"
          : record.status,
    transactionHash: record.transactionHash,
  };
}

function ActivityArtwork({ nft }: { nft: MarketplaceNFT }) {
  const [imageFailed, setImageFailed] = useState(false);

  if (!nft.imageUrl || imageFailed) {
    return <span>{nft.metadataAvailable ? "No image" : "IPFS unavailable"}</span>;
  }

  return (
    <img
      alt={nft.name}
      loading="lazy"
      onError={() => setImageFailed(true)}
      src={nft.imageUrl}
    />
  );
}

export function AccountActivity() {
  const { address, isConnected } = useConnection();
  const [activeTab, setActiveTab] = useState<AccountTab>("myNfts");
  const { data, error, isPending, refetch } = useQuery({
    queryKey: ["marketplace-account", address],
    queryFn: () => fetchAccountData(address!),
    enabled: isConnected && Boolean(address),
  });

  if (!isConnected || !address) return null;

  const activeRecords = data?.[activeTab] ?? [];
  const activityItems = activeRecords.map((record) =>
    toActivityItem(activeTab, record),
  );

  return (
    <section className="account-activity-section" aria-labelledby="activity-heading">
      <div className="account-activity-heading">
        <div>
          <p className="eyebrow">On-chain wallet history</p>
          <h2 id="activity-heading">Your NFT activity</h2>
        </div>
        <p>
          Ownership comes from the NFT contract. Listing and trade history comes
          from marketplace events.
        </p>
      </div>

      <div className="account-tabs" role="tablist" aria-label="NFT activity">
        {tabs.map((tab) => (
          <button
            aria-selected={activeTab === tab.id}
            className={activeTab === tab.id ? "active" : ""}
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            role="tab"
            type="button"
          >
            {tab.label}
            <span>{data?.[tab.id].length ?? 0}</span>
          </button>
        ))}
      </div>

      {isPending ? (
        <div className="account-activity-grid" aria-label="Loading wallet activity">
          {[0, 1, 2].map((item) => (
            <div className="account-activity-card activity-skeleton" key={item} />
          ))}
        </div>
      ) : error ? (
        <div className="account-activity-state error-state" role="alert">
          <strong>Wallet activity could not be loaded.</strong>
          <p>{error.message}</p>
          <button onClick={() => refetch()}>Try again</button>
        </div>
      ) : activityItems.length === 0 ? (
        <div className="account-activity-state">
          <strong>Nothing here yet.</strong>
          <p>{emptyMessages[activeTab]}</p>
        </div>
      ) : (
        <div className="account-activity-grid">
          {activityItems.map((item) => (
            <article className="account-activity-card" key={item.key}>
              <Link href={`/nft/${item.nft.tokenId}`}>
                <div className="account-activity-image">
                  <ActivityArtwork nft={item.nft} />
                  <span className={`activity-status ${item.status}`}>
                    {item.status}
                  </span>
                </div>
                <div className="account-activity-card-body">
                  <p>Token #{item.nft.tokenId}</p>
                  <h3>{item.nft.name}</h3>
                  {item.priceEth && <strong>{item.priceEth} ETH</strong>}
                </div>
              </Link>
              {item.transactionHash && (
                <a
                  className="activity-transaction-link"
                  href={`${SEPOLIA_EXPLORER_URL}/tx/${item.transactionHash}`}
                  rel="noreferrer"
                  target="_blank"
                >
                  View transaction
                </a>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
