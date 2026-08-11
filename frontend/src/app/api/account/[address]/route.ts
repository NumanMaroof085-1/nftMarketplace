import { getAddress, isAddress } from "viem";

import { getMarketplaceAccountData } from "@/lib/nfts";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ address: string }> },
) {
  const { address } = await params;

  if (!isAddress(address)) {
    return Response.json({ error: "Invalid wallet address" }, { status: 400 });
  }

  try {
    return Response.json(await getMarketplaceAccountData(getAddress(address)));
  } catch (error) {
    console.error("Unable to load marketplace account activity", error);
    return Response.json(
      { error: "Unable to load account activity from Sepolia" },
      { status: 502 },
    );
  }
}
