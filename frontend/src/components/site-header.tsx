import Link from "next/link";

import { WalletButton } from "./wallet-button";

type SiteHeaderProps = {
  active?: "discover" | "create";
};

export function SiteHeader({ active }: SiteHeaderProps) {
  return (
    <header className="site-header">
      <Link className="brand" href="/" aria-label="NFT Marketplace home">
        <span className="brand-mark">N</span>
        <span>NFT Marketplace</span>
      </Link>
      <nav className="site-nav" aria-label="Primary navigation">
        <Link
          className={active === "discover" ? "active" : ""}
          href="/#discover"
        >
          Discover
        </Link>
        <Link className={active === "create" ? "active" : ""} href="/create">
          Create
        </Link>
      </nav>
      <div className="header-actions">
        <span className="network-badge">
          <span aria-hidden="true" /> Sepolia
        </span>
        <WalletButton />
      </div>
    </header>
  );
}
