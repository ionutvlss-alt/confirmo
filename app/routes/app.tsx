import type {
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";

import {
  Link,
  Outlet,
  useLoaderData,
  useRouteError,
} from "react-router";

import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { boundary } from "@shopify/shopify-app-react-router/server";

import { getShopContext } from "../lib/tenant.server";
import { navGroups } from "../lib/constants";

export const loader = async ({
  request,
}: LoaderFunctionArgs) => {
  await getShopContext(request);

  return {
    apiKey: process.env.SHOPIFY_API_KEY || "",
  };
};

export default function AppLayout() {
  const { apiKey } = useLoaderData<typeof loader>();

  return (
    <AppProvider embedded apiKey={apiKey}>
      <div className="confirmo-appbar">
        <div className="confirmo-brand"><span className="confirmo-brand-mark">C</span><span>Confirmo</span></div>
        <nav className="confirmo-main-nav" aria-label="Navigare aplicație">
          {navGroups.flatMap((group) => group.items.map(([url, label]) => (
            <Link key={url} to={url.replace(/^\/app\/?/, "") || "."}>{label}</Link>
          )))}
        </nav>
        <Link className="confirmo-settings-link" to="settings">Setări</Link>
      </div>
      <Outlet />
    </AppProvider>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (args) => {
  return boundary.headers(args);
};
