import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // testes de emulador compartilham o mesmo banco: rodam em série
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
