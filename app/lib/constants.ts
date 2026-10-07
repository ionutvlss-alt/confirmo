export const DEMO_SHOP = "demo.myshopify.com";

export const isDemoMode = process.env.DEMO_MODE === "true" || !process.env.SHOPIFY_API_KEY;

export const navGroups = [
  {
    title: "Workspace",
    items: [
      ["/app", "Dashboard"],
      ["/app/orders", "Orders"],
      ["/app/messages", "Messages"],
      ["/app/reminders", "Reminders"],
      ["/app/analytics", "Analytics"],
    ],
  },
  {
    title: "Configuration",
    items: [
      ["/app/message-templates", "Message templates"],
      ["/app/whatsapp-settings", "WhatsApp settings"],
      ["/app/settings", "Shop settings"],
      ["/app/plans", "Plans"],
    ],
  },
  {
    title: "Resources",
    items: [
      ["/app/setup-guide", "Setup guide"],
      ["/app/sandbox", "Sandbox"],
    ],
  },
] as const;
