import prisma from "../db.server";
import { buildTemplateParameters, sendWhatsAppMessage } from "./whatsapp.server";

export async function processDueReminders(shopId?: string) {
  const reminders = await prisma.reminder.findMany({
    where: { status: "active", nextReminderAt: { lte: new Date() }, ...(shopId ? { shopId } : {}) },
    include: { order: true },
    take: 100,
  });
  const results = { processed: 0, completed: 0, failed: 0 };

  for (const reminder of reminders) {
    results.processed += 1;
    if (reminder.order.confirmationStatus !== "pending" || reminder.remindersSent >= reminder.maxReminders) {
      await prisma.reminder.update({ where: { id: reminder.id }, data: { status: reminder.order.confirmationStatus === "pending" ? "completed" : "cancelled", cancelledReason: reminder.order.confirmationStatus === "pending" ? undefined : "order_resolved" } });
      if (reminder.order.confirmationStatus === "pending") results.completed += 1;
      continue;
    }
    try {
      const body = `Reminder: confirmă comanda ${reminder.order.orderNumber}`;
      const templateParameters = await buildTemplateParameters(reminder.shopId, [reminder.order.customerName || "Client", reminder.order.orderNumber, "Confirmo", "Produse comandate", `${reminder.order.totalAmount} ${reminder.order.currency}`]);
      const sent = await sendWhatsAppMessage({ shopId: reminder.shopId, orderId: reminder.orderId, phone: reminder.order.customerPhone ?? "", body, templateParameters });
      const sentAt = new Date();
      await prisma.$transaction([
        prisma.whatsAppMessage.create({ data: { shopId: reminder.shopId, orderId: reminder.orderId, messageText: body, recipientPhoneNumber: sent.phone.normalized, providerMessageId: sent.providerMessageId, deliveryStatus: sent.deliveryStatus, sentAt } }),
        prisma.reminder.update({ where: { id: reminder.id }, data: { remindersSent: { increment: 1 }, lastReminderAt: sentAt, nextReminderAt: new Date(sentAt.getTime() + reminder.reminderInterval * 60 * 60 * 1000), status: reminder.remindersSent + 1 >= reminder.maxReminders ? "completed" : "active" } }),
        prisma.analyticsEvent.create({ data: { shopId: reminder.shopId, orderId: reminder.orderId, eventType: "reminder_sent", eventData: JSON.stringify({ attempt: reminder.remindersSent + 1 }) } }),
      ]);
      if (reminder.remindersSent + 1 >= reminder.maxReminders) results.completed += 1;
    } catch (error) {
      results.failed += 1;
      await prisma.analyticsEvent.create({ data: { shopId: reminder.shopId, orderId: reminder.orderId, eventType: "reminder_failed", eventData: JSON.stringify({ error: error instanceof Error ? error.message : "unknown" }) } });
    }
  }
  return results;
}
