import path from "node:path";

// Reuse the shared frontend's installed test runtime without adding desktop dependencies.
const shared = path.resolve(__dirname, "../anomaly-eye-monitor");
export default {
  esbuild: { jsx: "automatic" },
  server: { fs: { allow: [__dirname, shared] } },
  resolve: {
    alias: {
      "@": path.join(shared, "src"),
      "@desktop": path.resolve(__dirname, "src"),
      react: path.join(shared, "node_modules/react"),
      "react-dom": path.join(shared, "node_modules/react-dom"),
      vitest: path.join(shared, "node_modules/vitest"),
      "@testing-library/react": path.join(shared, "node_modules/@testing-library/react"),
      "@testing-library/jest-dom": path.join(shared, "node_modules/@testing-library/jest-dom"),
      "@tanstack/react-query": path.join(shared, "node_modules/@tanstack/react-query"),
    },
    dedupe: ["react", "react-dom"],
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/chat/setup.ts"],
    include: ["tests/chat/**/*.test.tsx"],
  },
};
