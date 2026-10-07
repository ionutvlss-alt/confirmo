import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, useLoaderData } from "react-router";

import { OrdersTable, PageHeader, Shell } from "../components";
import prisma from "../db.server";
import { getShopContext } from "../lib/tenant.server";
import { buildTemplateParameters, sendWhatsAppMessage } from "../lib/whatsapp.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { shop } = await getShopContext(request);
  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const orders = await prisma.shopifyOrder.findMany({ where: { shopId: shop.id, ...(status ? { confirmationStatus: status } : {}) }, orderBy: { createdAt: "desc" }, take: 100 });
  return { orders, status: status || "all" };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop } = await getShopContext(request);
  const form = await request.formData();
  const orderId = String(form.get("orderId") || "");
  const order = await prisma.shopifyOrder.findFirst({ where: { id: orderId, shopId: shop.id } });
  if (!order) return { ok: false, error: "Order not found" };
  try {
    const templateParameters = await buildTemplateParameters(shop.id, [order.customerName || "Client", order.orderNumber, shop.name || shop.domain, "Produse comandate", `${order.totalAmount} ${order.currency}`]);
    const result = await sendWhatsAppMessage({ shopId: shop.id, orderId: order.id, phone: order.customerPhone || "", body: `Confirmă comanda ${order.orderNumber}`, templateParameters });
    await prisma.whatsAppMessage.create({ data: { shopId: shop.id, orderId: order.id, messageText: `Confirmă comanda ${order.orderNumber}`, recipientPhoneNumber: result.phone.normalized, providerMessageId: result.providerMessageId, deliveryStatus: result.deliveryStatus } });
    await prisma.analyticsEvent.create({ data: { shopId: shop.id, orderId: order.id, eventType: "message_sent", eventData: JSON.stringify({ source: "orders_page" }), phoneStatus: result.phone.valid ? "valid" : "invalid", phoneNormalized: result.phone.normalized, phoneConfidence: result.phone.confidence } });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not send WhatsApp message" };
  }
};

export default function OrdersPage() {
  const { orders, status } = useLoaderData<typeof loader>();
  return <Shell><PageHeader title="Orders" description="Review confirmation state and send a new WhatsApp request." /><div className="confirmo-card"><div className="confirmo-card-pad"><div className="confirmo-actions"><a className={`confirmo-action ${status === "all" ? "confirmo-action-primary" : ""}`} href="/app/orders">All</a><a className={`confirmo-action ${status === "pending" ? "confirmo-action-primary" : ""}`} href="/app/orders?status=pending">Pending</a><a className={`confirmo-action ${status === "confirmed" ? "confirmo-action-primary" : ""}`} href="/app/orders?status=confirmed">Confirmed</a><a className={`confirmo-action ${status === "declined" ? "confirmo-action-primary" : ""}`} href="/app/orders?status=declined">Declined</a></div></div><OrdersTable orders={orders} showActions /></div><div style={{ height: 16 }} /><div className="confirmo-callout"><strong>Send confirmation</strong><div className="confirmo-muted">To send a message, open an order and use the action there. Demo mode records the message locally; live mode calls Meta WhatsApp Cloud API.</div></div></Shell>;
}
