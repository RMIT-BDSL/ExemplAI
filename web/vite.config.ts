import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";

import { tanstackStart } from "@tanstack/react-start/plugin/vite";

import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

import { cloudflare } from "@cloudflare/vite-plugin";

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    devtools({
      consolePiping: {
        enabled: false,
      },
    }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
    !process.env.VITEST &&
      cloudflare({
        viteEnvironment: {
          name: "ssr",
        },
      }),
  ].filter(Boolean),

});

export default config;