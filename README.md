# Confirmo

Confirmo is a Shopify embedded app starter for WhatsApp order confirmations. This repository contains a local, runnable MVP built with the official Shopify React Router app package, Prisma and a tenant-scoped operational data model.

## Included in this MVP

- Embedded Shopify app layout with App Bridge navigation.
- Prisma/SQLite session storage and first-party models for shops, orders, confirmations, reminders, messages, templates, analytics and webhooks.
- Demo mode with seeded orders and a local sandbox.
- Shopify Admin GraphQL order sync when a real Shopify session is available.
- Shopify app-specific webhook routes for install lifecycle, order sync and mandatory privacy events.
- WhatsApp Cloud API adapter with encrypted-at-rest token storage, phone normalization, Meta webhook signature validation and demo mode.
- Dashboard, orders, order detail, message history, reminders, analytics, templates, WhatsApp settings, shop settings, setup guide, sandbox and plans pages.

## Run the demo

```powershell
$env:npm_config_cache = Join-Path (Get-Location) '.npm-cache'
npm install
npm run setup
npm run build
npm run start
```

The checked-in `.env` uses `DEMO_MODE=true`, so no Shopify or Meta credentials are needed for the local preview.

## Connect a Shopify development store

1. Install the Shopify CLI and authenticate with a Partner organization.
2. Create or link the app with `shopify app config link`.
3. Copy the app credentials into `.env` and set `DEMO_MODE=false`.
4. Run `npm run setup`, then `npm run dev` so Shopify CLI provides the HTTPS tunnel and updates app URLs.
5. Verify that the configured app URL and webhook URLs use the tunnel or production HTTPS URL.

The current app requests only `read_orders,read_customers`. Revisit scopes before requesting any write permission.

## Connect WhatsApp Cloud API

Configure either the per-shop settings page or server-side environment variables:

- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_BUSINESS_ACCOUNT_ID`
- `WHATSAPP_APP_SECRET`
- `WHATSAPP_VERIFY_TOKEN`
- `WHATSAPP_GRAPH_VERSION`

Point Meta's webhook verification and delivery URL to `/webhooks/whatsapp`. First-contact outbound messages must use a Meta-approved template.

## Background reminders

POST `/api/jobs/reminders` with `Authorization: Bearer $CRON_SECRET` from a scheduler. In demo mode the endpoint is intentionally open for local testing.

## Production gaps before App Store submission

- Replace the starter privacy policy and terms with reviewed legal documents.
- Use a managed production database and a queue/worker for reminders and webhook processing.
- Add automated tests, observability, retry/dead-letter handling and export/delete workflows.
- Configure Shopify Partner app credentials, production HTTPS, privacy webhooks and support contact details.
- Decide and explicitly implement Shopify billing; the Plans page is currently informational only.
- Validate the final WhatsApp template, consent, opt-out and data retention policy with legal/compliance review.
