import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/sample-circuit.json": {
        target:
          "https://imrishabh18--motor-controller-sheild-v1-0-2.tscircuit.app",
        changeOrigin: true,
        rewrite: () => "/dist/index/circuit.json",
      },
    },
  },
  resolve: {
    alias: {
      lib: "/lib",
      tests: "/tests",
    },
  },
})
