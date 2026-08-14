import "server-only";

import {
  createPublicClient,
  fallback,
  formatEther,
  http,
  type Address,
} from "viem";
import { sepolia } from "viem/chains";

import { MARKETPLACE_ADDRESS, NFT_ADDRESS } from "@/config/contracts";
import { marketplaceAbi } from "@/contracts/marketplace-abi";
import { nftAbi } from "@/contracts/nft-abi";
import type {
  AccountListingRecord,
  MarketplaceAccountData,
  MarketplaceNFT,
  NFTAttribute,
} from "@/types/nft";

const configuredSepoliaRpcUrl = process.env.SEPOLIA_RPC_URL?.trim();
const TOKEN_DISCOVERY_BATCH_SIZE = 50;

const publicClient = createPublicClient({
  chain: sepolia,
  transport: configuredSepoliaRpcUrl
    ? fallback([
        http(configuredSepoliaRpcUrl, { retryCount: 0, timeout: 6_000 }),
        http(undefined, { retryCount: 0, timeout: 6_000 }),
      ])
    : http(undefined, { retryCount: 1, timeout: 8_000 }),
});

async function getMintedTokens() {
  // NFT.sol starts at token 1, increments by one, and exposes no burn function.
  // That makes the first nonexistent ownerOf result a reliable end marker.
  const tokenIds: bigint[] = [];
  let batchStart = BigInt(1);

  while (true) {
    const contracts: Array<{
      abi: typeof nftAbi;
      address: Address;
      functionName: "ownerOf";
      args: readonly [bigint];
    }> = Array.from(
      { length: TOKEN_DISCOVERY_BATCH_SIZE },
      (_, index) => ({
        abi: nftAbi,
        address: NFT_ADDRESS,
        functionName: "ownerOf",
        args: [batchStart + BigInt(index)] as const,
      }),
    );
    const results = await publicClient.multicall({
      allowFailure: true,
      contracts,
    });

    for (const [index, result] of results.entries()) {
      if (result.status === "failure") {
        return tokenIds;
      }

      tokenIds.push(batchStart + BigInt(index));
    }

    batchStart += BigInt(TOKEN_DISCOVERY_BATCH_SIZE);
  }
}

async function getMarketplaceListings() {
  const totalListings = await publicClient.readContract({
    abi: marketplaceAbi,
    address: MARKETPLACE_ADDRESS,
    functionName: "totalListings",
  });
  const listingIds: bigint[] = [];

  for (
    let listingId = BigInt(1);
    listingId <= totalListings;
    listingId += BigInt(1)
  ) {
    listingIds.push(listingId);
  }

  return Promise.all(
    listingIds.map((listingId) =>
      publicClient.readContract({
        abi: marketplaceAbi,
        address: MARKETPLACE_ADDRESS,
        functionName: "getListing",
        args: [listingId],
      }),
    ),
  );
}

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
    cache: "force-cache",
    signal: AbortSignal.timeout(4_000),
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

export async function getMarketplaceNFT(
  tokenId: bigint,
): Promise<MarketplaceNFT> {
  const [owner, metadataUri, activeListingId] = await publicClient.multicall({
    allowFailure: false,
    contracts: [
      {
        abi: nftAbi,
        address: NFT_ADDRESS,
        functionName: "ownerOf",
        args: [tokenId],
      },
      {
        abi: nftAbi,
        address: NFT_ADDRESS,
        functionName: "tokenURI",
        args: [tokenId],
      },
      {
        abi: marketplaceAbi,
        address: MARKETPLACE_ADDRESS,
        functionName: "activeListingIdForToken",
        args: [NFT_ADDRESS, tokenId],
      },
    ],
  });

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
  const tokenIds = await getMintedTokens();

  return Promise.all(tokenIds.reverse().map(getMarketplaceNFT));
}

export async function getMarketplaceAccountData(
  account: Address,
): Promise<MarketplaceAccountData> {
  const [nfts, marketplaceListings] = await Promise.all([
    getMarketplaceNFTs(),
    getMarketplaceListings(),
  ]);

  const accountKey = account.toLowerCase();
  const nftByTokenId = new Map(nfts.map((nft) => [nft.tokenId, nft]));
  const listingRecords = marketplaceListings.flatMap((listing) => {
    if (listing.nftContract.toLowerCase() !== NFT_ADDRESS.toLowerCase()) {
      return [];
    }

    const nft = nftByTokenId.get(listing.tokenId.toString());

    if (!nft) return [];

    const status: AccountListingRecord["status"] =
      listing.status === 2
        ? "sold"
        : listing.status === 3
          ? "cancelled"
          : "active";

    return [
      {
        listingId: listing.listingId.toString(),
        tokenId: listing.tokenId.toString(),
        priceEth: formatEther(listing.price),
        status,
        seller: listing.seller,
        buyer: status === "sold" ? listing.buyer : null,
        transactionHash: null,
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
