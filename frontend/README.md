# NFT Marketplace Frontend

The Next.js frontend for the ERC-721 NFT Marketplace. It connects MetaMask to
the verified Sepolia contracts, uploads assets and metadata to Pinata IPFS, and
supports the complete mint, list, buy, cancel, resell, and withdraw lifecycle.

See the [project README](../README.md) for architecture, setup, contract
addresses, testing, deployment, security, and demonstration instructions.

## Local development

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env.local` and configure `PINATA_JWT` and
`PINATA_GATEWAY` before minting.

## Validation

```bash
npm run lint
npm run build
```
