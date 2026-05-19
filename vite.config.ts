import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

/**
 * factor-desktop vite 설정.
 *
 * - `@/*`     → ../anomaly-eye-monitor/src/* (FE shared 소스)
 * - `@desktop/*` → ./src/*                  (factor-desktop 전용 소스)
 *
 * FE 소스 파일들이 자체적으로 `@/...`를 쓰므로 alias 그대로 작동.
 * factor-desktop의 own 코드는 `@desktop/...`를 통해 자신을 참조.
 */
export default defineConfig(() => ({
  base: "./",
  server: {
    host: "::",
    port: 5180,
    strictPort: true,
    hmr: {
      overlay: false,
    },
    // FE 소스를 watch + serve할 수 있도록 허용
    fs: {
      allow: [
        path.resolve(__dirname, "."),
        path.resolve(__dirname, "../anomaly-eye-monitor"),
      ],
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "../anomaly-eye-monitor/src"),
      "@desktop": path.resolve(__dirname, "./src"),
      // React를 factor-desktop의 node_modules 단일 인스턴스로 강제
      // (FE 소스가 import한 react가 anomaly-eye-monitor/node_modules에서 별도 로드되는
      //  "Invalid hook call: two React copies" 회피)
      react: path.resolve(__dirname, "node_modules/react"),
      "react-dom": path.resolve(__dirname, "node_modules/react-dom"),
    },
    // Context-기반 라이브러리는 모두 단일 인스턴스로 dedupe 필요
    dedupe: [
      "react",
      "react-dom",
      "react-router",
      "react-router-dom",
      "@tanstack/react-query",
      "@tanstack/query-core",
    ],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id: string) => {
          if (id.includes(".css")) return;
          if (id.includes("node_modules")) {
            if (id.includes("three")) return "three";
            if (id.includes("@react-three")) return "react-three";
          }
        },
      },
    },
  },
}));
