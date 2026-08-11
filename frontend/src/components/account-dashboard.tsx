"use client";

import { useState } from "react";
import { formatEther, zeroAddress } from "viem";
import {
  useConnection,
  usePublicClient,
  useReadContract,
  useWriteContract,
} from "wagmi";
import { sepolia } from "wagmi/chains";

import {
  MARKETPLACE_ADDRESS,
  SEPOLIA_EXPLORER_URL,
} from "@/config/contracts";
import { marketplaceAbi } from "@/contracts/marketplace-abi";

function getErrorMessage(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "shortMessage" in error &&
    typeof error.shortMessage === "string"
  ) {
    return error.shortMessage;
  }

  return error instanceof Error
    ? error.message
    : "The withdrawal transaction failed";
}

function shortenAddress(address: `0x${string}`) {
  return `${address.slice(0, 8)}…${address.slice(-6)}`;
}

export function AccountDashboard() {
  const { address, chainId, isConnected } = useConnection();
  const publicClient = usePublicClient({ chainId: sepolia.id });
  const { mutateAsync: writeContractAsync } = useWriteContract();
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [transactionHash, setTransactionHash] = useState<
    `0x${string}` | null
  >(null);
  const [transactionError, setTransactionError] = useState<string | null>(null);

  const {
    data: pendingProceeds,
    error: proceedsError,
    isPending: isLoadingProceeds,
    refetch: refetchProceeds,
  } = useReadContract({
    abi: marketplaceAbi,
    address: MARKETPLACE_ADDRESS,
    functionName: "pendingProceeds",
    args: [address ?? zeroAddress],
    query: {
      enabled: isConnected && Boolean(address),
      refetchInterval: 15_000,
    },
  });

  const { data: feeRecipient } = useReadContract({
    abi: marketplaceAbi,
    address: MARKETPLACE_ADDRESS,
    functionName: "feeRecipient",
  });

  const availableProceeds = pendingProceeds ?? BigInt(0);
  const hasProceeds = availableProceeds > BigInt(0);
  const isFeeRecipient =
    address?.toLowerCase() === feeRecipient?.toLowerCase();

  async function handleWithdraw() {
    setTransactionError(null);
    setTransactionHash(null);

    if (!isConnected || !address) {
      setTransactionError("Connect the wallet that earned the proceeds.");
      return;
    }

    if (chainId !== sepolia.id) {
      setTransactionError("Switch to Sepolia before withdrawing proceeds.");
      return;
    }

    if (!hasProceeds) {
      setTransactionError("This wallet has no proceeds available to withdraw.");
      return;
    }

    if (!publicClient) {
      setTransactionError("The Sepolia connection is unavailable. Try again.");
      return;
    }

    try {
      setIsWithdrawing(true);
      const hash = await writeContractAsync({
        abi: marketplaceAbi,
        address: MARKETPLACE_ADDRESS,
        functionName: "withdrawProceeds",
      });
      setTransactionHash(hash);

      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      if (receipt.status !== "success") {
        throw new Error("The withdrawal transaction failed on Sepolia");
      }

      await refetchProceeds();
    } catch (error) {
      setTransactionHash(null);
      setTransactionError(getErrorMessage(error));
    } finally {
      setIsWithdrawing(false);
    }
  }

  if (!isConnected || !address) {
    return (
      <section className="account-connect-card">
        <span aria-hidden="true">01</span>
        <div>
          <h2>Connect your wallet</h2>
          <p>
            Use the wallet button above. The dashboard will read the proceeds
            assigned to that address directly from the marketplace contract.
          </p>
        </div>
      </section>
    );
  }

  return (
    <div className="account-dashboard-grid">
      <section className="proceeds-card" aria-labelledby="proceeds-heading">
        <div className="proceeds-card-topline">
          <span>Connected wallet</span>
          <strong>{shortenAddress(address)}</strong>
        </div>

        <div className="proceeds-balance">
          <p id="proceeds-heading">Available to withdraw</p>
          <strong>
            {isLoadingProceeds ? "Loading…" : formatEther(availableProceeds)}
            {!isLoadingProceeds && <span> ETH</span>}
          </strong>
          <small>
            {isFeeRecipient
              ? "This wallet also receives the marketplace's 2.5% fees."
              : "These are completed-sale earnings assigned to this wallet."}
          </small>
        </div>

        {proceedsError && (
          <p className="form-alert error" role="alert">
            The proceeds balance could not be loaded. Please try again.
          </p>
        )}

        {transactionError && (
          <p className="form-alert error" role="alert">
            {transactionError}
          </p>
        )}

        {transactionHash && !isWithdrawing && !transactionError && (
          <p className="withdrawal-success" role="status">
            Withdrawal confirmed.{" "}
            <a
              href={`${SEPOLIA_EXPLORER_URL}/tx/${transactionHash}`}
              rel="noreferrer"
              target="_blank"
            >
              View transaction
            </a>
          </p>
        )}

        <button
          disabled={
            isWithdrawing ||
            isLoadingProceeds ||
            !hasProceeds ||
            chainId !== sepolia.id
          }
          onClick={handleWithdraw}
          type="button"
        >
          {isWithdrawing
            ? "Confirming withdrawal on Sepolia…"
            : chainId !== sepolia.id
              ? "Switch to Sepolia to withdraw"
              : hasProceeds
                ? "Withdraw proceeds"
                : "No proceeds to withdraw"}
        </button>
      </section>

      <aside className="proceeds-explainer" aria-label="How proceeds work">
        <p className="eyebrow">Pull-payment safety</p>
        <h2>Why the ETH waits here</h2>
        <ol>
          <li>
            <span>1</span>
            <div>
              <strong>A buyer pays the contract</strong>
              <p>The NFT transfers only after the exact price is received.</p>
            </div>
          </li>
          <li>
            <span>2</span>
            <div>
              <strong>The sale is divided</strong>
              <p>97.5% becomes seller proceeds and 2.5% becomes the fee.</p>
            </div>
          </li>
          <li>
            <span>3</span>
            <div>
              <strong>Each recipient withdraws</strong>
              <p>A separate transaction securely claims the stored ETH.</p>
            </div>
          </li>
        </ol>
        <a
          href={`${SEPOLIA_EXPLORER_URL}/address/${MARKETPLACE_ADDRESS}#code`}
          rel="noreferrer"
          target="_blank"
        >
          Inspect the verified marketplace contract
        </a>
      </aside>
    </div>
  );
}
