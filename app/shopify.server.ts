import { ApiVersion, shopifyApp } from "@shopify/shopify-app-react-router/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";

import prisma from "./db.server";

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY || "demo-api-key",
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "demo-api-secret",
  appUrl: process.env.SHOPIFY_APP_URL || "http://localhost:3000",
  apiVersion: ApiVersion.July26,
  sessionStorage: new PrismaSessionStorage(prisma),
});

export default shopify;
export const authenticate = shopify.authenticate;
export const sessionStorage = shopify.sessionStorage;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
