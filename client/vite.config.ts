import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import wgsl from "@vgpu/wgsl/loader-vite";

export default defineConfig({
  envDir: "..",
  plugins: [react(), wgsl()],
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:9200",
        rewrite: path => path.replace(/^\/api/, ""),
      },
    },
  },
});
