import type {
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";

import {
  Outlet,
  useLoaderData,
  useRouteError,
} from "react-router";

import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { boundary } from "@shopify/shopify-app-react-router/server";

import { getShopContext } from "../lib/tenant.server";

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