import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("NFTMarketplaceModule", (m) => {
  const feeRecipient = m.getAccount(0);

  const nft = m.contract("NFT");
  const marketplace = m.contract("NFTMarketplace", [feeRecipient]);

  return { nft, marketplace };
});
