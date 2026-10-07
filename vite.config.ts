import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";

const configuredRoot = process.env.CONFIRMO_BUILD_ROOT || process.cwd();

export default defineConfig({
  root: configuredRoot,
  server: { fs: { allow: ["app", "node_modules"] } },
  plugins: [reactRouter()],
  build: { assetsInlineLimit: 0 },
});
