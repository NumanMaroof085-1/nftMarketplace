import { NextResponse } from "next/server";

import { getMarketplaceNFT } from "@/lib/nfts";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tokenId: string }> },
) {
  const { tokenId } = await params;

  if (!/^[1-9]\d*$/.test(tokenId)) {
    return NextResponse.json({ error: "Invalid token ID" }, { status: 400 });
  }

  try {
    return NextResponse.json(await getMarketplaceNFT(BigInt(tokenId)));
  } catch (error) {
    console.error(`Failed to load NFT #${tokenId}`, error);
    return NextResponse.json(
      { error: "This NFT could not be loaded from Sepolia" },
      { status: 404 },
    );
  }
}
