import { PinataSDK } from "pinata";

export function getPinata() {
  const pinataJwt = process.env.PINATA_JWT;
  const pinataGateway = process.env.PINATA_GATEWAY;

  if (!pinataJwt || !pinataGateway) {
    throw new Error("Pinata environment variables are not configured");
  }

  return new PinataSDK({
    pinataJwt,
    pinataGateway,
  });
}
