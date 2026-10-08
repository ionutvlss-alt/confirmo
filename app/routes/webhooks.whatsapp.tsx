import crypto from "node:crypto";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import prisma from "../db.server";
import { ensureShop } from "../lib/tenant.server";
import { DEMO_SHOP, isDemoMode } from "../lib/constants";
import { decryptSecret } from "../lib/crypto.server";
import { syncShopifyConfirmationTag } from "../lib/shopify-admin.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const verifyToken = url.searchParams.get("hub.verify_token");
  if (url.searchParams.get("hub.mode") === "subscribe" && verifyToken) {
    if (verifyToken === process.env.WHATSAPP_VERIFY_TOKEN) return new Response(url.searchParams.get("hub.challenge") || "", { status: 200 });
    const configs = await prisma.whatsAppConfig.findMany({ where: { isActive: true }, select: { webhookToken: true } });
    if (configs.some((config) => { try { return decryptSecret(config.webhookToken) === verifyToken; } catch { return false; } })) return new Response(url.searchParams.get("hub.challenge") || "", { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
};

function validSignature(raw: string, signature: string | null) {
  if (!signature || !process.env.WHATSAPP_APP_SECRET) return process.env.DEMO_MODE === "true";
  const expected = `sha256=${crypto.createHmac("sha256", process.env.WHATSAPP_APP_SECRET).update(raw).digest("hex")}`;
  const expectedBuffer = Buffer.from(expected); const signatureBuffer = Buffer.from(signature);
  return expectedBuffer.length === signatureBuffer.length && crypto.timingSafeEqual(expectedBuffer, signatureBuffer);
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const raw = await request.text();
  if (!validSignature(raw, request.headers.get("x-hub-signature-256"))) return new Response("Unauthorized", { status: 401 });
  const body = JSON.parse(raw); const change = body.entry?.[0]?.changes?.[0]?.value; const message = change?.messages?.[0];
  if (!message) return new Response("ok", { status: 200 });
  const config = change.metadata?.phone_number_id ? await prisma.whatsAppConfig.findFirst({ where: { phoneNumberId: change.metadata.phone_number_id } }) : null;
  if (!config && !isDemoMode) return new Response("Unknown WhatsApp number", { status: 403 });
  const shop = config ? await prisma.shopifyShop.findUniqueOrThrow({ where: { id: config.shopId } }) : await ensureShop(DEMO_SHOP);
  const phone = message.from ? `+${message.from}` : "";
  const actionId = message.interactive?.button_reply?.id || message.button?.payload || "";
  const text = message.text?.body || "";
  const inferredAction = /^(da|yes|y|1|confirm|confirmă)$/i.test(text.trim()) ? "confirm" : /^(nu|no|n|2|decline|refuz)$/i.test(text.trim()) ? "decline" : /modif|schimb|edit|update/i.test(text) ? "modify" : "";
  const responseAction = actionId || inferredAction;
  if (!responseAction) return new Response("ok", { status: 200 });
  const orderId = responseAction.match(/(?:confirm|decline|modify)_([^_]+)_/)?.[1];
  const order = orderId ? await prisma.shopifyOrder.findFirst({ where: { shopId: shop.id, OR: [{ id: orderId }, { shopifyId: orderId }] } }) : await prisma.shopifyOrder.findFirst({ where: { shopId: shop.id, customerPhone: { contains: phone.slice(-8) }, confirmationStatus: "pending" } });
  if (order) {
    const status = /decline|cancel|no/i.test(responseAction) ? "declined" : /modify|change|edit|update/i.test(responseAction) ? "modification_requested" : "confirmed";
    await prisma.$transaction([prisma.shopifyOrder.update({ where: { id: order.id }, data: { confirmationStatus: status } }), prisma.orderConfirmation.upsert({ where: { orderId: order.id }, update: { status, respondedAt: new Date(), responseSource: "whatsapp" }, create: { orderId: order.id, shopId: shop.id, status, respondedAt: new Date(), responseSource: "whatsapp" } }), prisma.analyticsEvent.create({ data: { shopId: shop.id, orderId: order.id, eventType: `order_${status}`, eventData: JSON.stringify({ source: "whatsapp", messageId: message.id }) } })]);
    try { await syncShopifyConfirmationTag(shop.domain, order.shopifyId, status); } catch (error) { console.error("WhatsApp Shopify tag sync failed", error); }
    await prisma.reminder.updateMany({ where: { orderId: order.id, status: "active" }, data: { status: "cancelled", cancelledReason: "customer_responded" } });
  }
  return new Response("ok", { status: 200 });
};
