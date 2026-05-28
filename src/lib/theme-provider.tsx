/**
 * ThemeProvider — light / dark / system 3-way 테마 관리.
 *
 * - documentElement 에 `.dark` 클래스 토글 (Tailwind darkMode: ['class'])
 * - localStorage 영속 (`factor-theme`)
 * - "system" 선택 시 OS 의 prefers-color-scheme 추적
 * - 기본값: "dark" — 기존 사용자가 무중단 (light 자동 적용 X)
 *
 * 사용:
 *   <ThemeProvider><App /></ThemeProvider>
 *   const { theme, setTheme } = useTheme();
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type Theme = "light" | "dark" | "system";

const STORAGE_KEY = "factor-theme";
const DEFAULT_THEME: Theme = "dark";

interface ThemeContextValue {
  /** 사용자 선택 (light / dark / system) */
  theme: Theme;
  /** 실제 적용된 모드 (system → light or dark 로 resolve) */
  resolved: "light" | "dark";
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readStorage(): Theme {
  if (typeof window === "undefined") return DEFAULT_THEME;
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch {
    /* ignore */
  }
  return DEFAULT_THEME;
}

function systemPrefersDark(): boolean {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyDom(isDark: boolean): void {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", isDark);
  // Electron native chrome (titleBarOverlay) 색도 함께 변경.
  // window.electron 이 없으면 (브라우저) silent skip.
  try {
    const overlay = isDark
      ? { color: "#0a0d12", symbolColor: "#e5e7eb" }
      : { color: "#f5f6f7", symbolColor: "#222831" };
    window.electron?.theme?.setTitleBarOverlay?.(overlay);
  } catch {
    /* ignore */
  }
}

interface ProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ProviderProps) {
  const [theme, setThemeState] = useState<Theme>(() => readStorage());
  const [resolved, setResolved] = useState<"light" | "dark">(() => {
    const t = readStorage();
    if (t === "system") return systemPrefersDark() ? "dark" : "light";
    return t;
  });

  // theme 변경 → DOM 적용 + storage 저장 + system 모드면 OS 변경 추적
  useEffect(() => {
    const effective: "light" | "dark" =
      theme === "system" ? (systemPrefersDark() ? "dark" : "light") : theme;
    applyDom(effective === "dark");
    setResolved(effective);

    if (theme !== "system") return;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const isDark = mql.matches;
      applyDom(isDark);
      setResolved(isDark ? "dark" : "light");
    };
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
    setThemeState(next);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, resolved, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}
