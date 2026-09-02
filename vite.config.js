import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],

  build: {
    rollupOptions: {
      input: {
        // Existing application pages — PRESERVED
        main: resolve(process.cwd(), "index.html"),
        cbt: resolve(process.cwd(), "cbt.html"),
        admin: resolve(process.cwd(), "admin.html"),
        finance: resolve(process.cwd(), "finance.html"),
        academic: resolve(process.cwd(), "academic.html"),

        // NoteBank Review Center — ADDED
        notebankReview: resolve(
          process.cwd(),
          "notebank-review.html"
        )
      }
    }
  }
});
