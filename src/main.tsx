import { createRoot } from "react-dom/client";
import App from "./App.tsx";
// FE의 글로벌 스타일(Tailwind base + 토큰 변수)을 그대로 재사용
import "@/index.css";
// Section 03 — Sentry renderer init (React render 보다 먼저)
import { setupSentryRenderer } from "@desktop/lib/sentry-renderer";
import { ThemeProvider } from "@desktop/lib/theme-provider";
import { LoginOptionsProvider } from "@/features/auth";
import { DESKTOP_LOGIN_OPTIONS } from "@desktop/lib/desktopLoginOptions";

setupSentryRenderer();

// 첫 paint 전 .dark 클래스를 미리 토글해 light 모드 깜빡임 방지.
// (ThemeProvider 의 useEffect 가 mount 후 적용되므로 그 전에 default 강제.)
(function applyInitialTheme() {
  try {
    const stored = localStorage.getItem("factor-theme");
    const theme =
      stored === "light" || stored === "system" ? stored : "dark";
    const isDark =
      theme === "dark" ||
      (theme === "system" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", isDark);
  } catch {
    document.documentElement.classList.add("dark");
  }
})();

createRoot(document.getElementById("root")!).render(
  <ThemeProvider>
    {/* 로그인 화면의 보조 경로(재설정·가입) — 웹과의 차이는 이 데이터로만(R5, design.md §6.4) */}
    <LoginOptionsProvider value={DESKTOP_LOGIN_OPTIONS}>
      <App />
    </LoginOptionsProvider>
  </ThemeProvider>,
);
