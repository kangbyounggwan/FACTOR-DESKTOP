/**
 * Team section — desktop own. v0.0.52 design language.
 *
 * 디자인:
 *   · 헤더 + 4-up stats strip (전체 / 활성 / 대기 / 관리자)
 *   · 필터 바: 검색 input + "팀원 초대" 버튼 (right)
 *   · 표: Linear 톤. avatar+name+email mono / role dot / status dot / 담당 / 가입일
 *   · 모달은 그대로 shadcn Dialog 재사용 — 폼만 톤 통일
 */
import { memo, useMemo, useState } from "react";
import { Loader2, Mail, Search, UserPlus, X } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { type UserRole, roleConfig } from "@/features/settings";

interface TeamMember {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  role_info: { name: string; display_name: string } | null;
  status: string;
  equipmentCount: number;
  created_at: string;
}

interface Props {
  teamMembers: TeamMember[];
  isLoading: boolean;
  department: string;
  onInvite: (email: string, role: UserRole) => void;
  isInviting: boolean;
}

const ROLE_DOT: Record<UserRole, string> = {
  admin: "bg-purple-400",
  manager: "bg-sky-400",
  operator: "bg-emerald-400",
  viewer: "bg-foreground/40",
};

export const TeamSectionDesktop = memo(function TeamSectionDesktop({
  teamMembers,
  isLoading,
  department,
  onInvite,
  isInviting,
}: Props) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>("operator");
  const [search, setSearch] = useState("");

  const stats = useMemo(() => {
    return {
      total: teamMembers.length,
      active: teamMembers.filter((m) => m.status === "active").length,
      pending: teamMembers.filter((m) => m.status !== "active").length,
      admin: teamMembers.filter(
        (m) => (m.role_info?.name?.toLowerCase() || "viewer") === "admin",
      ).length,
    };
  }, [teamMembers]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return teamMembers;
    return teamMembers.filter(
      (m) =>
        (m.full_name || "").toLowerCase().includes(q) ||
        (m.email || "").toLowerCase().includes(q),
    );
  }, [teamMembers, search]);

  const formatDate = (s: string) => {
    try {
      return new Date(s).toLocaleDateString("ko-KR");
    } catch {
      return s;
    }
  };

  const handleInvite = () => {
    if (!email) return;
    onInvite(email, role);
    setEmail("");
    setOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* ── 헤더 ── */}
      <header className="space-y-4">
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <h2 className="ui-h2">
              팀 관리
            </h2>
            <p className="ui-caption mt-1 leading-relaxed">
              팀원 권한과 담당 설비. 소속 부서:{" "}
              <span className="text-foreground/80 font-medium">
                {department || "미설정"}
              </span>
              .{" "}
              <span className="text-foreground/55">
                부서 변경은 관리자에게 문의
              </span>
              .
            </p>
          </div>
        </div>

        {/* stats strip */}
        <div className="grid grid-cols-4 gap-px bg-border/30 rounded-lg overflow-hidden border border-border/40">
          <Stat label="전체" value={stats.total} />
          <Stat label="활성" value={stats.active} tint="text-emerald-300" />
          <Stat label="대기" value={stats.pending} tint="text-amber-300" />
          <Stat label="관리자" value={stats.admin} tint="text-purple-300" />
        </div>
      </header>

      {/* ── 필터 바 ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[280px] max-w-[480px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/70" />
          <Input
            placeholder="이름 또는 이메일 검색…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-9 h-9 text-xs bg-foreground/[0.03] border-border/50 focus-visible:bg-foreground/[0.05]"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground"
              aria-label="검색 초기화"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs text-foreground/45 font-mono tabular-nums">
            {filtered.length}
            <span className="text-foreground/30 mx-1">/</span>
            {stats.total}
          </span>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-9 px-3 ui-fs-xs">
                <UserPlus className="h-3.5 w-3.5 mr-1.5" />
                팀원 초대
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>팀원 초대</DialogTitle>
                <DialogDescription>
                  가입된 사용자를 이메일로 초대합니다.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <Label className="ui-fs-xs text-foreground/85 font-medium tracking-tight">
                    이메일 주소
                  </Label>
                  <Input
                    type="email"
                    placeholder="email@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-9 ui-fs-xs font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="ui-fs-xs text-foreground/85 font-medium tracking-tight">
                    권한
                  </Label>
                  <Select
                    value={role}
                    onValueChange={(v) => setRole(v as UserRole)}
                  >
                    <SelectTrigger className="h-9 ui-fs-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(["viewer", "operator", "manager", "admin"] as const).map(
                        (r) => (
                          <SelectItem key={r} value={r}>
                            <div className="flex items-center gap-2">
                              <span
                                className={cn(
                                  "h-1.5 w-1.5 rounded-full",
                                  ROLE_DOT[r],
                                )}
                              />
                              {roleConfig[r].label}
                            </div>
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  취소
                </Button>
                <Button onClick={handleInvite} disabled={isInviting}>
                  {isInviting ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <Mail className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  초대 발송
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* ── 표 ── */}
      {isLoading ? (
        <SkeletonRows />
      ) : filtered.length === 0 ? (
        <EmptyState search={search} />
      ) : (
        <div className="rounded-lg bg-foreground/[0.025] border border-border/40 overflow-hidden">
          <table className="w-full text-sm border-collapse table-fixed">
            <colgroup>
              <col />
              <col className="w-[120px]" />
              <col className="w-[100px]" />
              <col className="w-[100px]" />
              <col className="w-[110px]" />
            </colgroup>
            <thead>
              <tr className="border-b border-border/40">
                <ColHeader>팀원</ColHeader>
                <ColHeader>권한</ColHeader>
                <ColHeader>상태</ColHeader>
                <ColHeader align="center">담당 설비</ColHeader>
                <ColHeader>가입일</ColHeader>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => {
                const rn = (m.role_info?.name?.toLowerCase() ||
                  "viewer") as UserRole;
                return (
                  <tr
                    key={m.id}
                    className="border-b border-border/30 last:border-b-0 hover:bg-foreground/[0.02] transition-colors"
                  >
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar className="h-8 w-8 flex-shrink-0 ring-1 ring-border/40">
                          <AvatarImage src={m.avatar_url || ""} />
                          <AvatarFallback className="ui-fs-xs bg-foreground/[0.06] text-foreground/75 font-medium">
                            {(m.full_name || "??").slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="ui-fs-xs text-foreground font-medium tracking-tight truncate">
                            {m.full_name || "이름 없음"}
                          </div>
                          <div className="ui-fs-xs font-mono text-foreground/55 truncate">
                            {m.email || "—"}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={cn(
                            "h-1.5 w-1.5 rounded-full",
                            ROLE_DOT[rn],
                          )}
                        />
                        <span className="ui-fs-xs text-foreground/80">
                          {m.role_info?.display_name ||
                            roleConfig[rn]?.label ||
                            "—"}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      {m.status === "active" ? (
                        <div className="flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_0_3px_rgba(52,211,153,0.15)]" />
                          <span className="ui-fs-xs text-emerald-300">
                            활성
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                          <span className="ui-fs-xs text-amber-300">
                            대기중
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <span className="font-mono tabular-nums text-xs text-foreground/85">
                        {m.equipmentCount}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 ui-fs-xs font-mono tabular-nums text-foreground/55">
                      {formatDate(m.created_at)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
});

// ── Sub-components ───────────────────────────────────────────────────────

function Stat({
  label,
  value,
  tint,
}: {
  label: string;
  value: number;
  tint?: string;
}) {
  return (
    <div className="bg-foreground/[0.025] px-4 py-3">
      <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground/65 font-medium">
        {label}
      </div>
      <div className="mt-1.5">
        <span
          className={cn(
            "ui-fs-xl font-semibold tabular-nums leading-none tracking-tight",
            tint ?? "text-foreground",
          )}
        >
          {value}
        </span>
      </div>
    </div>
  );
}

function ColHeader({
  children,
  align,
}: {
  children: React.ReactNode;
  align?: "left" | "center";
}) {
  return (
    <th
      className={cn(
        "px-4 py-2 text-xs uppercase tracking-[0.14em] text-muted-foreground/65 font-medium",
        align === "center" ? "text-center" : "text-left",
      )}
    >
      {children}
    </th>
  );
}

function SkeletonRows() {
  return (
    <div className="rounded-lg bg-foreground/[0.025] border border-border/40 overflow-hidden">
      <div className="divide-y divide-border/30">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3 animate-pulse">
            <div className="h-8 w-8 rounded-full bg-foreground/[0.06]" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 w-32 bg-foreground/[0.06] rounded" />
              <div className="h-2.5 w-40 bg-foreground/[0.04] rounded" />
            </div>
            <div className="h-3 w-16 bg-foreground/[0.05] rounded" />
            <div className="h-3 w-12 bg-foreground/[0.05] rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyState({ search }: { search: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border/50 bg-foreground/[0.015] px-6 py-12 text-center">
      <p className="text-xs text-foreground/65">
        {search ? "검색 결과가 없습니다." : "팀원이 없습니다."}
      </p>
      <p className="ui-micro text-muted-foreground/60 mt-1">
        {search
          ? "다른 이름 또는 이메일로 검색해 보세요."
          : "우측 상단에서 팀원을 초대해 보세요."}
      </p>
    </div>
  );
}
