import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, useActionData, useLoaderData } from "react-router";

import { PageHeader, Shell } from "../components";
import prisma from "../db.server";
import { getShopContext } from "../lib/tenant.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { shop } = await getShopContext(request);
  const templates = await prisma.messageTemplate.findMany({ where: { shopId: shop.id }, orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }] });
  return { templates };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop } = await getShopContext(request);
  const form = await request.formData();
  const id = String(form.get("id") || "");
  const templateName = String(form.get("templateName") || "").trim();
  const metaTemplateName = String(form.get("metaTemplateName") || templateName).trim();
  const messageTemplate = String(form.get("messageTemplate") || "").trim();
  if (!templateName || !metaTemplateName || !messageTemplate) return { ok: false, error: "Completează toate câmpurile obligatorii." };
  if (id) await prisma.messageTemplate.updateMany({ where: { id, shopId: shop.id }, data: { templateName, metaTemplateName, messageTemplate, languageCode: String(form.get("languageCode") || "ro"), button1Text: String(form.get("button1Text") || "Confirmă comanda"), button2Text: String(form.get("button2Text") || "Refuză comanda"), button3Text: String(form.get("button3Text") || "Vreau modificări") } });
  else await prisma.messageTemplate.create({ data: { shopId: shop.id, templateName, metaTemplateName, messageTemplate, languageCode: String(form.get("languageCode") || "ro") } });
  return { ok: true };
};

export default function TemplatesPage() {
  const { templates } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const template = templates[0];
  return (
    <Shell>
      <PageHeader
        title="Message templates"
        description="Use a Meta-approved template for the first outbound message."
        action={<span className="confirmo-badge confirmo-badge-success">{template ? "Template ready" : "Needs setup"}</span>}
      />
      <div className="confirmo-grid confirmo-grid-2">
        <section className="confirmo-card confirmo-card-pad">
          <h2>{template ? "Active template" : "Create your first template"}</h2>
          <Form method="post" className="confirmo-form">
            {template ? <input type="hidden" name="id" value={template.id} /> : null}
            <div className="confirmo-field">
              <label htmlFor="templateName">Internal name</label>
              <input id="templateName" name="templateName" defaultValue={template?.templateName || "confirmo_order_confirmation"} required />
            </div>
            <div className="confirmo-field">
              <label htmlFor="metaTemplateName">Meta template name</label>
              <input id="metaTemplateName" name="metaTemplateName" defaultValue={template?.metaTemplateName || "confirmo_order_confirmation"} required />
              <span className="confirmo-help">This must match the approved template name in Meta Business Manager.</span>
            </div>
            <div className="confirmo-field">
              <label htmlFor="languageCode">Language code</label>
              <select id="languageCode" name="languageCode" defaultValue={template?.languageCode || "ro"}>
                <option value="ro">Romanian (ro)</option>
                <option value="ro_RO">Romanian (ro_RO)</option>
                <option value="en_US">English (en_US)</option>
                <option value="hu_HU">Hungarian (hu_HU)</option>
                <option value="de_DE">German (de_DE)</option>
              </select>
              <span className="confirmo-help">Select the exact locale used by the template in Meta. For this Romanian template, try ro first.</span>
            </div>
            <div className="confirmo-field">
              <label htmlFor="messageTemplate">Preview/body description</label>
              <textarea
                id="messageTemplate"
                name="messageTemplate"
                defaultValue={template?.messageTemplate || "Salut, {{1}}! Pentru a confirma comanda {{2}} de la {{3}} (produse: {{4}}, total: {{5}}), te rugăm să apeși pe butonul de mai jos. Mulțumim!"}
                required
              />
              <span className="confirmo-help">The placeholders are positional: {"{{1}}"} customer, {"{{2}}"} order number, {"{{3}}"} shop, {"{{4}}"} products, {"{{5}}"} total.</span>
            </div>
            <div className="confirmo-grid confirmo-grid-2">
              <div className="confirmo-field">
                <label htmlFor="button1Text">Button 1</label>
                <input id="button1Text" name="button1Text" defaultValue={template?.button1Text || "Confirmă comanda"} />
              </div>
              <div className="confirmo-field">
                <label htmlFor="button2Text">Button 2</label>
                <input id="button2Text" name="button2Text" defaultValue={template?.button2Text || "Refuză comanda"} />
              </div>
            </div>
            <div className="confirmo-field">
              <label htmlFor="button3Text">Button 3</label>
              <input id="button3Text" name="button3Text" defaultValue={template?.button3Text || "Vreau modificări"} />
            </div>
            {actionData?.error ? <div className="confirmo-callout" style={{ borderColor: "#b42318", background: "#fff1f1" }}>{actionData.error}</div> : null}
            <button className="confirmo-action confirmo-action-primary" type="submit">Save template</button>
          </Form>
        </section>
        <section className="confirmo-card confirmo-card-pad">
          <h2>Available variables</h2>
          <div className="confirmo-callout">
            <strong>Use these variables in Meta template body parameters</strong>
            <p className="confirmo-muted">Confirmo sends five values in this order: customer name, order number, shop name, product summary and total amount.</p>
          </div>
          <div style={{ height: 16 }} />
          <div className="confirmo-steps">
            <div className="confirmo-step"><div><strong>Approve the template in Meta</strong><span className="confirmo-muted">The technical name and locale must match exactly.</span></div></div>
            <div className="confirmo-step"><div><strong>Save the same name here</strong><span className="confirmo-muted">Confirmo uses it for outbound template calls.</span></div></div>
            <div className="confirmo-step"><div><strong>Send a sandbox test</strong><span className="confirmo-muted">Verify phone formatting and delivery before activating.</span></div></div>
          </div>
        </section>
      </div>
    </Shell>
  );
}
