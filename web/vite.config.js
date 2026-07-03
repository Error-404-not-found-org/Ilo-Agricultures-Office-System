import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("lucide-react")) return "icons-vendor";
          if (id.includes("react-dom")) return "react-dom-vendor";
          if (id.includes("react-router")) return "router-vendor";
          if (id.includes("framer-motion")) return "motion-vendor";
          if (id.includes(`${path.sep}react${path.sep}`) || id.endsWith(`${path.sep}react${path.sep}index.js`)) {
            return "react-vendor";
          }
          if (id.includes("@clerk")) return "auth-vendor";
          if (id.includes("@tanstack")) return "query-vendor";
          if (id.includes("jspdf")) return "pdf-vendor";
          if (id.includes("html2canvas")) return "canvas-vendor";
          if (id.includes("xlsx")) return "spreadsheet-vendor";
          if (id.includes("leaflet") || id.includes("mapbox") || id.includes("chart")) {
            return "visualization-vendor";
          }
          return "vendor";
        },
      },
    },
  },
  resolve: {
    alias: {
      'react': path.resolve(__dirname, './node_modules/react'),
      'react-dom': path.resolve(__dirname, './node_modules/react-dom'),
      '@tanstack/react-query': path.resolve(__dirname, './node_modules/@tanstack/react-query'),
    }
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/test/setup.js",
  }
});
