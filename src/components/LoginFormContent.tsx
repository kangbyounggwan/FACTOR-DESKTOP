/**
 * LoginFormContent — 데스크탑 로그인 모달/팝오버의 공유 폼.
 *
 * 사용처:
 * - DesktopAuthWidget (Popover, side="top")
 * - RequireAuthDialog (centered Dialog)
 *
 * UX:
 * - 상단 브랜드 아이콘 + 큰 타이틀 + 설명
 * - 비밀번호 show/hide 토글 (Eye/EyeOff)
 * - "비밀번호 잊음" 링크 (placeholder)
 * - Full-width primary 로그인 버튼
 * - "계정이 없으신가요? 회원가입" 텍스트 링크
 * - 에러 표시 (icon + text, destructive 톤)
 * - 로딩 중 버튼 disable + spinner
 * - Enter 키 자동 submit (form)
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  Loader2,
  AlertCircle,
  Eye,
  EyeOff,
  CheckCircle2,
} from "lucide-react";
import { useAuth } from "@/features/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Props {
  /** 헤더 타이틀 (default: "로그인") */
  title?: string;
  /** 헤더 설명 */
  description?: string;
  /** 모달 닫기 콜백 (성공/취소 시) */
  onClose?: () => void;
  /** 로그인 성공 후 실행 (예: navigate) */
  onSuccess?: () => void;
  /** 회원가입 클릭 시 호출 (default: navigate("/signup")) */
  onSignup?: () => void;
  /** Compact 모드 — 헤더 폰트 크기 줄임 (Popover용) */
  compact?: boolean;
  className?: string;
}

export function LoginFormContent({
  title = "로그인",
  description = "대화 기록과 개인화 기능을 사용하려면 로그인하세요.",
  onClose,
  onSuccess,
  onSignup,
  compact = false,
  className,
}: Props) {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError("이메일과 비밀번호를 입력하세요");
      return;
    }
    setSubmitting(true);
    setError(null);
    const { error: signInError } = await signIn(email.trim(), password);
    setSubmitting(false);

    if (signInError) {
      const msg = signInError.message.includes("Invalid login credentials")
        ? "이메일 또는 비밀번호가 올바르지 않습니다"
        : signInError.message;
      setError(msg);
      return;
    }

    // 짧은 성공 표시 후 닫기 (사용자에게 신호)
    setSuccess(true);
    setTimeout(() => {
      onClose?.();
      onSuccess?.();
    }, 400);
  };

  const handleSignupClick = () => {
    onClose?.();
    if (onSignup) onSignup();
    else navigate("/signup");
  };

  const handleForgotPassword = () => {
    toast({
      title: "비밀번호 재설정",
      description: "관리자에게 문의해 주세요. (자동 재설정 기능은 준비 중입니다)",
    });
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* 헤더 — 브랜드 아이콘 + 타이틀 + 설명 */}
      <div className="flex flex-col items-center text-center space-y-2 pb-1">
        <div
          className={cn(
            "flex items-center justify-center rounded-2xl bg-primary/10 border border-primary/20",
            compact ? "w-10 h-10" : "w-12 h-12",
          )}
        >
          <Activity
            className={cn("text-primary", compact ? "w-5 h-5" : "w-6 h-6")}
          />
        </div>
        <div className="space-y-1">
          <h3
            className={cn(
              "font-semibold text-foreground",
              compact ? "text-base" : "text-lg",
            )}
          >
            {title}
          </h3>
          <p className="ui-caption leading-relaxed max-w-[260px]">
            {description}
          </p>
        </div>
      </div>

      {/* 폼 */}
      <form onSubmit={handleSubmit} className="space-y-3">
        {/* 이메일 */}
        <div className="space-y-1.5">
          <Label htmlFor="login-email" className="text-xs font-medium">
            이메일
          </Label>
          <Input
            id="login-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            autoFocus
            disabled={submitting || success}
            className="h-10"
          />
        </div>

        {/* 비밀번호 + show/hide */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="login-password" className="text-xs font-medium">
              비밀번호
            </Label>
            <button
              type="button"
              onClick={handleForgotPassword}
              className="ui-micro hover:text-primary transition-colors"
            >
              비밀번호 잊음?
            </button>
          </div>
          <div className="relative">
            <Input
              id="login-password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              disabled={submitting || success}
              className="h-10 pr-9"
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              tabIndex={-1}
              className={cn(
                "absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 flex items-center justify-center rounded-md",
                "text-muted-foreground hover:text-foreground hover:bg-foreground/[0.06] transition-colors",
              )}
              aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 표시"}
            >
              {showPassword ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* 에러 메시지 */}
        {error && (
          <div className="flex items-start gap-2 px-2.5 py-2 rounded-md bg-destructive/10 border border-destructive/20">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-destructive" />
            <span className="text-xs text-destructive leading-relaxed">{error}</span>
          </div>
        )}

        {/* 제출 버튼 (full-width primary) */}
        <Button
          type="submit"
          className={cn(
            "w-full h-10 font-medium",
            success && "bg-success hover:bg-success/90",
          )}
          disabled={submitting || success}
        >
          {success ? (
            <>
              <CheckCircle2 className="w-4 h-4 mr-2" />
              로그인 성공
            </>
          ) : submitting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              로그인 중...
            </>
          ) : (
            "로그인"
          )}
        </Button>
      </form>

      {/* 하단 — 회원가입 안내 */}
      <div className="flex items-center justify-center gap-1.5 pt-1 text-xs">
        <span className="text-muted-foreground">계정이 없으신가요?</span>
        <button
          type="button"
          onClick={handleSignupClick}
          disabled={submitting || success}
          className="text-primary hover:text-primary/80 font-medium transition-colors disabled:opacity-50"
        >
          회원가입
        </button>
      </div>
    </div>
  );
}
