import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";

import { tanstackStart } from "@tanstack/react-start/plugin/vite";

import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

import { cloudflare } from "@cloudflare/vite-plugin";

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [devtools({
    consolePiping: {
      enabled: false,
    },
  }), tailwindcss(), tanstackStart(), viteReact(), cloudflare({
    viteEnvironment: {
      name: "ssr"
    }
  })],
  server: {
    proxy: {
      "^/api/v1/static": {
        target: "https://eu-assets.i.posthog.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/v1/, ""),
        secure: false,
      },
      "^/api/v1/array": {
        target: "https://eu-assets.i.posthog.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/v1/, ""),
        secure: false,
      },
      "^/api/v1": {
        target: "https://eu.i.posthog.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/v1/, ""),
        secure: false,
      },
    },
  },
});

export default config;