import { createRoot } from "react-dom/client";
import App from "./App.tsx";
// FE의 글로벌 스타일(Tailwind base + 토큰 변수)을 그대로 재사용
import "@/index.css";
// Section 03 — Sentry renderer init (React render 보다 먼저)
import { setupSentryRenderer } from "@desktop/lib/sentry-renderer";

setupSentryRenderer();

createRoot(document.getElementById("root")!).render(<App />);
