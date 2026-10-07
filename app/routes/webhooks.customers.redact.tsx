import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, payload } = await authenticate.webhook(request); const data = payload as any; const tenant = await prisma.shopifyShop.findUnique({ where: { domain: shop } });
  if (tenant && data.customer?.id) await prisma.shopifyCustomer.updateMany({ where: { shopId: tenant.id, shopifyId: String(data.customer.id) }, data: { name: null, phone: null, email: null } });
  return new Response("ok", { status: 200 });
};
