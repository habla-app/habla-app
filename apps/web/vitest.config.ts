import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    globals: false,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Los integration tests tocan Prisma real → requieren DATABASE_URL
    // configurado. Por eso los aíslamos con un pool opcional.
    pool: "forks",
    testTimeout: 15_000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      "@habla/db": path.resolve(__dirname, "../../packages/db/src/index.ts"),
      "@habla/shared": path.resolve(
        __dirname,
        "../../packages/shared/src/index.ts",
      ),
    },
  },
});
