import { createRoot } from "react-dom/client";
import App from "./App.tsx";
// FE의 글로벌 스타일(Tailwind base + 토큰 변수)을 그대로 재사용
import "@/index.css";

createRoot(document.getElementById("root")!).render(<App />);
