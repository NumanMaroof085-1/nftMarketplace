import type { Metadata } from "next";

import { CreateNFTForm } from "@/components/create-nft-form";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "Create NFT | NFT Marketplace",
  description: "Upload NFT metadata to IPFS and mint an ERC-721 on Sepolia.",
};

export default function CreateNFTPage() {
  return (
    <main className="site-shell">
      <SiteHeader active="create" />
      <section className="create-page-heading">
        <p className="eyebrow">Create on Sepolia</p>
        <h1>Turn an image into an on-chain collectible.</h1>
        <p>
          The asset and metadata are stored on IPFS. Your wallet then mints the
          permanent ERC-721 token.
        </p>
      </section>
      <CreateNFTForm />
    </main>
  );
}
