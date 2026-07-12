/**
 * AppFavicon — URL/도메인의 favicon 을 단계적 fallback 으로 표시.
 *
 * 순서:
 *  1. primarySrc (props 로 넘긴 og:image / catalog icon_url 등)
 *  2. Google s2 favicons API
 *  3. DuckDuckGo favicon API
 *  4. icon.horse
 *  5. SVG globe 아이콘 (최종 fallback)
 *
 * 각 단계에서 img 로딩 실패(onError) 시 자동으로 다음 source 로 전환.
 * AppCard / UrlCard / TabBar 등에서 재사용.
 */

import { useMemo, useState } from "react";
import { Globe } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  /** 우선 시도할 src — catalog 의 icon_url 또는 자동 추출한 og:image. 없으면 곧바로 favicon API 로 fallback */
  primarySrc?: string | null;
  /** 도메인 — favicon API 호출에 사용 */
  host: string;
  /** 픽셀 크기 (실제 표시 크기). 기본 28 */
  size?: number;
  className?: string;
}

export function AppFavicon({ primarySrc, host, size = 28, className }: Props) {
  // 시도 순서 list (없거나 빈 src 는 미리 제거)
  const sources = useMemo(() => {
    const list: string[] = [];
    if (primarySrc) list.push(primarySrc);
    if (host) {
      list.push(`https://www.google.com/s2/favicons?domain=${host}&sz=128`);
      list.push(`https://icons.duckduckgo.com/ip3/${host}.ico`);
      list.push(`https://icon.horse/icon/${host}`);
    }
    return list;
  }, [primarySrc, host]);

  const [idx, setIdx] = useState(0);
  const src = sources[idx];

  // 모든 fallback 소진 → SVG globe
  if (!src) {
    return (
      <Globe
        className={cn("text-muted-foreground", className)}
        width={size * 0.72}
        height={size * 0.72}
      />
    );
  }

  return (
    <img
      key={src}
      src={src}
      alt=""
      width={size}
      height={size}
      className={cn("rounded", className)}
      style={{ width: size, height: size }}
      onError={() => setIdx((i) => i + 1)}
      // 캐시 노이즈 방지 — referrerPolicy
      referrerPolicy="no-referrer"
    />
  );
}
