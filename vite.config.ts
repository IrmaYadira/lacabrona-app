import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import AutoImport from "unplugin-auto-import/vite";
import { compression, defineAlgorithm } from "vite-plugin-compression2";
import zlib from "zlib";
// import { readdyJsxRuntimeProxyPlugin } from "./vite.jsx-runtime-proxy";

const base = process.env.BASE_PATH || "/";
const isPreview = process.env.IS_PREVIEW ? true : false;
//const proxyPlugins = isPreview ? [readdyJsxRuntimeProxyPlugin()] : [];
// https://vite.dev/config/
export default defineConfig({
  define: {
    __BASE_PATH__: JSON.stringify(base),
    __IS_PREVIEW__: JSON.stringify(isPreview),
    __READDY_PROJECT_ID__: JSON.stringify(process.env.PROJECT_ID || ""),
    __READDY_VERSION_ID__: JSON.stringify(process.env.VERSION_ID || ""),
    __READDY_AI_DOMAIN__: JSON.stringify(process.env.READDY_AI_DOMAIN || ""),
  },
  plugins: [
    // ...proxyPlugins,
    react(),
    // CSS no-bloqueante: transforma los <link rel="stylesheet"> auto-inyectados por Vite
    // para que carguen con media="print" onload — no bloquean el renderizado inicial
    {
      name: 'non-blocking-css',
      enforce: 'post' as const,
      transformIndexHtml(html) {
        return html.replace(
          /<link rel="stylesheet"([^>]*?)>/g,
          (_full: string, attrs: string) => {
            if (attrs.includes('media="print"') || attrs.includes("media='print'")) return _full;
            return `<link rel="stylesheet"${attrs} media="print" onload="this.media='all'">`;
          },
        );
      },
    },
    AutoImport({
      imports: [
        {
          react: [
            ["default", "React"],
            "useState",
            "useEffect",
            "useContext",
            "useReducer",
            "useCallback",
            "useMemo",
            "useRef",
            "useImperativeHandle",
            "useLayoutEffect",
            "useDebugValue",
            "useDeferredValue",
            "useId",
            "useInsertionEffect",
            "useSyncExternalStore",
            "useTransition",
            "startTransition",
            "lazy",
            "memo",
            "forwardRef",
            "createContext",
            "createElement",
            "cloneElement",
            "isValidElement",
          ],
        },
        {
          "react-router-dom": [
            "useNavigate",
            "useLocation",
            "useParams",
            "useSearchParams",
            "Link",
            "NavLink",
            "Navigate",
            "Outlet",
          ],
        },
        // React i18n
        {
          "react-i18next": ["useTranslation", "Trans"],
        },
      ],
      dts: true,
    }),
    compression({
      threshold: 512,
      include: /\.(html|xml|css|json|js|mjs|cjs|svg|txt|webmanifest|ico)$/,
      algorithms: [
        defineAlgorithm("gzip", { level: 9 }),
        defineAlgorithm("brotliCompress", {
          params: {
            [zlib.constants.BROTLI_PARAM_QUALITY]: 11,
          },
        } as any),
      ],
      deleteOriginalAssets: false,
    }),
  ],
  base,
  build: {
    sourcemap: false,
    outDir: 'out',
    cssCodeSplit: false,
    chunkSizeWarningLimit: 500,
    target: 'es2022',
    modulePreload: {
      polyfill: false,
    },
    cssMinify: 'esbuild',
    reportCompressedSize: false,
    rollupOptions: {
      output: {
        compact: true,
        manualChunks: (id) => {
          // Vendor core: React + Router
          if (
            id.includes('node_modules/react') ||
            id.includes('node_modules/react-dom') ||
            id.includes('node_modules/react-router') ||
            id.includes('node_modules/scheduler')
          ) {
            return 'vendor';
          }
          // i18n
          if (
            id.includes('node_modules/i18next') ||
            id.includes('node_modules/react-i18next')
          ) {
            return 'i18n';
          }
          // Supabase — pesado pero no crítico para LCP
          if (id.includes('node_modules/@supabase')) {
            return 'supabase';
          }
          // Charts — solo en admin
          if (id.includes('node_modules/recharts') || id.includes('node_modules/d3')) {
            return 'charts';
          }
          // Firebase — solo en ciertas features
          if (id.includes('node_modules/firebase') || id.includes('node_modules/@firebase')) {
            return 'firebase';
          }
          // Stripe — solo en checkout
          if (id.includes('node_modules/@stripe')) {
            return 'stripe';
          }
          // QR code lib
          if (id.includes('node_modules/qrcode')) {
            return 'qrcode';
          }
          // Utils compartidos
          if (id.includes('node_modules/html2canvas')) {
            return 'utils';
          }
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 3000,
    host: "0.0.0.0",
  },
});