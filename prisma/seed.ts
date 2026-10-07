import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const shop = await prisma.shopifyShop.upsert({
    where: { domain: "demo.myshopify.com" },
    update: {},
    create: { domain: "demo.myshopify.com", name: "Demo Store", currency: "RON" },
  });

  await prisma.shopSettings.upsert({
    where: { shopId: shop.id },
    update: {},
    create: { shopId: shop.id },
  });

  const template = await prisma.messageTemplate.upsert({
    where: { shopId_templateName: { shopId: shop.id, templateName: "confirmo_order_confirmation" } },
    update: {},
    create: {
      shopId: shop.id,
      templateName: "confirmo_order_confirmation",
      metaTemplateName: "confirmo_order_confirmation",
      messageTemplate: "Salut {{1}}, confirmi comanda {{2}} de la {{3}, în valoare de {{4}}?",
      isActive: true,
    },
  });

  const sampleOrders = [
    { number: "#1042", name: "Andrei Popescu", phone: "+40722123456", amount: "249.90", status: "pending", risk: "high", score: 87 },
    { number: "#1041", name: "Maria Ionescu", phone: "+40744111222", amount: "129.00", status: "confirmed", risk: "low", score: 12 },
    { number: "#1040", name: "Alex Stoica", phone: "+40755123444", amount: "399.00", status: "pending", risk: "medium", score: 54 },
    { number: "#1039", name: "Ioana Dumitru", phone: "+40766111999", amount: "89.90", status: "declined", risk: "low", score: 28 },
  ];

  for (const item of sampleOrders) {
    const order = await prisma.shopifyOrder.upsert({
      where: { shopifyId: `demo-${item.number}` },
      update: {},
      create: {
        shopId: shop.id,
        shopifyId: `demo-${item.number}`,
        orderNumber: item.number,
        customerName: item.name,
        customerPhone: item.phone,
        totalAmount: item.amount,
        currency: "RON",
        confirmationStatus: item.status,
        confirmationRiskLevel: item.risk,
        confirmationRiskScore: item.score,
        lineItemsJson: JSON.stringify([{ title: "Produs Confirmo", quantity: 1 }]),
      },
    });

    await prisma.orderConfirmation.upsert({
      where: { orderId: order.id },
      update: { status: item.status },
      create: { orderId: order.id, shopId: shop.id, status: item.status },
    });
  }

  const pending = await prisma.shopifyOrder.findFirst({ where: { shopId: shop.id, confirmationStatus: "pending" } });
  if (pending) {
    await prisma.reminder.upsert({
      where: { id: "demo-reminder" },
      update: {},
      create: {
        id: "demo-reminder",
        shopId: shop.id,
        orderId: pending.id,
        status: "active",
        nextReminderAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        maxReminders: 2,
        reminderInterval: 24,
      },
    });
  }

  await prisma.whatsAppMessage.createMany({
    data: [
      { shopId: shop.id, orderId: pending?.id, recipientPhoneNumber: "+40722123456", messageText: "Confirmă comanda #1042", deliveryStatus: "delivered", sentAt: new Date(Date.now() - 45 * 60 * 1000) },
      { shopId: shop.id, orderId: pending?.id, recipientPhoneNumber: "+40722123456", messageText: "Reminder pentru comanda #1042", deliveryStatus: "read", sentAt: new Date(Date.now() - 20 * 60 * 1000) },
    ],
  });

  await prisma.analyticsEvent.createMany({
    data: [
      { shopId: shop.id, orderId: pending?.id, eventType: "message_sent", eventData: JSON.stringify({ template: template.templateName }) },
      { shopId: shop.id, orderId: pending?.id, eventType: "order_confirmed", eventData: JSON.stringify({ source: "whatsapp_button" }), occurredAt: new Date(Date.now() - 2 * 60 * 60 * 1000) },
      { shopId: shop.id, eventType: "message_delivered", eventData: JSON.stringify({ status: "delivered" }), occurredAt: new Date(Date.now() - 60 * 60 * 1000) },
    ],
  });
}

main().finally(() => prisma.$disconnect());
