import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import { processDueReminders } from "../lib/reminders.server";

function authorized(request: Request) {
  return process.env.DEMO_MODE === "true" || request.headers.get("authorization") === `Bearer ${process.env.CRON_SECRET}`;
}

export const loader = async ({ request }: LoaderFunctionArgs) => { if (!authorized(request)) return new Response("Unauthorized", { status: 401 }); return Response.json({ ok: true, hint: "POST to process due reminders" }); };
export const action = async ({ request }: ActionFunctionArgs) => { if (!authorized(request)) return new Response("Unauthorized", { status: 401 }); return Response.json({ ok: true, ...(await processDueReminders()) }); };
