import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, useActionData, useLoaderData } from "react-router";

import { PageHeader, Shell, StatusBadge } from "../components";
import prisma from "../db.server";
import { getShopContext } from "../lib/tenant.server";
import { buildTemplateParameters, sendWhatsAppMessage } from "../lib/whatsapp.server";

export const loader = async ({ request }: LoaderFunctionArgs) => { const { shop } = await getShopContext(request); return { shop: shop.domain, events: await prisma.analyticsEvent.findMany({ where: { shopId: shop.id }, orderBy: { occurredAt: "desc" }, take: 8 }) }; };
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop } = await getShopContext(request);
  const form = await request.formData();
  const phone = String(form.get("phone") || "");

  try {
    const templateParameters = await buildTemplateParameters(shop.id, ["John Doe", "123456", "Confirmo", "Produse comandate", "299 RON"]);
    const result = await sendWhatsAppMessage({
      shopId: shop.id,
      phone,
      body: "Acesta este un mesaj de test Confirmo.",
      templateParameters,
    });
    await prisma.whatsAppMessage.create({ data: { shopId: shop.id, messageText: "Acesta este un mesaj de test Confirmo.", recipientPhoneNumber: result.phone.normalized, providerMessageId: result.providerMessageId, deliveryStatus: result.deliveryStatus } });
    await prisma.analyticsEvent.create({ data: { shopId: shop.id, eventType: "sandbox_message_sent", eventData: JSON.stringify({ phone: result.phone.normalized }) } });
    return { ok: true, status: result.deliveryStatus, phone: result.phone.normalized };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Sandbox test failed" };
  }
};
export default function SandboxPage() { const data = useLoaderData<typeof loader>(); const result = useActionData<typeof action>(); return <Shell><PageHeader title="Sandbox" description="Test phone validation and the WhatsApp sending path without touching a real order." /><div className="confirmo-grid confirmo-grid-2"><section className="confirmo-card confirmo-card-pad"><h2>Send a test</h2><Form method="post" className="confirmo-form"><div className="confirmo-field"><label htmlFor="phone">Destination phone</label><input id="phone" name="phone" type="tel" placeholder="+40 722 123 456" required /><span className="confirmo-help">In demo mode the message is recorded locally. In live mode it uses the configured Meta number.</span></div><button className="confirmo-action confirmo-action-primary" type="submit">Run sandbox test</button>{result?.ok ? <div className="confirmo-callout">Message accepted for {result.phone}. Status: <StatusBadge value={result.status || "accepted"} /></div> : null}{result?.error ? <div className="confirmo-callout" style={{ borderColor: "#b42318", background: "#fff1f1" }}>{result.error}</div> : null}</Form></section><section className="confirmo-card confirmo-card-pad"><h2>Recent sandbox events</h2>{data.events.length === 0 ? <div className="confirmo-empty">No tests yet.</div> : <div style={{ display: "grid", gap: 12 }}>{data.events.map((event: any) => <div key={event.id}><strong>{event.eventType}</strong><div className="confirmo-muted">{new Date(event.occurredAt).toLocaleString("ro-RO")}</div></div>)}</div>}</section></div></Shell>; }
