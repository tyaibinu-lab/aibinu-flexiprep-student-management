import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(process.cwd(), "index.html"),
        cbt: resolve(process.cwd(), "cbt.html"),
        admin: resolve(process.cwd(), "admin.html")
      }
    }
  }
});
