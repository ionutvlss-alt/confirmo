import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, payload } = await authenticate.webhook(request); const data = payload as any; const tenant = await prisma.shopifyShop.findUnique({ where: { domain: shop } });
  if (tenant && Array.isArray(data.orders_to_redact)) for (const id of data.orders_to_redact) await prisma.shopifyOrder.updateMany({ where: { shopId: tenant.id, shopifyId: String(id) }, data: { customerName: null, customerPhone: null, customerEmail: null } });
  return new Response("ok", { status: 200 });
};
