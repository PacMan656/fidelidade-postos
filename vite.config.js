import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  plugins: [react()],
  // em desenvolvimento, /api vai para o servidor de configuração (npm run server)
  server: { proxy: { "/api": "http://localhost:8787" } },
  // ARTIFACT=1 gera um único arquivo JS (usado só na prévia publicada)
  build: process.env.ARTIFACT ? { outDir: "dist-artifact", rollupOptions: { output: { inlineDynamicImports: true } } } : {},
});
