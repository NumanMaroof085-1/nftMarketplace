import type { Metadata } from "next";

import { AccountDashboard } from "@/components/account-dashboard";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "Account | NFT Marketplace",
  description: "View and withdraw NFT marketplace proceeds on Sepolia.",
};

export default function AccountPage() {
  return (
    <main className="site-shell">
      <SiteHeader active="account" />
      <section className="account-page-heading">
        <p className="eyebrow">Your marketplace account</p>
        <h1>Claim what you earned.</h1>
        <p>
          Completed-sale proceeds remain secured in the marketplace contract
          until the earning wallet withdraws them.
        </p>
      </section>
      <AccountDashboard />
    </main>
  );
}
