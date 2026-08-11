import { NextResponse } from "next/server";

import { getMarketplaceNFTs } from "@/lib/nfts";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await getMarketplaceNFTs());
  } catch (error) {
    console.error("Failed to load marketplace NFTs", error);
    return NextResponse.json(
      { error: "Unable to load NFTs from Sepolia right now" },
      { status: 502 },
    );
  }
}
