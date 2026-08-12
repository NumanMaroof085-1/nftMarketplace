import { NextResponse } from "next/server";

import { getMarketplaceNFTs } from "@/lib/nfts";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET() {
  try {
    return NextResponse.json(await getMarketplaceNFTs(), {
      headers: {
        "Cache-Control": "public, max-age=0, s-maxage=15, stale-while-revalidate=300",
      },
    });
  } catch (error) {
    console.error("Failed to load marketplace NFTs", error);
    return NextResponse.json(
      { error: "Unable to load NFTs from Sepolia right now" },
      { status: 502 },
    );
  }
}
