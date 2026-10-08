import type { LoaderFunctionArgs } from "react-router";
import { Link, useLoaderData } from "react-router";

import { OrdersTable, PageHeader, Shell, StatCard, StatusBadge } from "../components";
import prisma from "../db.server";
import { getShopContext } from "../lib/tenant.server";
import { syncOrders } from "../lib/shopify-data.server";
import { formatMoney } from "../lib/format";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { shop, admin } = await getShopContext(request);
  if (admin) {
    try { await syncOrders(shop.id, admin); } catch (error) { console.error("Order sync failed", error); }
  }

  const [orders, totalMessages, pending, confirmed, declined, sentToday, highRisk] = await Promise.all([
    prisma.shopifyOrder.findMany({ where: { shopId: shop.id }, orderBy: { createdAt: "desc" }, take: 10 }),
    prisma.whatsAppMessage.count({ where: { shopId: shop.id } }),
    prisma.shopifyOrder.count({ where: { shopId: shop.id, confirmationStatus: "pending" } }),
    prisma.shopifyOrder.count({ where: { shopId: shop.id, confirmationStatus: "confirmed" } }),
    prisma.shopifyOrder.count({ where: { shopId: shop.id, confirmationStatus: "declined" } }),
    prisma.whatsAppMessage.count({ where: { shopId: shop.id, sentAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } } }),
    prisma.shopifyOrder.findMany({ where: { shopId: shop.id, confirmationRiskLevel: "high" }, orderBy: { confirmationRiskScore: "desc" }, take: 5 }),
  ]);

  const totalDecided = confirmed + declined;
  return { shop: shop.name || shop.domain, orders, highRisk, totalMessages, pending, confirmed, declined, sentToday, confirmationRate: totalDecided ? Math.round((confirmed / totalDecided) * 100) : 0 };
};

export default function Dashboard() {
  const data = useLoaderData<typeof loader>();
  return (
    <Shell>
      <PageHeader eyebrow={data.shop} title="Confirmo dashboard" description="The control center for WhatsApp order confirmations." action={<Link className="confirmo-action confirmo-action-primary" to="setup-guide">Complete setup</Link>} />
      <div className="confirmo-grid confirmo-grid-4">
        <StatCard label="Pending confirmations" value={data.pending} note="Orders waiting for a response" />
        <StatCard label="Confirmed orders" value={data.confirmed} note={`${data.confirmationRate}% confirmation rate`} />
        <StatCard label="Messages sent today" value={data.sentToday} note={`${data.totalMessages} total messages`} />
        <StatCard label="Declined orders" value={data.declined} note="Review before fulfilment" />
      </div>
      <div style={{ height: 16 }} />
      <div className="confirmo-grid confirmo-grid-2">
        <section className="confirmo-card">
          <div className="confirmo-card-pad"><h2>Recent orders</h2></div>
          <OrdersTable orders={data.orders} showActions />
        </section>
        <section className="confirmo-card">
          <div className="confirmo-card-pad"><h2>High-risk orders</h2></div>
          {data.highRisk.length === 0 ? <div className="confirmo-empty">No high-risk orders detected.</div> : (
            <div style={{ padding: "0 20px 20px", display: "grid", gap: 14 }}>
              {data.highRisk.map((order: any) => <div key={order.id} style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center" }}><div><strong>{order.orderNumber}</strong><div className="confirmo-muted">{order.customerName} · {formatMoney(order.totalAmount, order.currency)}</div></div><StatusBadge value="high" /></div>)}
            </div>
          )}
        </section>
      </div>
    </Shell>
  );
}
