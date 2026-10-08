import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, Link, useLoaderData } from "react-router";

import { PageHeader, Shell, StatusBadge } from "../components";
import prisma from "../db.server";
import { getShopContext } from "../lib/tenant.server";
import { formatDate, formatMoney } from "../lib/format";
import { buildTemplateParameters, sendWhatsAppMessage } from "../lib/whatsapp.server";
import { syncShopifyConfirmationTag } from "../lib/shopify-admin.server";

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
    const allowedStatuses = ["pending", "confirmed", "declined", "modification_requested"];
    if (!allowedStatuses.includes(status)) return { ok: false, error: "Status invalid." };
    await prisma.$transaction([
      prisma.shopifyOrder.update({ where: { id: order.id }, data: { confirmationStatus: status } }),
      prisma.orderConfirmation.upsert({ where: { orderId: order.id }, update: { status, respondedAt: new Date(), responseSource: "merchant" }, create: { orderId: order.id, shopId: shop.id, status, respondedAt: new Date(), responseSource: "merchant" } }),
      prisma.analyticsEvent.create({ data: { shopId: shop.id, orderId: order.id, eventType: `order_${status}`, eventData: JSON.stringify({ source: "merchant" }) } }),
    ]);
    try { await syncShopifyConfirmationTag(shop.domain, order.shopifyId, status); } catch (error) { console.error("Merchant Shopify tag sync failed", error); }
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
  return <Shell><PageHeader title={`Comanda ${order.orderNumber}`} description={`${order.customerName || "Client necunoscut"} · ${order.customerPhone || "Fără număr de telefon"}`} action={<Link className="confirmo-action" to="/app/orders">Înapoi la comenzi</Link>} /><div className="confirmo-grid confirmo-grid-2"><section className="confirmo-card confirmo-card-pad"><h2>Confirmarea comenzii</h2><div style={{ display: "grid", gap: 14 }}><div><span className="confirmo-muted">Status</span><div><StatusBadge value={order.confirmationStatus} /></div></div><div><span className="confirmo-muted">Risc</span><div><StatusBadge value={order.confirmationRiskLevel} /> {order.confirmationRiskScore}/100</div></div><div><span className="confirmo-muted">Total</span><div style={{ fontSize: 22, fontWeight: 700 }}>{formatMoney(order.totalAmount, order.currency)}</div></div><Form method="post"><div className="confirmo-actions"><button className="confirmo-action confirmo-action-primary" name="intent" value="send">Trimite WhatsApp</button><button className="confirmo-action" name="intent" value="set-status" type="submit"><input type="hidden" name="status" value="confirmed" />Confirmă</button><button className="confirmo-action confirmo-action-critical" name="intent" value="set-status" type="submit"><input type="hidden" name="status" value="declined" />Anulează</button><button className="confirmo-action" name="intent" value="set-status" type="submit"><input type="hidden" name="status" value="modification_requested" />Solicită modificare</button></div></Form></div></section><section className="confirmo-card confirmo-card-pad"><h2>Produse</h2>{lineItems.map((item: any, index: number) => <div key={`${item.title}-${index}`} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #e1e3e5" }}><span>{item.title}</span><strong>×{item.quantity}</strong></div>)}</section></div><div style={{ height: 16 }} /><section className="confirmo-card"><div className="confirmo-card-pad"><h2>Istoric mesaje</h2></div>{order.messages.length === 0 ? <div className="confirmo-empty">Nu au fost trimise mesaje pentru această comandă.</div> : <table className="confirmo-table"><thead><tr><th>Când</th><th>Mesaj</th><th>Status</th></tr></thead><tbody>{order.messages.map((message: any) => <tr key={message.id}><td>{formatDate(message.sentAt)}</td><td>{message.messageText}</td><td><StatusBadge value={message.deliveryStatus} /></td></tr>)}</tbody></table>}</section></Shell>;
}
