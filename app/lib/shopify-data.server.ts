import prisma from "../db.server";

const ORDERS_QUERY = `#graphql
  query ConfirmoOrders($first: Int!) {
    orders(first: $first, sortKey: CREATED_AT, reverse: true) {
      nodes {
        id
        name
        createdAt
        email
        phone
        customer { firstName lastName email phone }
        totalPriceSet { shopMoney { amount currencyCode } }
        lineItems(first: 25) {
          nodes { title quantity }
        }
      }
    }
  }
`;

export async function syncOrders(shopId: string, admin: { graphql: Function } | null) {
  if (!admin) return;
  const response = await admin.graphql(ORDERS_QUERY, { variables: { first: 50 } });
  const payload = await response.json();
  if (payload.errors?.length) throw new Error(payload.errors[0].message);

  for (const order of payload.data?.orders?.nodes ?? []) {
    const customer = order.customer;
    const customerName = customer
      ? [customer.firstName, customer.lastName].filter(Boolean).join(" ")
      : null;
    const phone = order.phone || customer?.phone || null;
    const savedOrder = await prisma.shopifyOrder.upsert({
      where: { shopifyId: order.id },
      update: {
        orderNumber: order.name,
        customerName,
        customerPhone: phone,
        customerEmail: order.email || customer?.email,
        totalAmount: order.totalPriceSet.shopMoney.amount,
        currency: order.totalPriceSet.shopMoney.currencyCode,
        lineItemsJson: JSON.stringify(order.lineItems.nodes),
      },
      create: {
        shopId,
        shopifyId: order.id,
        orderNumber: order.name,
        customerName,
        customerPhone: phone,
        customerEmail: order.email || customer?.email,
        totalAmount: order.totalPriceSet.shopMoney.amount,
        currency: order.totalPriceSet.shopMoney.currencyCode,
        lineItemsJson: JSON.stringify(order.lineItems.nodes),
      },
    });

    await prisma.orderConfirmation.upsert({
      where: { orderId: savedOrder.id },
      update: {},
      create: { orderId: savedOrder.id, shopId, status: savedOrder.confirmationStatus },
    });
  }
}
