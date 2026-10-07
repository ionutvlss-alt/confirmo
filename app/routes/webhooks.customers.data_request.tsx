import crypto from "node:crypto";
import type { ActionFunctionArgs } from "react-router";

function validShopifySignature(rawBody: string, signature: string | null) {
  const secret = process.env.SHOPIFY_API_SECRET;
  if (!secret || !signature) return process.env.DEMO_MODE === "true";
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("base64");
  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);
  return expectedBuffer.length === signatureBuffer.length && crypto.timingSafeEqual(expectedBuffer, signatureBuffer);
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const rawBody = await request.text();
  if (!validShopifySignature(rawBody, request.headers.get("x-shopify-hmac-sha256"))) return new Response("Unauthorized", { status: 401 });
  return new Response("ok", { status: 200 });
};
