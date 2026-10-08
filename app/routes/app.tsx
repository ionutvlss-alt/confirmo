import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Link, Outlet, useLoaderData, useRouteError } from "react-router";
import { NavMenu } from "@shopify/app-bridge-react";
import { AppProvider as ShopifyAppProvider } from "@shopify/shopify-app-react-router/react";
import { boundary } from "@shopify/shopify-app-react-router/server";

import { getShopContext } from "../lib/tenant.server";
import { navGroups } from "../lib/constants";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { shop } = await getShopContext(request);
  return { apiKey: process.env.SHOPIFY_API_KEY || "", shop: shop.domain };
};

export default function AppLayout() {
  const { apiKey, shop } = useLoaderData<typeof loader>();

  return (
    <ShopifyAppProvider apiKey={apiKey} shop={shop}>
      <s-page>
        <NavMenu>
          {navGroups.flatMap((group, groupIndex) => group.items.map(([url, label], index) => (
            <Link key={url} to={url} rel={groupIndex === 0 && index === 0 ? "home" : undefined}>
              {label}
            </Link>
          )))}
        </NavMenu>
        <Outlet />
      </s-page>
    </ShopifyAppProvider>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (args) => boundary.headers(args);
