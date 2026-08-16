import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/** Алиас `@` тот же, что в tsconfig — иначе тесты не видят lib/. */
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  test: { include: ["test/**/*.test.ts"] },
});
