/**
 * factor-desktop SignupPage — 데스크탑 자체 회원가입 화면.
 *
 * FE 의 SignupPage 와 분리 (R1). 데스크탑은 현장 사용자용 — 회원가입은 본부에서
 * 초대 링크로만 처리하는 운영 정책이므로 간단한 안내 화면.
 *
 * 룰북: ../../../../CLAUDE.md § 코드 분리 룰북 (R1, R6).
 */

import { Link } from "react-router-dom";
import { Activity, ArrowLeft, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function SignupPage() {
  return (
    <div className="h-screen w-screen bg-background flex items-center justify-center p-6 overflow-hidden">
      <div
        className="absolute top-0 left-0 right-0 h-9"
        style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
      />
      <div className="w-full max-w-[420px] bg-card border border-border rounded-xl p-6 shadow-xl space-y-5">
        {/* 헤더 */}
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Activity className="w-6 h-6 text-primary" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-semibold text-foreground">회원가입</h3>
            <p className="ui-caption leading-relaxed max-w-[300px]">
              FACTOR 데스크탑 계정은 본부 관리자가 초대 링크로 발급합니다.
            </p>
          </div>
        </div>

        {/* 안내 */}
        <div className="rounded-lg bg-muted/40 border border-border/60 p-4 space-y-3 text-xs leading-relaxed">
          <div className="flex items-start gap-2.5">
            <Mail className="w-4 h-4 mt-0.5 flex-shrink-0 text-primary" />
            <div className="space-y-1">
              <div className="font-medium text-foreground">계정 발급 방법</div>
              <div className="text-muted-foreground">
                담당 관리자에게 사번 / 부서 / 이메일을 전달하면 초대 메일을 받습니다.
                메일의 링크를 따라 비밀번호를 설정하면 로그인 가능합니다.
              </div>
            </div>
          </div>
        </div>

        {/* 로그인으로 돌아가기 */}
        <Button asChild variant="outline" className="w-full">
          <Link to="/login">
            <ArrowLeft className="w-4 h-4 mr-2" />
            로그인으로 돌아가기
          </Link>
        </Button>
      </div>
    </div>
  );
}
