import prisma from "../db.server";

const API_VERSION = "2026-07";

const TAGS_BY_STATUS: Record<string, string> = {
  pending: "Confirmo: În așteptare",
  confirmed: "Confirmo: Confirmat",
  declined: "Confirmo: Anulat",
  modification_requested: "Confirmo: Modificare",
};

const CONFIRMO_TAGS = Object.values(TAGS_BY_STATUS);

export async function syncShopifyConfirmationTag(shop: string, shopifyOrderId: string, status: string) {
  const tag = TAGS_BY_STATUS[status];
  if (!tag || !shopifyOrderId) return;

  const session = await prisma.session.findFirst({
    where: { shop, isOnline: false },
    orderBy: { expires: "desc" },
  });
  if (!session?.accessToken) return;

  const response = await fetch(`https://${shop}/admin/api/${API_VERSION}/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": session.accessToken,
    },
    body: JSON.stringify({
      query: `mutation SyncConfirmoTags($id: ID!, $remove: [String!]!, $add: [String!]!) {
        tagsRemove(id: $id, tags: $remove) { userErrors { message } }
        tagsAdd(id: $id, tags: $add) { userErrors { message } }
      }`,
      variables: { id: shopifyOrderId, remove: CONFIRMO_TAGS, add: [tag] },
    }),
    signal: AbortSignal.timeout(8000),
  });

  const payload = await response.json() as {
    errors?: Array<{ message?: string }>;
    data?: { tagsRemove?: { userErrors?: Array<{ message?: string }> }; tagsAdd?: { userErrors?: Array<{ message?: string }> } };
  };
  const errors = [
    ...(payload.errors || []),
    ...(payload.data?.tagsRemove?.userErrors || []),
    ...(payload.data?.tagsAdd?.userErrors || []),
  ].map((error) => error.message).filter(Boolean);
  if (!response.ok || errors.length) throw new Error(`Shopify order tag sync failed: ${errors.join("; ") || response.statusText}`);
}
