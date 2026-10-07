import type { ActionFunctionArgs } from "react-router";

import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop } = await authenticate.webhook(request);
  if (topic !== "APP_UNINSTALLED") return new Response("ignored", { status: 200 });
  await prisma.shopifyShop.deleteMany({ where: { domain: shop } });
  return new Response("ok", { status: 200 });
};
