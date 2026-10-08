import crypto from "node:crypto";

import prisma from "../db.server";
import { decryptSecret } from "./crypto.server";

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

  if (process.env.DEMO_MODE === "true" || !token || !phoneNumberId) {
    return { providerMessageId: `demo-${crypto.randomUUID()}`, deliveryStatus: "accepted", phone };
  }

  const version = process.env.WHATSAPP_GRAPH_VERSION || "v23.0";
  const configuredTemplateName = configuredTemplate?.metaTemplateName?.trim();
  const legacyTemplateName = configuredTemplateName === "confirmo_order_confirmation" ? "noul_model_confirmare" : configuredTemplateName;
  const templateName = params.templateName || legacyTemplateName || process.env.WHATSAPP_TEMPLATE_NAME || "noul_model_confirmare";
  const templateLanguage = params.templateLanguage || configuredTemplate?.languageCode || process.env.WHATSAPP_TEMPLATE_LANGUAGE || "ro";
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
  return { providerMessageId: payload.messages?.[0]?.id, deliveryStatus: "sent", phone };
}
