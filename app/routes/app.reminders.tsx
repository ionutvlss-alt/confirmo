import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, useLoaderData } from "react-router";

import { PageHeader, Shell, StatCard, StatusBadge } from "../components";
import prisma from "../db.server";
import { getShopContext } from "../lib/tenant.server";
import { formatDate } from "../lib/format";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { shop } = await getShopContext(request);
  const [settings, reminders, active, pending, completed, cancelled] = await Promise.all([
    prisma.shopSettings.findUnique({ where: { shopId: shop.id } }),
    prisma.reminder.findMany({ where: { shopId: shop.id }, include: { order: true }, orderBy: { nextReminderAt: "asc" }, take: 100 }),
    prisma.reminder.count({ where: { shopId: shop.id, status: "active" } }),
    prisma.reminder.count({ where: { shopId: shop.id, status: "pending" } }),
    prisma.reminder.count({ where: { shopId: shop.id, status: "completed" } }),
    prisma.reminder.count({ where: { shopId: shop.id, status: "cancelled" } }),
  ]);
  return { settings, reminders, active, pending, completed, cancelled };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop } = await getShopContext(request);
  const form = await request.formData();
  const intent = String(form.get("intent"));
  if (intent === "cancel") {
    const id = String(form.get("id"));
    await prisma.reminder.updateMany({ where: { id, shopId: shop.id, status: "active" }, data: { status: "cancelled", cancelledReason: "cancelled_by_merchant" } });
  }
  if (intent === "save-settings") {
    const reminderInterval = Math.max(1, Number(form.get("reminderInterval") || 24));
    const maxReminders = Math.max(0, Number(form.get("maxReminders") || 2));
    await prisma.shopSettings.upsert({ where: { shopId: shop.id }, update: { reminderInterval, maxReminders }, create: { shopId: shop.id, reminderInterval, maxReminders } });
  }
  return { ok: true };
};

export default function RemindersPage() {
  const data = useLoaderData<typeof loader>();
  return <Shell><PageHeader title="Reminders" description="Keep follow-ups helpful, bounded and transparent." /><div className="confirmo-grid confirmo-grid-4"><StatCard label="Active" value={data.active} /><StatCard label="Pending" value={data.pending} /><StatCard label="Completed" value={data.completed} /><StatCard label="Cancelled" value={data.cancelled} /></div><div style={{ height: 16 }} /><div className="confirmo-grid confirmo-grid-2"><section className="confirmo-card confirmo-card-pad"><h2>Reminder policy</h2><Form method="post" className="confirmo-form"><input type="hidden" name="intent" value="save-settings" /><div className="confirmo-field"><label htmlFor="reminderInterval">Interval (hours)</label><input id="reminderInterval" name="reminderInterval" type="number" min="1" defaultValue={data.settings?.reminderInterval || 24} /><span className="confirmo-help">Time between reminders for unanswered orders.</span></div><div className="confirmo-field"><label htmlFor="maxReminders">Maximum reminders</label><input id="maxReminders" name="maxReminders" type="number" min="0" max="5" defaultValue={data.settings?.maxReminders || 2} /></div><button className="confirmo-action confirmo-action-primary" type="submit">Save policy</button></Form></section><section className="confirmo-card"><div className="confirmo-card-pad"><h2>Scheduled reminders</h2></div>{data.reminders.length === 0 ? <div className="confirmo-empty">No reminders scheduled.</div> : <table className="confirmo-table"><thead><tr><th>Order</th><th>Next send</th><th>Sent</th><th>Status</th><th /></tr></thead><tbody>{data.reminders.map((reminder: any) => <tr key={reminder.id}><td>{reminder.order.orderNumber}</td><td>{formatDate(reminder.nextReminderAt)}</td><td>{reminder.remindersSent}/{reminder.maxReminders}</td><td><StatusBadge value={reminder.status} /></td><td>{reminder.status === "active" ? <Form method="post"><input type="hidden" name="intent" value="cancel" /><input type="hidden" name="id" value={reminder.id} /><button className="confirmo-action confirmo-action-critical" type="submit">Cancel</button></Form> : null}</td></tr>)}</tbody></table>}</section></div></Shell>;
}
