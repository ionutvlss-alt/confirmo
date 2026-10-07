import type { ActionFunctionArgs } from "react-router";

import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { ensureShop } from "../lib/tenant.server";
import { buildTemplateParameters, sendWhatsAppMessage } from "../lib/whatsapp.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop, payload } = await authenticate.webhook(request);
  const webhookId = request.headers.get("x-shopify-webhook-id");
  if (webhookId && await prisma.webhookEvent.findUnique({ where: { id: webhookId } })) return new Response("duplicate", { status: 200 });
  const tenant = await ensureShop(shop);
  const order = payload as any;
  const saved = await prisma.shopifyOrder.upsert({
    where: { shopifyId: String(order.admin_graphql_api_id || order.id) },
    update: { orderNumber: String(order.name || order.order_number || order.id), customerName: [order.customer?.first_name, order.customer?.last_name].filter(Boolean).join(" ") || null, customerPhone: order.phone || order.customer?.phone || null, customerEmail: order.email || order.customer?.email || null, totalAmount: String(order.total_price || "0"), currency: String(order.currency || tenant.currency), lineItemsJson: JSON.stringify(order.line_items || []) },
    create: { shopId: tenant.id, shopifyId: String(order.admin_graphql_api_id || order.id), orderNumber: String(order.name || order.order_number || order.id), customerName: [order.customer?.first_name, order.customer?.last_name].filter(Boolean).join(" ") || null, customerPhone: order.phone || order.customer?.phone || null, customerEmail: order.email || order.customer?.email || null, totalAmount: String(order.total_price || "0"), currency: String(order.currency || tenant.currency), lineItemsJson: JSON.stringify(order.line_items || []) },
  });
  await prisma.orderConfirmation.upsert({ where: { orderId: saved.id }, update: {}, create: { orderId: saved.id, shopId: tenant.id, status: "pending" } });
  if (webhookId) await prisma.webhookEvent.create({ data: { id: webhookId, topic, shop } });

  if (saved.customerPhone) {
    try {
      const productSummary = (order.line_items || [])
        .map((item: any) => `${item.title || "Produs"} x${item.quantity || 1}`)
        .join(", ") || "Produse comandate";
      const total = `${saved.totalAmount} ${saved.currency}`.trim();
      const templateParameters = await buildTemplateParameters(tenant.id, [
        saved.customerName || "Client",
        saved.orderNumber,
        tenant.name || tenant.domain,
        productSummary,
        total,
      ]);
      const sent = await sendWhatsAppMessage({
        shopId: tenant.id,
        orderId: saved.id,
        phone: saved.customerPhone,
        body: `Confirmă comanda ${saved.orderNumber}`,
        templateParameters,
      });
      await prisma.whatsAppMessage.create({
        data: {
          shopId: tenant.id,
          orderId: saved.id,
          messageText: `Confirmă comanda ${saved.orderNumber}`,
          recipientPhoneNumber: sent.phone.normalized,
          providerMessageId: sent.providerMessageId,
          deliveryStatus: sent.deliveryStatus,
        },
      });
      await prisma.analyticsEvent.create({
        data: {
          shopId: tenant.id,
          orderId: saved.id,
          eventType: "message_sent",
          eventData: JSON.stringify({ source: "orders_create_webhook" }),
          phoneStatus: sent.phone.valid ? "valid" : "invalid",
          phoneNormalized: sent.phone.normalized,
          phoneConfidence: sent.phone.confidence,
        },
      });
    } catch (error) {
      await prisma.analyticsEvent.create({
        data: {
          shopId: tenant.id,
          orderId: saved.id,
          eventType: "message_failed",
          eventData: JSON.stringify({ source: "orders_create_webhook", error: error instanceof Error ? error.message : "unknown" }),
        },
      });
      console.error("Automatic WhatsApp order confirmation failed", error);
    }
  }
  return new Response("ok", { status: 200 });
};
