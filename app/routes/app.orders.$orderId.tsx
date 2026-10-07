import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, Link, useLoaderData } from "react-router";

import { PageHeader, Shell, StatusBadge } from "../components";
import prisma from "../db.server";
import { getShopContext } from "../lib/tenant.server";
import { formatDate, formatMoney } from "../lib/format";
import { buildTemplateParameters, sendWhatsAppMessage } from "../lib/whatsapp.server";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { shop } = await getShopContext(request);
  const order = await prisma.shopifyOrder.findFirst({ where: { id: params.orderId, shopId: shop.id }, include: { messages: { orderBy: { sentAt: "desc" }, take: 20 }, reminders: { orderBy: { createdAt: "desc" } }, analyticsEvents: { orderBy: { occurredAt: "desc" }, take: 20 } } });
  if (!order) throw new Response("Not found", { status: 404 });
  return { order, lineItems: JSON.parse(order.lineItemsJson) };
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { shop } = await getShopContext(request);
  const order = await prisma.shopifyOrder.findFirst({ where: { id: params.orderId, shopId: shop.id } });
  if (!order) return { ok: false, error: "Order not found" };
  const form = await request.formData();
  const intent = String(form.get("intent"));
  if (intent === "set-status") {
    const status = String(form.get("status"));
    await prisma.$transaction([
      prisma.shopifyOrder.update({ where: { id: order.id }, data: { confirmationStatus: status } }),
      prisma.orderConfirmation.upsert({ where: { orderId: order.id }, update: { status, respondedAt: new Date(), responseSource: "merchant" }, create: { orderId: order.id, shopId: shop.id, status, respondedAt: new Date(), responseSource: "merchant" } }),
      prisma.analyticsEvent.create({ data: { shopId: shop.id, orderId: order.id, eventType: `order_${status}`, eventData: JSON.stringify({ source: "merchant" }) } }),
    ]);
    return { ok: true };
  }
  if (intent === "send") {
    try {
      const templateParameters = await buildTemplateParameters(shop.id, [order.customerName || "Client", order.orderNumber, shop.name || shop.domain, "Produse comandate", `${order.totalAmount} ${order.currency}`]);
      const result = await sendWhatsAppMessage({ shopId: shop.id, orderId: order.id, phone: order.customerPhone ?? "", body: `Confirmă comanda ${order.orderNumber}`, templateParameters });
      await prisma.whatsAppMessage.create({ data: { shopId: shop.id, orderId: order.id, messageText: `Confirmă comanda ${order.orderNumber}`, recipientPhoneNumber: result.phone.normalized, providerMessageId: result.providerMessageId, deliveryStatus: result.deliveryStatus } });
      await prisma.analyticsEvent.create({ data: { shopId: shop.id, orderId: order.id, eventType: "message_sent", eventData: JSON.stringify({ source: "order_detail" }), phoneStatus: "valid", phoneNormalized: result.phone.normalized, phoneConfidence: result.phone.confidence } });
      return { ok: true };
    } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Could not send message" }; }
  }
  return { ok: false, error: "Unknown action" };
};

export default function OrderDetailPage() {
  const { order, lineItems } = useLoaderData<typeof loader>();
  return <Shell><PageHeader title={`Order ${order.orderNumber}`} description={`${order.customerName || "Unknown customer"} · ${order.customerPhone || "No phone number"}`} action={<Link className="confirmo-action" to="/app/orders">Back to orders</Link>} /><div className="confirmo-grid confirmo-grid-2"><section className="confirmo-card confirmo-card-pad"><h2>Confirmation</h2><div style={{ display: "grid", gap: 14 }}><div><span className="confirmo-muted">Status</span><div><StatusBadge value={order.confirmationStatus} /></div></div><div><span className="confirmo-muted">Risk</span><div><StatusBadge value={order.confirmationRiskLevel} /> {order.confirmationRiskScore}/100</div></div><div><span className="confirmo-muted">Total</span><div style={{ fontSize: 22, fontWeight: 700 }}>{formatMoney(order.totalAmount, order.currency)}</div></div><Form method="post"><div className="confirmo-actions"><button className="confirmo-action confirmo-action-primary" name="intent" value="send">Send WhatsApp</button><button className="confirmo-action" name="intent" value="set-status" type="submit">Mark confirmed</button><input type="hidden" name="status" value="confirmed" /></div></Form></div></section><section className="confirmo-card confirmo-card-pad"><h2>Line items</h2>{lineItems.map((item: any, index: number) => <div key={`${item.title}-${index}`} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #e1e3e5" }}><span>{item.title}</span><strong>×{item.quantity}</strong></div>)}</section></div><div style={{ height: 16 }} /><section className="confirmo-card"><div className="confirmo-card-pad"><h2>Message history</h2></div>{order.messages.length === 0 ? <div className="confirmo-empty">No messages sent for this order.</div> : <table className="confirmo-table"><thead><tr><th>When</th><th>Message</th><th>Status</th></tr></thead><tbody>{order.messages.map((message: any) => <tr key={message.id}><td>{formatDate(message.sentAt)}</td><td>{message.messageText}</td><td><StatusBadge value={message.deliveryStatus} /></td></tr>)}</tbody></table>}</section></Shell>;
}
