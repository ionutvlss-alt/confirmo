import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";

import { PageHeader, Shell, StatCard, StatusBadge } from "../components";
import prisma from "../db.server";
import { getShopContext } from "../lib/tenant.server";
import { formatDate } from "../lib/format";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { shop } = await getShopContext(request);
  const url = new URL(request.url);
  const days = url.searchParams.get("days") || "30";
  const since = days === "all" ? undefined : new Date(Date.now() - Number(days) * 24 * 60 * 60 * 1000);
  const [events, total, confirmed, declined, phoneIssues, highRisk, riskRows] = await Promise.all([
    prisma.analyticsEvent.findMany({ where: { shopId: shop.id, ...(since ? { occurredAt: { gte: since } } : {}) }, orderBy: { occurredAt: "desc" }, take: 250, include: { order: true } }),
    prisma.shopifyOrder.count({ where: { shopId: shop.id } }),
    prisma.shopifyOrder.count({ where: { shopId: shop.id, confirmationStatus: "confirmed" } }),
    prisma.shopifyOrder.count({ where: { shopId: shop.id, confirmationStatus: "declined" } }),
    prisma.analyticsEvent.count({ where: { shopId: shop.id, phoneStatus: { not: null }, ...(since ? { occurredAt: { gte: since } } : {}) } }),
    prisma.shopifyOrder.count({ where: { shopId: shop.id, confirmationRiskLevel: "high" } }),
    prisma.shopifyOrder.groupBy({ by: ["confirmationRiskLevel"], where: { shopId: shop.id }, _count: true }),
  ]);
  return { events, total, confirmed, declined, phoneIssues, highRisk, riskRows, days };
};

export default function AnalyticsPage() {
  const data = useLoaderData<typeof loader>();
  const decided = data.confirmed + data.declined;
  return <Shell><PageHeader title="Analytics" description="Understand confirmation performance, phone quality and operational risk." action={<div className="confirmo-actions"><a className={`confirmo-action ${data.days === "30" ? "confirmo-action-primary" : ""}`} href="/app/analytics?days=30">30 days</a><a className={`confirmo-action ${data.days === "all" ? "confirmo-action-primary" : ""}`} href="/app/analytics?days=all">All time</a></div>} /><div className="confirmo-grid confirmo-grid-4"><StatCard label="Confirmation rate" value={`${decided ? Math.round((data.confirmed / decided) * 100) : 0}%`} /><StatCard label="Orders tracked" value={data.total} /><StatCard label="High-risk orders" value={data.highRisk} /><StatCard label="Phone issues" value={data.phoneIssues} note="Invalid or incomplete numbers" /></div><div style={{ height: 16 }} /><div className="confirmo-grid confirmo-grid-2"><section className="confirmo-card confirmo-card-pad"><h2>Risk distribution</h2><div style={{ display: "grid", gap: 16 }}>{data.riskRows.map((row: any) => <div key={row.confirmationRiskLevel}><div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}><StatusBadge value={row.confirmationRiskLevel} /><strong>{row._count}</strong></div><div className="confirmo-progress"><span style={{ width: `${data.total ? Math.round((row._count / data.total) * 100) : 0}%` }} /></div></div>)}</div></section><section className="confirmo-card"><div className="confirmo-card-pad"><h2>Recent events</h2></div>{data.events.length === 0 ? <div className="confirmo-empty">No analytics events yet.</div> : <table className="confirmo-table"><thead><tr><th>Event</th><th>Order</th><th>When</th></tr></thead><tbody>{data.events.slice(0, 12).map((event: any) => <tr key={event.id}><td><strong>{event.eventType}</strong></td><td>{event.order?.orderNumber || "—"}</td><td>{formatDate(event.occurredAt)}</td></tr>)}</tbody></table>}</section></div></Shell>;
}
