import { defineConfig } from "vitest/config";
import tailwindcss from "@tailwindcss/vite";
export default defineConfig({
  plugins: [tailwindcss()],
  server: { port: 5173, strictPort: true },
  test: { environment: "jsdom", setupFiles: ["./tests/setup.ts"] },
});
