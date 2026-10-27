import crypto from "node:crypto";

import prisma from "../db.server";
import { decryptSecret } from "./crypto.server";

async function resolveMetaTemplateLanguage(params: {
  businessAccountId: string | null | undefined;
  token: string;
  version: string;
  templateName: string;
  preferredLanguage: string;
}) {
  if (!params.businessAccountId) return params.preferredLanguage;
  const response = await fetch(`https://graph.facebook.com/${params.version}/${params.businessAccountId}/message_templates?fields=name,language,status&limit=200`, {
    headers: { Authorization: `Bearer ${params.token}` },
  });
  const payload = await response.json();
  if (!response.ok || payload.error) {
    throw new Error(`Meta template lookup failed (${response.status}): ${payload.error?.message || "unknown error"}`);
  }
  const templates = Array.isArray(payload.data) ? payload.data : [];
  const matches = templates.filter((template: any) => template.name === params.templateName && ["APPROVED", "ACTIVE"].includes(String(template.status || "").toUpperCase()));
  if (matches.length === 0) {
    throw new Error(`Templateul Meta '${params.templateName}' nu există ca template aprobat în WABA-ul configurat pentru aplicație.`);
  }
  const exact = matches.find((template: any) => (template.language_code || template.language) === params.preferredLanguage);
  const selected = exact || matches[0];
  const language = selected.language_code || selected.language;
  console.info("WhatsApp template resolved", { templateName: params.templateName, configuredLanguage: params.preferredLanguage, metaLanguage: language });
  return language || params.preferredLanguage;
}

export async function buildTemplateParameters(shopId: string, values: string[]) {
  const configuredTemplate = await prisma.messageTemplate.findFirst({
    where: { shopId },
    orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }],
  });
  const placeholderCount = configuredTemplate
    ? new Set(configuredTemplate.messageTemplate.match(/\{\{\d+\}\}/g) || []).size
    : values.length;
  return Array.from({ length: placeholderCount }, (_, index) => values[index] || `Demo ${index + 1}`);
}

export function normalizePhone(value: string | null | undefined) {
  const digits = (value || "").replace(/[^\d+]/g, "");
  if (digits.startsWith("00")) return `+${digits.slice(2)}`;
  if (digits.startsWith("+")) return digits;
  if (digits.startsWith("07") && digits.length === 10) return `+40${digits.slice(1)}`;
  return digits;
}

export function validatePhoneNumber(value: string | null | undefined) {
  const normalized = normalizePhone(value);
  const valid = /^\+[1-9]\d{7,14}$/.test(normalized);
  return { valid, normalized, confidence: valid ? 95 : 15, issueReason: valid ? null : "invalid_format" };
}

export async function sendWhatsAppMessage(params: {
  shopId: string;
  orderId?: string;
  phone: string;
  body: string;
  templateParameters?: string[];
  templateName?: string;
  templateLanguage?: string;
}) {
  const phone = validatePhoneNumber(params.phone);
  if (!phone.valid) throw new Error("Numărul de telefon nu este valid pentru WhatsApp.");

  const config = await prisma.whatsAppConfig.findUnique({ where: { shopId: params.shopId } });
  const configuredTemplate = await prisma.messageTemplate.findFirst({
    where: { shopId: params.shopId },
    orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }],
  });
  const token = decryptSecret(config?.accessTokenEncrypted) || process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = config?.phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (process.env.DEMO_MODE === "true") {
    console.warn("WhatsApp demo mode is enabled; no real message was sent", { shopId: params.shopId, orderId: params.orderId });
    return { providerMessageId: `demo-${crypto.randomUUID()}`, deliveryStatus: "accepted", phone };
  }
  if (!token || !phoneNumberId) {
    throw new Error("WhatsApp live configuration is incomplete: save an access token and phone number ID, or configure WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID.");
  }

  const version = process.env.WHATSAPP_GRAPH_VERSION || "v23.0";
  const configuredTemplateName = configuredTemplate?.metaTemplateName?.trim();
  const legacyTemplateName = configuredTemplateName === "confirmo_order_confirmation" ? "noul_model_confirmare" : configuredTemplateName;
  const templateName = params.templateName || legacyTemplateName || process.env.WHATSAPP_TEMPLATE_NAME || "noul_model_confirmare";
  const configuredLanguage = params.templateLanguage || configuredTemplate?.languageCode || process.env.WHATSAPP_TEMPLATE_LANGUAGE || "ro";
  const templateLanguage = await resolveMetaTemplateLanguage({ businessAccountId: config?.businessAccountId || process.env.WHATSAPP_BUSINESS_ACCOUNT_ID, token, version, templateName, preferredLanguage: configuredLanguage });
  const recipient = phone.normalized.replace(/^\+/, "");
  const response = await fetch(`https://graph.facebook.com/${version}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: recipient,
      type: "template",
      template: {
        name: templateName,
        language: { code: templateLanguage },
        components: [{ type: "body", parameters: (params.templateParameters || [params.body]).map((text) => ({ type: "text", text })) }],
      },
    }),
  });
  const payload = await response.json();
  if (!response.ok || payload.error) {
    throw new Error(payload.error?.message || "WhatsApp API request failed");
  }
  console.info("WhatsApp API accepted message", { shopId: params.shopId, orderId: params.orderId, providerMessageId: payload.messages?.[0]?.id, templateName, templateLanguage });
  return { providerMessageId: payload.messages?.[0]?.id, deliveryStatus: "sent", phone };
}
