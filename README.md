# NFT Marketplace

An ERC-721 NFT marketplace built for the DaFi Labs Blockchain and Web3
internship assignment.

## Sepolia deployment

| Contract | Address | Verification |
| --- | --- | --- |
| NFT | `0xeF6921a2743Be0953E1855B1F81D330cE97E1Db5` | [Etherscan](https://sepolia.etherscan.io/address/0xeF6921a2743Be0953E1855B1F81D330cE97E1Db5#code) |
| NFTMarketplace | `0x27b33F1A4f79346305Fe20779F339D79996569ec` | [Etherscan](https://sepolia.etherscan.io/address/0x27b33F1A4f79346305Fe20779F339D79996569ec#code) |

Network: Sepolia (`chainId: 11155111`)

The machine-readable addresses are stored in
[`deployments/sepolia.json`](deployments/sepolia.json). Hardhat Ignition's
deployment history is stored in `ignition/deployments/chain-11155111/` so the
deployment can be inspected or resumed.

## Development commands

```bash
npm run build
npm test
npm run typecheck
npm run check:sepolia
```
