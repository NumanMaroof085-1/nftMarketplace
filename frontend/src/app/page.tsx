import { SiteHeader } from "@/components/site-header";
import { NFTGallery } from "@/components/nft-gallery";
import {
  MARKETPLACE_ADDRESS,
  NFT_ADDRESS,
  SEPOLIA_EXPLORER_URL,
} from "@/config/contracts";

const marketplaceSteps = [
  {
    number: "01",
    title: "Mint",
    description: "Create an ERC-721 token that records your ownership on-chain.",
  },
  {
    number: "02",
    title: "List",
    description: "Approve the marketplace and choose your selling price in ETH.",
  },
  {
    number: "03",
    title: "Trade",
    description: "Buy listed NFTs securely through the Sepolia smart contract.",
  },
];

export default function Home() {
  return (
    <main className="site-shell">
      <SiteHeader active="discover" />

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow">Ethereum testnet marketplace</p>
          <h1>Own the art. Trade the proof.</h1>
          <p className="hero-description">
            Mint, list, buy, and resell ERC-721 NFTs through contracts deployed
            and verified on Ethereum Sepolia.
          </p>
          <div className="hero-actions">
            <a className="primary-link" href="/create">
              Create an NFT
            </a>
            <a
              className="secondary-link"
              href={`${SEPOLIA_EXPLORER_URL}/address/${MARKETPLACE_ADDRESS}#code`}
              target="_blank"
              rel="noreferrer"
            >
              View verified contract
            </a>
          </div>
        </div>

        <aside className="contract-card" aria-label="Deployed contract details">
          <p>Live contracts</p>
          <dl>
            <div>
              <dt>NFT</dt>
              <dd>{`${NFT_ADDRESS.slice(0, 10)}…${NFT_ADDRESS.slice(-6)}`}</dd>
            </div>
            <div>
              <dt>Marketplace</dt>
              <dd>
                {`${MARKETPLACE_ADDRESS.slice(0, 10)}…${MARKETPLACE_ADDRESS.slice(-6)}`}
              </dd>
            </div>
            <div>
              <dt>Network</dt>
              <dd>Sepolia · 11155111</dd>
            </div>
          </dl>
        </aside>
      </section>

      <section className="discovery-section" id="discover" aria-labelledby="discover-heading">
        <div className="discovery-heading">
          <div>
            <p className="eyebrow">Live Sepolia collection</p>
            <h2 id="discover-heading">Discover minted NFTs</h2>
          </div>
          <p>Loaded directly from contract events, current ownership, and IPFS metadata.</p>
        </div>
        <NFTGallery />
      </section>

      <section className="steps-section" aria-labelledby="how-it-works">
        <div className="section-heading">
          <p className="eyebrow">Simple on-chain lifecycle</p>
          <h2 id="how-it-works">How the marketplace works</h2>
        </div>
        <div className="steps-grid">
          {marketplaceSteps.map((step) => (
            <article className="step-card" key={step.number}>
              <span>{step.number}</span>
              <h3>{step.title}</h3>
              <p>{step.description}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
