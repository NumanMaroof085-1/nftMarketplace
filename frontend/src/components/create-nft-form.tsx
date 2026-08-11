"use client";

import Image from "next/image";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type FormEvent,
} from "react";
import { parseEventLogs } from "viem";
import {
  useConnection,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { sepolia } from "wagmi/chains";

import { NFT_ADDRESS, SEPOLIA_EXPLORER_URL } from "@/config/contracts";
import { nftAbi } from "@/contracts/nft-abi";

type Attribute = {
  trait_type: string;
  value: string;
};

type UploadResult = {
  imageCid: string;
  imageUri: string;
  imageUrl: string;
  metadataCid: string;
  metadataUri: string;
};

const MAX_FILE_SIZE = 4 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set([
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function getErrorMessage(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "shortMessage" in error &&
    typeof error.shortMessage === "string"
  ) {
    return error.shortMessage;
  }

  return error instanceof Error ? error.message : "Something went wrong";
}

export function CreateNFTForm() {
  const { address, chainId, isConnected } = useConnection();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [attributes, setAttributes] = useState<Attribute[]>([
    { trait_type: "", value: "" },
  ]);
  const [isUploading, setIsUploading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);

  const {
    data: transactionHash,
    error: writeError,
    isPending: isWaitingForWallet,
    mutateAsync: writeContractAsync,
    reset: resetWrite,
  } = useWriteContract();

  const {
    data: receipt,
    error: receiptError,
    isPending: isReceiptPending,
    isSuccess: isConfirmed,
  } = useWaitForTransactionReceipt({
    chainId: sepolia.id,
    hash: transactionHash,
  });

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const mintedTokenId = useMemo(() => {
    if (!receipt) return undefined;

    const [mintEvent] = parseEventLogs({
      abi: nftAbi,
      eventName: "NFTMinted",
      logs: receipt.logs,
    });

    return mintEvent?.args.tokenId;
  }, [receipt]);

  const isCorrectNetwork = chainId === sepolia.id;
  const isConfirming = Boolean(transactionHash) && isReceiptPending;
  const isBusy = isUploading || isWaitingForWallet || isConfirming;
  const visibleError =
    formError ??
    (writeError ? getErrorMessage(writeError) : null) ??
    (receiptError ? getErrorMessage(receiptError) : null);

  function chooseFile(selectedFile: File | null) {
    setFormError(null);
    setUploadResult(null);
    resetWrite();

    if (previewUrl) URL.revokeObjectURL(previewUrl);

    if (
      selectedFile &&
      (!ALLOWED_IMAGE_TYPES.has(selectedFile.type) ||
        selectedFile.size > MAX_FILE_SIZE)
    ) {
      setFile(null);
      setPreviewUrl(null);
      setFormError("Use a JPG, PNG, GIF, or WebP image no larger than 4 MB.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setFile(selectedFile);
    setPreviewUrl(selectedFile ? URL.createObjectURL(selectedFile) : null);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);

    if (!isBusy) {
      chooseFile(event.dataTransfer.files.item(0));
    }
  }

  function updateAttribute(
    index: number,
    field: keyof Attribute,
    value: string,
  ) {
    setAttributes((current) =>
      current.map((attribute, attributeIndex) =>
        attributeIndex === index ? { ...attribute, [field]: value } : attribute,
      ),
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setUploadResult(null);
    resetWrite();

    if (!isConnected || !address) {
      setFormError("Connect your wallet before creating an NFT.");
      return;
    }

    if (!isCorrectNetwork) {
      setFormError("Switch your wallet to Sepolia before minting.");
      return;
    }

    if (!file) {
      setFormError("Choose an image for your NFT.");
      return;
    }

    const completeAttributes = attributes.filter(
      (attribute) => attribute.trait_type.trim() || attribute.value.trim(),
    );

    if (
      completeAttributes.some(
        (attribute) =>
          !attribute.trait_type.trim() || !attribute.value.trim(),
      )
    ) {
      setFormError("Complete both fields for every trait, or remove the row.");
      return;
    }

    const form = event.currentTarget;
    const values = new FormData(form);
    values.set("file", file);
    values.set("creator", address);
    values.set("attributes", JSON.stringify(completeAttributes));

    try {
      setIsUploading(true);
      const response = await fetch("/api/ipfs", {
        method: "POST",
        body: values,
      });
      const result = (await response.json()) as UploadResult | { error: string };

      if (!response.ok || "error" in result) {
        throw new Error(
          "error" in result ? result.error : "The IPFS upload failed.",
        );
      }

      setUploadResult(result);
      setIsUploading(false);

      await writeContractAsync({
        abi: nftAbi,
        address: NFT_ADDRESS,
        functionName: "mintNFT",
        args: [result.metadataUri],
      });
    } catch (error) {
      setIsUploading(false);
      setFormError(getErrorMessage(error));
    }
  }

  return (
    <form className="create-form" onSubmit={handleSubmit}>
      <div className="create-grid">
        <section className="upload-panel" aria-labelledby="asset-heading">
          <div className="form-section-heading">
            <span>01</span>
            <div>
              <h2 id="asset-heading">Choose your artwork</h2>
              <p>JPG, PNG, GIF, or WebP. Maximum size 4 MB.</p>
            </div>
          </div>

          <div
            aria-disabled={isBusy}
            aria-label="Select or drop an NFT image"
            className={`upload-dropzone ${previewUrl ? "has-preview" : ""} ${isDragging ? "is-dragging" : ""}`}
            onClick={() => !isBusy && fileInputRef.current?.click()}
            onDragEnter={(event) => {
              event.preventDefault();
              if (!isBusy) setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDragOver={(event) => {
              event.preventDefault();
              if (!isBusy) setIsDragging(true);
            }}
            onDrop={handleDrop}
            onKeyDown={(event) => {
              if (!isBusy && (event.key === "Enter" || event.key === " ")) {
                event.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            role="button"
            tabIndex={isBusy ? -1 : 0}
          >
            <input
              accept="image/gif,image/jpeg,image/png,image/webp"
              disabled={isBusy}
              name="file"
              onChange={(event) => chooseFile(event.target.files?.[0] ?? null)}
              onClick={(event) => event.stopPropagation()}
              ref={fileInputRef}
              type="file"
            />
            {previewUrl ? (
              <Image
                alt="Selected NFT preview"
                className="nft-preview-image"
                fill
                sizes="(max-width: 820px) 100vw, 45vw"
                src={previewUrl}
                unoptimized
              />
            ) : (
              <span className="upload-prompt">
                <strong>Select an image</strong>
                <small>Click to browse or drag and drop here</small>
              </span>
            )}
          </div>
          {file && (
            <div className="selected-file">
              <span>{file.name}</span>
              <span>{(file.size / 1024 / 1024).toFixed(2)} MB</span>
            </div>
          )}
        </section>

        <section className="metadata-panel" aria-labelledby="metadata-heading">
          <div className="form-section-heading">
            <span>02</span>
            <div>
              <h2 id="metadata-heading">Describe the NFT</h2>
              <p>This information becomes permanent IPFS metadata.</p>
            </div>
          </div>

          <label className="field-label">
            Name
            <input
              disabled={isBusy}
              maxLength={100}
              minLength={2}
              name="name"
              placeholder="e.g. Neon Garden #1"
              required
              type="text"
            />
          </label>

          <label className="field-label">
            Description
            <textarea
              disabled={isBusy}
              maxLength={1000}
              minLength={10}
              name="description"
              placeholder="Explain the story, idea, or meaning behind this NFT."
              required
              rows={5}
            />
          </label>

          <div className="traits-heading">
            <div>
              <span>Traits</span>
              <small>Optional attributes displayed by NFT marketplaces.</small>
            </div>
            <button
              disabled={isBusy || attributes.length >= 20}
              onClick={() =>
                setAttributes((current) => [
                  ...current,
                  { trait_type: "", value: "" },
                ])
              }
              type="button"
            >
              Add trait
            </button>
          </div>

          <div className="traits-list">
            {attributes.map((attribute, index) => (
              <div className="trait-row" key={index}>
                <input
                  aria-label={`Trait ${index + 1} name`}
                  disabled={isBusy}
                  maxLength={50}
                  onChange={(event) =>
                    updateAttribute(index, "trait_type", event.target.value)
                  }
                  placeholder="Trait name"
                  value={attribute.trait_type}
                />
                <input
                  aria-label={`Trait ${index + 1} value`}
                  disabled={isBusy}
                  maxLength={100}
                  onChange={(event) =>
                    updateAttribute(index, "value", event.target.value)
                  }
                  placeholder="Value"
                  value={attribute.value}
                />
                <button
                  aria-label={`Remove trait ${index + 1}`}
                  disabled={isBusy || attributes.length === 1}
                  onClick={() =>
                    setAttributes((current) =>
                      current.filter((_, attributeIndex) => attributeIndex !== index),
                    )
                  }
                  type="button"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="mint-panel" aria-labelledby="mint-heading">
        <div>
          <p className="eyebrow">Final step</p>
          <h2 id="mint-heading">Upload and mint on Sepolia</h2>
          <p>
            Your image and metadata are pinned to IPFS before MetaMask requests
            the NFT mint transaction.
          </p>
        </div>

        <ol className="mint-progress" aria-label="Minting progress">
          <li className={uploadResult ? "done" : isUploading ? "active" : ""}>
            <span>1</span> Upload to IPFS
          </li>
          <li
            className={
              transactionHash ? "done" : isWaitingForWallet ? "active" : ""
            }
          >
            <span>2</span> Confirm in MetaMask
          </li>
          <li className={isConfirmed ? "done" : isConfirming ? "active" : ""}>
            <span>3</span> Confirm on Sepolia
          </li>
        </ol>

        {visibleError && (
          <p className="form-alert error" role="alert">
            {visibleError}
          </p>
        )}

        {isConfirmed && transactionHash && uploadResult ? (
          <div className="mint-success" role="status">
            <strong>
              NFT {mintedTokenId !== undefined ? `#${mintedTokenId}` : ""} minted
              successfully.
            </strong>
            <div>
              <a
                href={`${SEPOLIA_EXPLORER_URL}/tx/${transactionHash}`}
                rel="noreferrer"
                target="_blank"
              >
                View transaction
              </a>
              <a href={uploadResult.imageUrl} rel="noreferrer" target="_blank">
                View IPFS asset
              </a>
            </div>
          </div>
        ) : (
          <button
            className="mint-submit"
            disabled={isBusy || !isConnected || !isCorrectNetwork}
            type="submit"
          >
            {isUploading
              ? "Uploading to IPFS…"
              : isWaitingForWallet
                ? "Confirm in MetaMask…"
                : isConfirming
                  ? "Confirming on Sepolia…"
                  : !isConnected
                    ? "Connect wallet to continue"
                    : !isCorrectNetwork
                      ? "Switch to Sepolia to continue"
                      : "Create NFT"}
          </button>
        )}
      </section>
    </form>
  );
}
