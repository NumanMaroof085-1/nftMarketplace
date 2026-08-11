import type { Metadata } from "next";

import { NFTDetails } from "@/components/nft-details";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "NFT Details | NFT Marketplace",
  description: "View ownership, IPFS metadata, and listing details on Sepolia.",
};

export default async function NFTDetailsPage({
  params,
}: {
  params: Promise<{ tokenId: string }>;
}) {
  const { tokenId } = await params;

  return (
    <main className="site-shell">
      <SiteHeader active="discover" />
      <NFTDetails tokenId={tokenId} />
    </main>
  );
}
