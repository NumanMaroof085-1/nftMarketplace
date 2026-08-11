"use client";

import {
  useConnect,
  useConnection,
  useConnectors,
  useDisconnect,
  useSwitchChain,
} from "wagmi";
import { sepolia } from "wagmi/chains";

function shortenAddress(address: `0x${string}`) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function WalletButton() {
  const { address, chainId, isConnected, status } = useConnection();
  const connectors = useConnectors();
  const { connect, error: connectError, isPending: isConnecting } =
    useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: isSwitching } = useSwitchChain();

  if (status === "reconnecting") {
    return (
      <button className="wallet-button" disabled>
        Reconnecting…
      </button>
    );
  }

  if (isConnected && chainId !== sepolia.id) {
    return (
      <button
        className="wallet-button wallet-button-warning"
        disabled={isSwitching}
        onClick={() => switchChain({ chainId: sepolia.id })}
      >
        {isSwitching ? "Switching…" : "Switch to Sepolia"}
      </button>
    );
  }

  if (isConnected && address) {
    return (
      <div className="wallet-connected">
        <span aria-label={`Connected wallet ${address}`}>
          {shortenAddress(address)}
        </span>
        <button onClick={() => disconnect()}>Disconnect</button>
      </div>
    );
  }

  const connector = connectors[0];

  return (
    <div className="wallet-action">
      <button
        className="wallet-button"
        disabled={!connector || isConnecting}
        onClick={() => connector && connect({ connector })}
      >
        {isConnecting ? "Connecting…" : "Connect wallet"}
      </button>
      {connectError && (
        <p className="wallet-error" role="alert">
          {connectError.message}
        </p>
      )}
    </div>
  );
}
