export type NFTAttribute = {
  trait_type: string;
  value: string | number;
};

export type NFTListing = {
  listingId: string;
  seller: `0x${string}`;
  buyer: `0x${string}`;
  priceWei: string;
  priceEth: string;
  status: "active";
};

export type MarketplaceNFT = {
  tokenId: string;
  owner: `0x${string}`;
  metadataUri: string;
  metadataAvailable: boolean;
  name: string;
  description: string;
  imageUri: string;
  imageUrl: string;
  creator: string;
  attributes: NFTAttribute[];
  listing: NFTListing | null;
};
