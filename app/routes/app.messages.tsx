import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";

import { PageHeader, Shell, StatCard, StatusBadge } from "../components";
import prisma from "../db.server";
import { formatDate } from "../lib/format";
import { getShopContext } from "../lib/tenant.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { shop } = await getShopContext(request);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const month = new Date(); month.setDate(1); month.setHours(0, 0, 0, 0);
  const [messagesToday, messagesMonth, messages, delivered, total] = await Promise.all([
    prisma.whatsAppMessage.count({ where: { shopId: shop.id, sentAt: { gte: today } } }),
    prisma.whatsAppMessage.count({ where: { shopId: shop.id, sentAt: { gte: month } } }),
    prisma.whatsAppMessage.findMany({ where: { shopId: shop.id }, orderBy: { sentAt: "desc" }, take: 100, include: { order: true } }),
    prisma.whatsAppMessage.count({ where: { shopId: shop.id, deliveryStatus: { in: ["delivered", "read"] } } }),
    prisma.whatsAppMessage.count({ where: { shopId: shop.id } }),
  ]);
  return { messagesToday, messagesMonth, messages, deliveryRate: total ? Math.round((delivered / total) * 100) : 0 };
};

export default function MessagesPage() {
  const data = useLoaderData<typeof loader>();
  return <Shell><PageHeader title="Messages" description="Every confirmation and reminder sent through WhatsApp." /><div className="confirmo-grid confirmo-grid-4"><StatCard label="Sent today" value={data.messagesToday} /><StatCard label="Sent this month" value={data.messagesMonth} /><StatCard label="Delivery rate" value={`${data.deliveryRate}%`} note="Delivered or read" /><StatCard label="History" value={data.messages.length} note="Latest 100 messages" /></div><div style={{ height: 16 }} /><section className="confirmo-card"><div className="confirmo-card-pad"><h2>Message history</h2></div>{data.messages.length === 0 ? <div className="confirmo-empty">No messages yet. Send your first confirmation from Orders.</div> : <div style={{ overflowX: "auto" }}><table className="confirmo-table"><thead><tr><th>Order</th><th>Phone</th><th>Message</th><th>Sent</th><th>Status</th></tr></thead><tbody>{data.messages.map((message: any) => <tr key={message.id}><td>{message.order?.orderNumber || "—"}</td><td>{message.recipientPhoneNumber}</td><td>{message.messageText}</td><td>{formatDate(message.sentAt)}</td><td><StatusBadge value={message.deliveryStatus} /></td></tr>)}</tbody></table></div>}</section></Shell>;
}
