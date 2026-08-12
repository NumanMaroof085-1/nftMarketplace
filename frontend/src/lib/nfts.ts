import "server-only";

import {
  createPublicClient,
  fallback,
  formatEther,
  http,
  type Address,
} from "viem";
import { sepolia } from "viem/chains";

import {
  MARKETPLACE_ADDRESS,
  NFT_ADDRESS,
  NFT_DEPLOYMENT_BLOCK,
} from "@/config/contracts";
import { marketplaceAbi } from "@/contracts/marketplace-abi";
import { nftAbi } from "@/contracts/nft-abi";
import type {
  AccountListingRecord,
  MarketplaceAccountData,
  MarketplaceNFT,
  NFTAttribute,
} from "@/types/nft";

const configuredSepoliaRpcUrl = process.env.SEPOLIA_RPC_URL?.trim();

const publicClient = createPublicClient({
  chain: sepolia,
  transport: configuredSepoliaRpcUrl
    ? fallback([
        http(configuredSepoliaRpcUrl, { retryCount: 2, timeout: 15_000 }),
        http(undefined, { retryCount: 2, timeout: 15_000 }),
      ])
    : http(undefined, { retryCount: 2, timeout: 15_000 }),
});

function ipfsToHttp(uri: string) {
  if (!uri.startsWith("ipfs://")) {
    throw new Error("NFT metadata must use an ipfs:// URI");
  }

  const path = uri.slice("ipfs://".length).replace(/^ipfs\//, "");

  if (!path || path.includes("..")) {
    throw new Error("NFT contains an invalid IPFS URI");
  }

  const gateway = process.env.PINATA_GATEWAY?.replace(/^https?:\/\//, "").replace(
    /\/$/,
    "",
  );

  return gateway
    ? `https://${gateway}/ipfs/${path}`
    : `https://ipfs.io/ipfs/${path}`;
}

function parseAttributes(value: unknown): NFTAttribute[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((attribute) => {
    if (
      typeof attribute !== "object" ||
      attribute === null ||
      !("trait_type" in attribute) ||
      !("value" in attribute)
    ) {
      return [];
    }

    const traitType = String(attribute.trait_type).trim();
    const traitValue = attribute.value;

    if (
      !traitType ||
      (typeof traitValue !== "string" && typeof traitValue !== "number")
    ) {
      return [];
    }

    return [{ trait_type: traitType, value: traitValue }];
  });
}

async function loadMetadata(metadataUri: string) {
  const response = await fetch(ipfsToHttp(metadataUri), {
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });

  if (!response.ok) {
    throw new Error("Unable to load NFT metadata from IPFS");
  }

  const metadata: unknown = await response.json();

  if (typeof metadata !== "object" || metadata === null) {
    throw new Error("NFT metadata is invalid");
  }

  const record = metadata as Record<string, unknown>;
  const imageUri = typeof record.image === "string" ? record.image : "";

  return {
    metadataAvailable: true,
    name: typeof record.name === "string" ? record.name : "Untitled NFT",
    description:
      typeof record.description === "string" ? record.description : "",
    imageUri,
    imageUrl: imageUri ? ipfsToHttp(imageUri) : "",
    creator: typeof record.creator === "string" ? record.creator : "Unknown",
    attributes: parseAttributes(record.attributes),
  };
}

export async function getMarketplaceNFT(tokenId: bigint): Promise<MarketplaceNFT> {
  const [owner, metadataUri, activeListingId] = await Promise.all([
    publicClient.readContract({
      abi: nftAbi,
      address: NFT_ADDRESS,
      functionName: "ownerOf",
      args: [tokenId],
    }),
    publicClient.readContract({
      abi: nftAbi,
      address: NFT_ADDRESS,
      functionName: "tokenURI",
      args: [tokenId],
    }),
    publicClient.readContract({
      abi: marketplaceAbi,
      address: MARKETPLACE_ADDRESS,
      functionName: "activeListingIdForToken",
      args: [NFT_ADDRESS, tokenId],
    }),
  ]);

  const [metadata, listing] = await Promise.all([
    loadMetadata(metadataUri).catch(() => ({
      metadataAvailable: false,
      name: `NFT #${tokenId.toString()}`,
      description:
        "This token still exists on Sepolia, but its IPFS metadata is unavailable.",
      imageUri: "",
      imageUrl: "",
      creator: "Unavailable",
      attributes: [] as NFTAttribute[],
    })),
    activeListingId > BigInt(0)
      ? publicClient.readContract({
          abi: marketplaceAbi,
          address: MARKETPLACE_ADDRESS,
          functionName: "getListing",
          args: [activeListingId],
        })
      : null,
  ]);

  return {
    tokenId: tokenId.toString(),
    owner,
    metadataUri,
    ...metadata,
    listing: listing
      ? {
          listingId: listing.listingId.toString(),
          seller: listing.seller,
          buyer: listing.buyer,
          priceWei: listing.price.toString(),
          priceEth: formatEther(listing.price),
          status: "active",
        }
      : null,
  };
}

export async function getMarketplaceNFTs() {
  const mintLogs = await publicClient.getContractEvents({
    abi: nftAbi,
    address: NFT_ADDRESS,
    eventName: "NFTMinted",
    fromBlock: NFT_DEPLOYMENT_BLOCK,
    toBlock: "latest",
  });

  const tokenIds = [
    ...new Set(
      mintLogs.flatMap((log) =>
        log.args.tokenId === undefined ? [] : [log.args.tokenId.toString()],
      ),
    ),
  ]
    .map(BigInt)
    .sort((left, right) => (left > right ? -1 : left < right ? 1 : 0));

  return Promise.all(tokenIds.map(getMarketplaceNFT));
}

export async function getMarketplaceAccountData(
  account: Address,
): Promise<MarketplaceAccountData> {
  const [nfts, marketplaceLogs] = await Promise.all([
    getMarketplaceNFTs(),
    publicClient.getContractEvents({
      abi: marketplaceAbi,
      address: MARKETPLACE_ADDRESS,
      fromBlock: NFT_DEPLOYMENT_BLOCK,
      toBlock: "latest",
    }),
  ]);

  const accountKey = account.toLowerCase();
  const nftByTokenId = new Map(nfts.map((nft) => [nft.tokenId, nft]));
  const listingLogs = marketplaceLogs.filter(
    (log) => log.eventName === "NFTListed",
  );
  const soldLogs = marketplaceLogs.filter(
    (log) => log.eventName === "NFTSold",
  );
  const cancelledLogs = marketplaceLogs.filter(
    (log) => log.eventName === "ListingCancelled",
  );

  const listingRecords = listingLogs.flatMap((listingLog) => {
    const { listingId, nftContract, price, seller, tokenId } = listingLog.args;

    if (
      listingId === undefined ||
      nftContract?.toLowerCase() !== NFT_ADDRESS.toLowerCase() ||
      price === undefined ||
      seller === undefined ||
      tokenId === undefined
    ) {
      return [];
    }

    const listingKey = listingId.toString();
    const nft = nftByTokenId.get(tokenId.toString());

    if (!nft) return [];

    const soldLog = soldLogs.find(
      (log) => log.args.listingId?.toString() === listingKey,
    );
    const cancelledLog = cancelledLogs.find(
      (log) => log.args.listingId?.toString() === listingKey,
    );
    const status: AccountListingRecord["status"] = soldLog
      ? "sold"
      : cancelledLog
        ? "cancelled"
        : "active";

    return [
      {
        listingId: listingKey,
        tokenId: tokenId.toString(),
        priceEth: formatEther(price),
        status,
        seller,
        buyer: soldLog?.args.buyer ?? null,
        transactionHash:
          soldLog?.transactionHash ??
          cancelledLog?.transactionHash ??
          listingLog.transactionHash ??
          null,
        nft,
      } satisfies AccountListingRecord,
    ];
  });

  listingRecords.sort((left, right) =>
    BigInt(left.listingId) > BigInt(right.listingId) ? -1 : 1,
  );

  return {
    myNfts: nfts.filter((nft) => nft.owner.toLowerCase() === accountKey),
    myListings: listingRecords.filter(
      (record) => record.seller.toLowerCase() === accountKey,
    ),
    purchased: listingRecords.filter(
      (record) => record.buyer?.toLowerCase() === accountKey,
    ),
    sold: listingRecords.filter(
      (record) =>
        record.status === "sold" && record.seller.toLowerCase() === accountKey,
    ),
  };
}
