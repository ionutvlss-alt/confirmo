import type { ActionFunctionArgs } from "react-router";

import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop, payload } = await authenticate.webhook(request);
  const webhookId = request.headers.get("x-shopify-webhook-id");
  if (webhookId && await prisma.webhookEvent.findUnique({ where: { id: webhookId } })) return new Response("duplicate", { status: 200 });
  const order = payload as any;
  const shopRecord = await prisma.shopifyShop.findUnique({ where: { domain: shop } });
  if (shopRecord) await prisma.shopifyOrder.updateMany({ where: { shopId: shopRecord.id, shopifyId: String(order.admin_graphql_api_id || order.id) }, data: { totalAmount: String(order.total_price || "0"), currency: String(order.currency || shopRecord.currency), customerPhone: order.phone || order.customer?.phone || null } });
  if (webhookId) await prisma.webhookEvent.create({ data: { id: webhookId, topic, shop } });
  return new Response("ok", { status: 200 });
};
