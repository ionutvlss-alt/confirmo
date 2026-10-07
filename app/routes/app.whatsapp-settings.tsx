import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, useActionData, useLoaderData } from "react-router";

import { PageHeader, Shell } from "../components";
import prisma from "../db.server";
import { encryptSecret } from "../lib/crypto.server";
import { getShopContext } from "../lib/tenant.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { shop } = await getShopContext(request);
  const config = await prisma.whatsAppConfig.findUnique({ where: { shopId: shop.id } });
  return { config: config ? { businessAccountId: config.businessAccountId, phoneNumberId: config.phoneNumberId, isActive: config.isActive, accessTokenSaved: Boolean(config.accessTokenEncrypted), webhookTokenSaved: Boolean(config.webhookToken) } : null };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop } = await getShopContext(request);
  const form = await request.formData();
  const token = String(form.get("accessToken") || "").trim();
  await prisma.whatsAppConfig.upsert({
    where: { shopId: shop.id },
    update: { ...(token ? { accessTokenEncrypted: encryptSecret(token) } : {}), businessAccountId: String(form.get("businessAccountId") || ""), phoneNumberId: String(form.get("phoneNumberId") || ""), ...(form.get("webhookToken") ? { webhookToken: String(form.get("webhookToken")) } : {}), isActive: form.get("isActive") === "on" },
    create: { shopId: shop.id, ...(token ? { accessTokenEncrypted: encryptSecret(token) } : {}), businessAccountId: String(form.get("businessAccountId") || ""), phoneNumberId: String(form.get("phoneNumberId") || ""), ...(form.get("webhookToken") ? { webhookToken: String(form.get("webhookToken")) } : {}), isActive: form.get("isActive") === "on" },
  });
  return { ok: true };
};

export default function WhatsAppSettingsPage() {
  const { config } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  return <Shell><PageHeader title="WhatsApp settings" description="Connect a Meta WhatsApp Cloud API number for outbound messages." action={<span className={`confirmo-badge ${config?.isActive ? "confirmo-badge-success" : "confirmo-badge-warning"}`}>{config?.isActive ? "Connected" : "Not connected"}</span>} /><div className="confirmo-grid confirmo-grid-2"><section className="confirmo-card confirmo-card-pad"><Form method="post" className="confirmo-form"><div className="confirmo-field"><label htmlFor="accessToken">Access token</label><input id="accessToken" name="accessToken" type="password" placeholder={config?.accessTokenSaved ? "Saved securely — enter to replace" : "Paste a Meta token"} autoComplete="new-password" /><span className="confirmo-help">Stored encrypted at rest. Never sent to the browser after save.</span></div><div className="confirmo-field"><label htmlFor="businessAccountId">Business account ID</label><input id="businessAccountId" name="businessAccountId" defaultValue={config?.businessAccountId || ""} /></div><div className="confirmo-field"><label htmlFor="phoneNumberId">Phone number ID</label><input id="phoneNumberId" name="phoneNumberId" defaultValue={config?.phoneNumberId || ""} /></div><div className="confirmo-field"><label htmlFor="webhookToken">Webhook verify token</label><input id="webhookToken" name="webhookToken" type="password" placeholder={config?.webhookTokenSaved ? "Saved securely — enter to replace" : "Enter a verify token"} autoComplete="new-password" /></div><label style={{ display: "flex", gap: 8, alignItems: "center" }}><input type="checkbox" name="isActive" defaultChecked={config?.isActive || false} /> Enable WhatsApp sending</label>{actionData?.ok ? <div className="confirmo-callout">Settings saved.</div> : null}<button className="confirmo-action confirmo-action-primary" type="submit">Save settings</button></Form></section><section className="confirmo-card confirmo-card-pad"><h2>Connection checklist</h2><div className="confirmo-steps"><div className="confirmo-step"><div><strong>Create a Meta app</strong><span className="confirmo-muted">Add the WhatsApp product and choose the Cloud API.</span></div></div><div className="confirmo-step"><div><strong>Configure the webhook URL</strong><span className="confirmo-muted">Point Meta to <code>/webhooks/whatsapp</code> and use the verify token above.</span></div></div><div className="confirmo-step"><div><strong>Use approved templates</strong><span className="confirmo-muted">First-contact messages must use an approved Meta template.</span></div></div></div></section></div></Shell>;
}
