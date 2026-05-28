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
import { equipmentList } from "@/data/mockData";
import SimpleBar from "simplebar-react";
import "simplebar-react/dist/simplebar.min.css";
import { useAuth } from "@/features/auth";
import { useToast } from "@/hooks/use-toast";

import {
  SettingsNavList,
  type DesktopMenuSection,
} from "@desktop/features/settings";
import { DataSchedulesSection } from "@desktop/features/data-schedules";

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
  ProfileSection,
  TeamSection,
  AssignedEquipmentSection,
  NotificationsSection,
  ApiConnectionsSection,
} from "@/features/settings";

export default function SettingsPage() {
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

  const [activeSection, setActiveSection] = useState<DesktopMenuSection>("profile");
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

  return (
    <div className="h-full w-full min-h-0 flex flex-col bg-background">
      {/* 상단 헤더 — Claude 의 "← 설정" 라인. 데스크탑 TopBar 에 이미 back 버튼이
          있으므로 여기는 타이틀만 표시 (중복 방지). */}
      <header className="flex-shrink-0 px-6 py-3.5 border-b border-border/40">
        <h1 className="text-[15px] font-medium text-foreground">설정</h1>
      </header>

      {/* 본문: nav + content. 카드 wrap 없음 (Claude 모티브). */}
      <div className="flex-1 flex min-h-0">
        <SettingsNavList
          activeSection={activeSection}
          onSectionChange={setActiveSection}
        />

        <main className="flex-1 min-w-0">
          <SimpleBar className="h-full">
            <div className="px-10 py-8 mx-auto max-w-[860px]">
              {/* leaf 컴포넌트들이 각자 h2 + description 을 그림 —
                  좌측 nav 의 활성 항목이 컨텍스트 주므로 별도 SectionHeader 중복 X. */}
              <div>
                {activeSection === "profile" && (
                  <ProfileSection
                    displayProfile={displayProfile}
                    editedProfile={editedProfile}
                    onEditedProfileChange={setEditedProfile}
                    onSave={handleSaveProfile}
                    isSaving={updateProfileMutation.isPending}
                    isLoading={profileLoading}
                  />
                )}

                {activeSection === "team" && (
                  <TeamSection
                    teamMembers={teamMembers}
                    isLoading={teamLoading}
                    department={displayProfile.department}
                    onInvite={handleInvite}
                    isInviting={inviteTeamMemberMutation.isPending}
                  />
                )}

                {activeSection === "equipment" && (
                  <AssignedEquipmentSection
                    equipmentList={equipmentList}
                    assignedEquipmentIds={assignedEquipmentIds}
                    selectedLine={selectedLine}
                    lineOptions={lineOptions}
                    onLineChange={setSelectedLine}
                    onToggleEquipment={handleToggleEquipment}
                  />
                )}

                {activeSection === "notifications" && (
                  <NotificationsSection
                    notifications={notifications}
                    onToggle={handleNotificationToggle}
                  />
                )}

                {activeSection === "api" && <ApiConnectionsSection />}

                {activeSection === "data-schedules" && <DataSchedulesSection />}
              </div>
            </div>
          </SimpleBar>
        </main>
      </div>
    </div>
  );
}

