import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop } = await authenticate.webhook(request); await prisma.shopifyShop.deleteMany({ where: { domain: shop } }); return new Response("ok", { status: 200 });
};
