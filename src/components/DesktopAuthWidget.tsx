/**
 * 데스크탑 EXE — 로그인/프로필 위젯.
 *
 * 두 가지 variant:
 * - floating (default): 좌측 하단 fixed 떠 있음 (legacy)
 * - inline: 사이드바 하단 행으로 들어감 — Claude Desktop 스타일
 *
 * 상태별 동작:
 * - 비로그인 → 트리거 클릭 시 **중앙 Dialog 모달**로 LoginFormContent 표시
 *   (RequireAuthDialog와 동일한 형식, 위치만 중앙)
 * - 로그인 → 트리거 클릭 시 **Popover**로 프로필 메뉴(설정·로그아웃) 표시
 *
 * 로그인 모달은 RequireAuthDialog를 직접 사용해 일관성 보장.
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { User, LogOut, Settings, Loader2, ChevronUp } from "lucide-react";
import { useAuth } from "@/features/auth";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { RequireAuthDialog } from "./RequireAuthDialog";

interface Props {
  /** inline=true면 사이드바 하단 행으로, false면 좌하단 floating */
  inline?: boolean;
}

export function DesktopAuthWidget({ inline = false }: Props = {}) {
  const { user, profile, isAuthenticated, isLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const [profileOpen, setProfileOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);

  // ⚠ 과거에는 `if (!isDesktop) return null` 로 window.electron 없으면 widget 자체를
  // 숨겼는데, (1) dev preview (브라우저, electron preload 없음) 에서 위젯이 통째로
  // 안 보이고 (2) EXE 에서도 preload 가 어떤 이유로 늦게 inject 되면 첫 렌더에서
  // 위젯이 사라지는 regression 발생. 본 widget 은 DesktopShell 에서만 mount 되고
  // (R6, factor-desktop 전용), 기능(login/signOut/navigate) 모두 Supabase useAuth
  // + react-router 만 의존 — electron API 없어도 정상 동작. 가드 제거 안전.

  const displayName =
    profile?.full_name || profile?.name || user?.email?.split("@")[0] || "사용자";
  const avatarUrl = profile?.avatar_url || null;

  const handleSignOut = async () => {
    await signOut();
    setProfileOpen(false);
  };

  // ─── 아바타 노드 (loading / authed / guest) ─────────────────
  const avatarNode = isLoading ? (
    <div className="flex items-center justify-center w-7 h-7 bg-muted rounded-full">
      <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
    </div>
  ) : isAuthenticated ? (
    avatarUrl ? (
      <img
        src={avatarUrl}
        alt="Profile"
        className="w-7 h-7 rounded-full object-cover border border-primary/30"
      />
    ) : (
      <div className="flex items-center justify-center w-7 h-7 bg-primary rounded-full">
        <User className="w-3.5 h-3.5 text-primary-foreground" />
      </div>
    )
  ) : (
    <div className="flex items-center justify-center w-7 h-7 bg-muted-foreground/15 rounded-full">
      <User className="w-3.5 h-3.5 text-muted-foreground" />
    </div>
  );

  // ─── 트리거 (inline vs floating) ────────────────────────────
  const triggerContent = inline ? (
    <>
      {avatarNode}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate text-foreground/85 group-hover:text-foreground transition-colors">
          {isAuthenticated ? displayName : "로그인"}
        </p>
        {!isAuthenticated && !isLoading && (
          <p className="ui-micro text-muted-foreground/70 group-hover:text-muted-foreground transition-colors">
            게스트 모드
          </p>
        )}
        {isAuthenticated && user?.email && (
          <p className="ui-micro text-muted-foreground/70 group-hover:text-muted-foreground truncate transition-colors">
            {user.email}
          </p>
        )}
      </div>
      <ChevronUp className="w-3.5 h-3.5 text-muted-foreground/50 group-hover:text-foreground transition-colors" />
    </>
  ) : (
    <>
      {avatarNode}
      <span className="text-xs font-medium pr-1">
        {isAuthenticated ? displayName : "로그인"}
      </span>
      {!isAuthenticated && !isLoading && (
        <Badge variant="secondary" className="ui-fs-xs h-5">
          게스트
        </Badge>
      )}
    </>
  );

  const triggerClassName = inline
    ? cn(
        "group w-full flex items-center gap-2 px-2.5 py-2 rounded-md",
        "transition-colors text-left",
        "hover:bg-foreground/[0.06]",
      )
    : "h-12 pl-1.5 pr-3 rounded-full shadow-lg border-2 border-border bg-card hover:bg-accent text-foreground gap-2 inline-flex items-center";

  const containerClassName = inline ? "w-full" : "fixed bottom-4 left-4 z-50";

  // ─── 비로그인 → 중앙 Dialog 모달 ─────────────────────────────
  if (!isAuthenticated && !isLoading) {
    return (
      <div className={containerClassName}>
        <button
          type="button"
          onClick={() => setLoginOpen(true)}
          className={triggerClassName}
        >
          {triggerContent}
        </button>
        <RequireAuthDialog
          open={loginOpen}
          onOpenChange={setLoginOpen}
          title="로그인"
          description="대화 기록과 개인화 기능을 사용하려면 로그인하세요."
        />
      </div>
    );
  }

  // ─── 로그인 / 로딩 → Popover 프로필 메뉴 ──────────────────────
  return (
    <div className={containerClassName}>
      <Popover open={profileOpen} onOpenChange={setProfileOpen}>
        <PopoverTrigger asChild>
          <button type="button" className={triggerClassName}>
            {triggerContent}
          </button>
        </PopoverTrigger>

        <PopoverContent
          side="top"
          align="start"
          className="w-72 p-0"
          sideOffset={8}
        >
          <div className="flex flex-col">
            <div className="p-4 border-b">
              <div className="flex items-center gap-3">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="Profile"
                    className="w-12 h-12 rounded-full object-cover border-2 border-primary"
                  />
                ) : (
                  <div className="flex items-center justify-center w-12 h-12 bg-primary rounded-full">
                    <User className="w-6 h-6 text-primary-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{displayName}</p>
                  <p className="ui-caption truncate">
                    {user?.email}
                  </p>
                </div>
              </div>
            </div>
            <div className="p-1.5">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-2"
                onClick={() => {
                  setProfileOpen(false);
                  navigate("/settings");
                }}
              >
                <Settings className="w-4 h-4" />
                설정
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-2 text-destructive hover:text-destructive"
                onClick={handleSignOut}
              >
                <LogOut className="w-4 h-4" />
                로그아웃
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
