import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: '0.0.0.0',   // يستمع على كل الـ interfaces (localhost + IP الشبكة)
    port: 8081,
    allowedHosts: true, // يقبل أي hostname (Tailscale / Cloudflare / localhost)
    hmr: {
      overlay: false,
    },
    proxy: {
      // كل طلبات /api تروح لـ Flask على نفس الجهاز port 5000
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));