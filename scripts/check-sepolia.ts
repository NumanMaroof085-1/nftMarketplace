import { network } from "hardhat";
import { formatEther } from "viem";

const SEPOLIA_CHAIN_ID = 11_155_111;

const { viem } = await network.create({
  network: "sepolia",
  chainType: "l1",
});

const publicClient = await viem.getPublicClient();
const [deployer] = await viem.getWalletClients();
const chainId = await publicClient.getChainId();
const balance = await publicClient.getBalance({
  address: deployer.account.address,
});

if (chainId !== SEPOLIA_CHAIN_ID) {
  throw new Error(
    `Expected Sepolia chain ID ${SEPOLIA_CHAIN_ID}, received ${chainId}`,
  );
}

if (balance === 0n) {
  throw new Error("Deployment wallet has no Sepolia ETH");
}

console.log("Sepolia connection ready");
console.log("Chain ID:", chainId);
console.log("Deployer:", deployer.account.address);
console.log("Balance:", `${formatEther(balance)} ETH`);
