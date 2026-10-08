import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  base: "/",
  server: {
    allowedHosts: ["localhost", ".replit.dev", ".replit.app"],
    host: "0.0.0.0",
  },
  test: { include: ["tests/domain/**/*.test.ts"] },
} as Parameters<typeof defineConfig>[0]);
