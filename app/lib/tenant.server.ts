import type { Session } from "@shopify/shopify-api";

import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { DEMO_SHOP, isDemoMode } from "./constants";

export async function getShopDomain(request: Request): Promise<string> {
  if (isDemoMode) return DEMO_SHOP;
  const { session } = await authenticate.admin(request);
  return session.shop;
}

export async function getShopContext(request: Request) {
  if (isDemoMode) {
    const shop = await ensureShop(DEMO_SHOP);
    return { shop, session: null, admin: null };
  }

  const auth = await authenticate.admin(request);
  const shop = await ensureShop(auth.session.shop);
  return { shop, session: auth.session as Session, admin: auth.admin };
}

export async function ensureShop(domain: string) {
  return prisma.shopifyShop.upsert({
    where: { domain },
    update: {},
    create: { domain, name: domain.replace(".myshopify.com", "") },
  });
}
