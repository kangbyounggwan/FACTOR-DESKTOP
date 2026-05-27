/**
 * factor-desktop 설정 feature — 데스크탑 셸 톤에 맞춘 자체 컴포넌트만 노출.
 *
 * data hooks / 섹션 leaf (ProfileSection, TeamSection, ApiConnectionsSection 등)
 * 는 FE `@/features/settings` 에서 직접 import — 본 barrel 은 데스크탑 자체
 * 컴포넌트만 모음. ApiConnectionsSection / AddApiConnectionDialog /
 * InvokeResultDialog / useApiCatalog / apiCatalogClient 는 anomaly-eye-monitor
 * 로 이동 (cross-app 공유 leaf, R7 apps→shared 만족).
 */

export { SettingsNavList } from "./SettingsNavList";
export { desktopMenuItems, type DesktopMenuSection } from "./desktopMenu";
