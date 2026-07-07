/**
 * factor-desktop SettingsPage — Claude 데스크탑 설정 모티브.
 *
 * 변천:
 *   v1 (init): FE SettingsSidebar + 카드 wrap. 직사각형 컬럼이 셸과 충돌.
 *   v2 (2026-05): rounded-2xl 카드로 한 번 감쌌으나, 여전히 카드 안에 카드가
 *                 중첩되며 잡스럽다는 피드백.
 *   v3 (현재):    Claude 설정 톤 — 카드 wrap 제거. 상단에 헤더 바("설정"),
 *                 좌측은 텍스트-only nav (그룹 헤더), 우측은 카드 없는 폼.
 *
 * 구조:
 *   ┌─ header bar ("설정") ─────────────────────────────────┐
 *   │                                                       │
 *   │  ┌─ nav ─┐ ┌─ section content ─────────────────────┐  │
 *   │  │ 내 정보 │ │  큰 제목                              │  │
 *   │  │ 팀 관리 │ │  설명                                  │  │
 *   │  │       │ │  ─────────────────────────────────    │  │
 *   │  │ 운영   │ │  label · description    [control]    │  │
 *   │  │ ...   │ │  ...                                  │  │
 *   │  └───────┘ └───────────────────────────────────────┘  │
 *   └───────────────────────────────────────────────────────┘
 *
 * leaf 섹션 컴포넌트(`ProfileSection` 등) 는 FE shared — 카드 wrap 이
 * 들어 있어 v3 톤에 약간 무겁지만, 분기 prop 금지(R5) 라 그대로 호스팅.
 * 차후 데스크탑 자체 `ProfileSectionDesktop` 등으로 점진 교체 가능.
 */

import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import SimpleBar from "simplebar-react";
import "simplebar-react/dist/simplebar.min.css";
import { ArrowLeft } from "lucide-react";

import { equipmentList } from "@/data/mockData";
import { useAuth } from "@/features/auth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

import {
  SettingsNavList,
  type DesktopMenuSection,
  desktopMenuItems,
  GeneralSectionDesktop,
  ProfileSectionDesktop,
  TeamSectionDesktop,
  AssignedEquipmentSectionDesktop,
  NotificationsSectionDesktop,
} from "@desktop/features/settings";
import { ApiConnectionsContainer } from "@desktop/features/api-catalog";

// FE 의 leaf hook / type / config 만 import — 페이지 / 섹션 컴포넌트는 데스크탑 자체 사용 (R6).
import {
  type EditedProfile,
  type DisplayProfile,
  type NotificationSettings,
  type UserRole,
  defaultNotifications,
  useProfileWithRelations,
  useUpdateProfile,
  useTeamMembers,
  useInviteTeamMember,
  useNotificationSettings,
  useToggleNotification,
  useAssignedEquipments,
  useToggleAssignedEquipment,
} from "@/features/settings";

export default function SettingsPage() {
  const navigate = useNavigate();
  const { profile: authProfile } = useAuth();
  const { toast } = useToast();

  const { data: profileData, isLoading: profileLoading } = useProfileWithRelations();
  const updateProfileMutation = useUpdateProfile();
  const { data: teamMembers = [], isLoading: teamLoading } = useTeamMembers();
  const inviteTeamMemberMutation = useInviteTeamMember();
  const { data: notificationSettings } = useNotificationSettings();
  const toggleNotificationMutation = useToggleNotification();
  const { data: assignedEquipmentIds = [] } = useAssignedEquipments();
  const toggleAssignedEquipmentMutation = useToggleAssignedEquipment();

  const [activeSection, setActiveSection] = useState<DesktopMenuSection>("general");
  const [editedProfile, setEditedProfile] = useState<EditedProfile>({
    full_name: "",
    email: "",
    phone: "",
    job_title: "",
  });
  const [selectedLine, setSelectedLine] = useState<string>("all");

  const lineOptions = useMemo(
    () => [...new Set(equipmentList.map((eq) => eq.location))],
    [],
  );

  const notifications: NotificationSettings = notificationSettings || defaultNotifications;

  useEffect(() => {
    if (profileData) {
      setEditedProfile({
        full_name: profileData.full_name || "",
        email: profileData.email || "",
        phone: profileData.phone || "",
        job_title: profileData.job_title || "",
      });
    } else if (authProfile) {
      setEditedProfile({
        full_name: authProfile.full_name || "",
        email: authProfile.email || "",
        phone: authProfile.phone || "",
        job_title: authProfile.job_title || "",
      });
    }
  }, [profileData, authProfile]);

  const profile = profileData || authProfile;
  const displayProfile: DisplayProfile = profile
    ? {
        name: editedProfile.full_name || profile.full_name || "",
        email: editedProfile.email || profile.email || "",
        phone: editedProfile.phone || profile.phone || "",
        role: profile.role_info?.name || "viewer",
        roleLabel: profile.role_info?.display_name || "열람자",
        job_title: editedProfile.job_title || profile.job_title || "",
        department: profile.department_info?.name || "",
        avatar_url: profile.avatar_url || "",
        created_at: profile.created_at || new Date().toISOString(),
        company_name: profile.company?.name,
        factory_name: profile.factory?.name,
      }
    : {
        name: editedProfile.full_name,
        email: editedProfile.email,
        phone: editedProfile.phone,
        role: "viewer",
        roleLabel: "열람자",
        job_title: editedProfile.job_title,
        department: "",
        avatar_url: "",
        created_at: new Date().toISOString(),
        company_name: undefined,
        factory_name: undefined,
      };

  const handleSaveProfile = () => {
    updateProfileMutation.mutate(
      {
        full_name: editedProfile.full_name,
        phone: editedProfile.phone,
        job_title: editedProfile.job_title,
      },
      {
        onSuccess: () => {
          toast({ title: "저장 완료", description: "프로필이 성공적으로 업데이트되었습니다." });
        },
        onError: (error) => {
          toast({ title: "저장 실패", description: error.message, variant: "destructive" });
        },
      },
    );
  };

  const handleInvite = (email: string, role: UserRole) => {
    inviteTeamMemberMutation.mutate(
      { email, role },
      {
        onSuccess: () => {
          toast({ title: "초대 완료", description: `${email}님에게 초대를 발송했습니다.` });
        },
        onError: (error) => {
          toast({ title: "초대 실패", description: error.message, variant: "destructive" });
        },
      },
    );
  };

  const handleToggleEquipment = (equipmentId: string) => {
    const isCurrentlyAssigned = assignedEquipmentIds.includes(equipmentId);
    toggleAssignedEquipmentMutation.mutate({
      equipmentId,
      assigned: !isCurrentlyAssigned,
    });
  };

  const handleNotificationToggle = (key: keyof NotificationSettings, value: boolean) => {
    toggleNotificationMutation.mutate({ key, value });
  };

  const activeLabel =
    desktopMenuItems.find((m) => m.id === activeSection)?.label ?? null;
  const handleBack = () => navigate(-1);

  // Esc 키 — 뒤로. 설정 페이지는 별도 modal 이 없으니 esc 전역 hijack 해도 안전.
  // (각 section 내부 Dialog 는 Radix 가 stopPropagation 처리.)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleBack();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 폼 콘텐츠 — api 가 아닌 case 의 본문. 별도 변수로 빼서 SimpleBar wrap 처리.
  const formContent = (
    <>
      {activeSection === "general" && <GeneralSectionDesktop />}
      {activeSection === "profile" && (
        <ProfileSectionDesktop
          displayProfile={displayProfile}
          editedProfile={editedProfile}
          onEditedProfileChange={setEditedProfile}
          onSave={handleSaveProfile}
          isSaving={updateProfileMutation.isPending}
          isLoading={profileLoading}
        />
      )}
      {activeSection === "team" && (
        <TeamSectionDesktop
          teamMembers={teamMembers}
          isLoading={teamLoading}
          department={displayProfile.department}
          onInvite={handleInvite}
          isInviting={inviteTeamMemberMutation.isPending}
        />
      )}
      {activeSection === "equipment" && (
        <AssignedEquipmentSectionDesktop
          equipmentList={equipmentList}
          assignedEquipmentIds={assignedEquipmentIds}
          selectedLine={selectedLine}
          lineOptions={lineOptions}
          onLineChange={setSelectedLine}
          onToggleEquipment={handleToggleEquipment}
        />
      )}
      {activeSection === "notifications" && (
        <NotificationsSectionDesktop
          notifications={notifications}
          onToggle={handleNotificationToggle}
        />
      )}
    </>
  );

  return (
    <div className="h-full w-full min-h-0 flex flex-col bg-background">
      {/* ── 상단 헤더 — border-b 전체 폭 / 텍스트 wrapper 는 nav 와 같은 정렬 ──
          header 의 border-b 는 화면 전체 폭을 유지 ("공간 확보는 그대로") 하되,
          back + "설정 / 활성라벨" 텍스트는 본문 wrapper(max-w-[1500px] mx-auto)
          와 같은 x-position 에서 시작 → 콘텐츠 정렬과 일치. */}
      <header className="flex-shrink-0 border-b border-border/40">
        <div className="w-full max-w-[1500px] mx-auto flex items-center gap-3 pl-3 pr-6 py-2.5">
          <button
            type="button"
            onClick={handleBack}
            title="뒤로 (Esc)"
            aria-label="뒤로가기"
            className={cn(
              "h-8 w-8 flex items-center justify-center rounded-md flex-shrink-0",
              "text-muted-foreground hover:text-foreground hover:bg-foreground/[0.06]",
              "transition-colors",
            )}
          >
            <ArrowLeft className="h-4 w-4" />
          </button>

          <div className="flex items-baseline gap-2 min-w-0">
            <h1 className="text-[17px] font-semibold tracking-tight text-foreground">
              설정
            </h1>
            {activeLabel && (
              <>
                <span className="text-foreground/25 text-[12px]">/</span>
                <span className="text-[11.5px] text-foreground/65 font-medium tracking-tight truncate">
                  {activeLabel}
                </span>
              </>
            )}
          </div>

          {/* 우측 — 빈 공간 (향후 global save / search 등). */}
          <div className="ml-auto" />
        </div>
      </header>

      {/* ── 본문: nav + main. wrapper max-w-[1500px] mx-auto. ── */}
      <div className="flex-1 flex min-h-0 w-full max-w-[1500px] mx-auto">
        <SettingsNavList
          activeSection={activeSection}
          onSectionChange={setActiveSection}
        />

        <main className="flex-1 min-w-0 min-h-0">
          {activeSection === "api" ? (
            <div className="h-full px-6 py-8">
              <ApiConnectionsContainer />
            </div>
          ) : (
            <SimpleBar className="h-full">
              <div className="px-10 py-8 mx-auto max-w-[860px]">
                {formContent}
              </div>
            </SimpleBar>
          )}
        </main>
      </div>
    </div>
  );
}

