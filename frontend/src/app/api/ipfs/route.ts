import { NextResponse, type NextRequest } from "next/server";
import { isAddress } from "viem";

import { getPinata } from "@/lib/pinata";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set([
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

type NFTAttribute = {
  trait_type: string;
  value: string | number;
};

function parseAttributes(value: FormDataEntryValue | null): NFTAttribute[] {
  if (typeof value !== "string" || value.trim() === "") {
    return [];
  }

  const attributes: unknown = JSON.parse(value);

  if (!Array.isArray(attributes) || attributes.length > 20) {
    throw new Error("Attributes must be an array containing at most 20 traits");
  }

  return attributes.map((attribute) => {
    if (
      typeof attribute !== "object" ||
      attribute === null ||
      !("trait_type" in attribute) ||
      !("value" in attribute)
    ) {
      throw new Error("Each attribute requires a trait type and value");
    }

    const traitType = String(attribute.trait_type).trim();
    const traitValue = attribute.value;

    if (
      traitType.length === 0 ||
      traitType.length > 50 ||
      !["string", "number"].includes(typeof traitValue)
    ) {
      throw new Error("An NFT attribute is invalid");
    }

    return {
      trait_type: traitType,
      value: traitValue as string | number,
    };
  });
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const name = String(formData.get("name") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();
    const creator = String(formData.get("creator") ?? "").trim();

    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json(
        { error: "Choose an NFT image to upload" },
        { status: 400 },
      );
    }

    if (!ALLOWED_IMAGE_TYPES.has(file.type) || file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "Use a JPG, PNG, GIF, or WebP image no larger than 10 MB" },
        { status: 400 },
      );
    }

    if (name.length < 2 || name.length > 100) {
      return NextResponse.json(
        { error: "NFT name must contain between 2 and 100 characters" },
        { status: 400 },
      );
    }

    if (description.length < 10 || description.length > 1_000) {
      return NextResponse.json(
        { error: "Description must contain between 10 and 1,000 characters" },
        { status: 400 },
      );
    }

    if (!isAddress(creator)) {
      return NextResponse.json(
        { error: "Connect a valid creator wallet before uploading" },
        { status: 400 },
      );
    }

    const attributes = parseAttributes(formData.get("attributes"));
    const pinata = getPinata();
    const imageUpload = await pinata.upload.public.file(file);
    const imageUri = `ipfs://${imageUpload.cid}`;

    const metadata = {
      name,
      description,
      image: imageUri,
      attributes,
      creator,
    };

    const metadataUpload = await pinata.upload.public
      .json(metadata)
      .name(`${name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-metadata.json`);

    return NextResponse.json({
      imageCid: imageUpload.cid,
      imageUri,
      imageUrl: await pinata.gateways.public.convert(imageUpload.cid),
      metadataCid: metadataUpload.cid,
      metadataUri: `ipfs://${metadataUpload.cid}`,
    });
  } catch (error) {
    const message =
      error instanceof SyntaxError
        ? "Attributes must contain valid JSON"
        : error instanceof Error && error.message.startsWith("Attributes")
          ? error.message
          : "The IPFS upload failed. Check the Pinata configuration and try again.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
