import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop } = await authenticate.webhook(request);
  console.info("Shopify scopes updated", { topic, shop });
  return new Response("ok", { status: 200 });
};
