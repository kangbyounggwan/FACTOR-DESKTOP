/**
 * useResizablePanel — 우측 aside 폭 드래그 리사이즈 + localStorage 영속.
 *
 * ChatPage 의 웹 패널(ChatWebView) 드래그 로직을 그대로 추출해 웹 패널 · 보고서 패널이 공용으로 쓴다.
 *   - 핸들은 aside 의 **좌측 경계** — mousemove 마다 `window.innerWidth - e.clientX` 가 새 폭.
 *   - [min, max] 로 클램프 후 저장. 드래그 중 body cursor/userSelect 고정, mouseup 에 해제.
 *   - `clamp` 미지정이면 기존 웹 패널 동작과 바이트 동일(뷰포트 클램프 없음).
 *   - `clamp` 지정 시(보고서 패널): 드래그 중 + 마운트 시 + 창 리사이즈/의존값 변화 시 재적용 —
 *     예) `w => Math.min(w, innerWidth − sidebarWidth − CHAT_MIN)` 으로 채팅 컬럼 최소 폭을 지킨다.
 *     clamp 결과가 min 보다 작으면 min 이 이긴다(패널 최소 폭이 하드 플로어).
 *
 * `dragging` 은 호스트가 드래그 중 `<webview>`/`<iframe>` 위에 투명 오버레이를 띄워
 * 마우스 이벤트가 임베드 콘텐츠에 삼켜지지 않게 하는 데 쓴다(AppPage 의 AiPanelResizeHandle 과 같은 수법).
 */
import { useCallback, useEffect, useRef, useState } from "react";

export interface ResizablePanel {
  width: number;
  /** 프로그램적으로 폭 지정(클램프 적용) */
  setWidth: (width: number) => void;
  /** 드래그 핸들의 onMouseDown */
  onDragStart: () => void;
  /** 드래그 진행 중 */
  dragging: boolean;
}

export function useResizablePanel(
  storageKey: string,
  min: number,
  max: number,
  defaultWidth: number,
  clamp?: (next: number) => number,
): ResizablePanel {
  // 호출 순서: clamp(뷰포트 등 동적 상한) → [min, max]. min 이 하드 플로어.
  const bound = useCallback(
    (raw: number) => {
      const clamped = clamp ? clamp(raw) : raw;
      return Math.min(max, Math.max(min, clamped));
    },
    [min, max, clamp],
  );

  // 저장값 복원 — 기존 웹 패널과 동일하게 [min, max] 안이면 그대로, 아니면 기본값
  const [width, setWidthState] = useState(() => {
    const saved = Number(localStorage.getItem(storageKey));
    return saved >= min && saved <= max ? saved : defaultWidth;
  });

  useEffect(() => {
    localStorage.setItem(storageKey, String(width));
  }, [storageKey, width]);

  // 뷰포트 클램프 — clamp 가 있을 때만. 마운트 · 창 리사이즈 · clamp 의존값(사이드바 폭 등) 변화에 재적용
  useEffect(() => {
    if (!clamp) return;
    const apply = () => setWidthState((w) => bound(w));
    apply();
    window.addEventListener("resize", apply);
    return () => window.removeEventListener("resize", apply);
  }, [clamp, bound]);

  const draggingRef = useRef(false);
  const [dragging, setDragging] = useState(false);

  const onDragStart = useCallback(() => {
    draggingRef.current = true;
    setDragging(true);
    const onMove = (e: MouseEvent) => {
      if (!draggingRef.current) return;
      const next = window.innerWidth - e.clientX;
      setWidthState(bound(next));
    };
    const onUp = () => {
      draggingRef.current = false;
      setDragging(false);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, [bound]);

  const setWidth = useCallback((w: number) => setWidthState(bound(w)), [bound]);

  return { width, setWidth, onDragStart, dragging };
}
