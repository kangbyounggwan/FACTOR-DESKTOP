import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_GRID, useSheetPanelStore, type SheetTemplate } from "@/features/reports/designer/core";

const mocks = vi.hoisted(() => ({ format: vi.fn(), bind: vi.fn(), choices: vi.fn(),
  missions: vi.fn(), apply: vi.fn(), getSheet: vi.fn(), toast: vi.fn() }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock("@desktop/api/reports", () => ({
  sheetApi: { listSheets: mocks.choices, getSheet: mocks.getSheet },
  accountReportApi: { getFormat: mocks.format, setFormat: mocks.bind,
    contentMissions: mocks.missions, addContentMission: mocks.apply },
}));
import { AccountReportTools } from "@desktop/features/reportpanel/AccountReportTools";

const template: SheetTemplate = { id: "draft", name: "Draft", version: 1, status: "draft", visibility: "private",
  page: { size: "A4", orientation: "portrait" }, grid: DEFAULT_GRID,
  defaults: { period: { mode: "relative", days: 7 } }, blocks: [] };
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((yes) => { resolve = yes; });
  return { promise, resolve };
}
function mount(scope = "c1:u1", conversation = "conv1") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const view = render(<QueryClientProvider client={client}>
    <AccountReportTools key={`${scope}:${conversation}`} accountScope={scope} conversationId={conversation} revision={2} />
  </QueryClientProvider>);
  return { ...view, client };
}
beforeEach(() => {
  vi.resetAllMocks();
  useSheetPanelStore.getState().reset();
  useSheetPanelStore.getState().setFromEvent({ sheet_id: "draft", version: 1, status: "draft", template,
    preview: { mode: "live", url: null, html: null }, warnings: [], ops_applied: [] });
  mocks.format.mockResolvedValue({ configured: false, reason: "unassigned" });
  mocks.choices.mockResolvedValue({ sheets: [{ id: "format1", name: "Saved format", status: "saved" }] });
  mocks.bind.mockResolvedValue({ configured: true, sheet_id: "format1", name: "Saved format", version: 1 });
  mocks.missions.mockResolvedValue({ items: [{ id: "rec1", topic: "utilization", label: "가동률", question: "가동률을 추가할까요?",
    excerpt: "가동률 71.4%", scope: "P41", source_label: "api/line_rates", as_of: "2026-10-01T10:00:00Z" }] });
  mocks.apply.mockResolvedValue({ template: { ...template, version: 2 }, sheet: { id: "draft", version: 2, status: "draft" },
    warnings: ["Historical content"], diff: null });
});
describe("account report tools", () => {
  it("offers a missing content mission without listing conversations or automatically adding", async () => {
    mount();
    expect(await screen.findByText(/EIS 임원용 기본 양식에 조사 내용을 반영/)).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "EIS 임원용 (기본)" })).toBeInTheDocument();
    expect(await screen.findByText("가동률을 추가할까요?")).toBeInTheDocument();
    expect(screen.getByText("가동률 71.4%")).toBeInTheDocument();
    expect(screen.queryByText("이전 대화 추천")).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(mocks.apply).not.toHaveBeenCalled();
    expect(mocks.bind).not.toHaveBeenCalled();
  });
  it("adds approved content to the same report and preserves the preview mode", async () => {
    mount();
    fireEvent.click(await screen.findByRole("button", { name: "가동률 추가" }));
    await waitFor(() => expect(mocks.apply).toHaveBeenCalledWith("draft", "conv1", "rec1", 1));
    await waitFor(() => expect(useSheetPanelStore.getState().sheetId).toBe("draft"));
    expect(useSheetPanelStore.getState()).toMatchObject({ version: 2, status: "draft", mode: "live", warnings: ["Historical content"],
      opsApplied: ["add_history_content"] });
  });
  it("binds a saved designer format only on explicit selection", async () => {
    mount();
    await screen.findByRole("option", { name: "Saved format" });
    fireEvent.change(screen.getByRole("combobox", { name: "계정 보고서 양식" }), { target: { value: "format1" } });
    await waitFor(() => expect(mocks.bind).toHaveBeenCalledWith("format1"));
    expect(screen.getByRole("button", { name: "현재 시트를 계정 양식으로 지정" })).toBeDisabled();
  });
  it("does not replace the new conversation with an old delayed draft", async () => {
    const pending = deferred<{ template: SheetTemplate; sheet: Partial<SheetTemplate>; warnings: string[] }>();
    mocks.apply.mockReturnValue(pending.promise);
    const view = mount();
    fireEvent.click(await screen.findByRole("button", { name: "가동률 추가" }));
    await waitFor(() => expect(mocks.apply).toHaveBeenCalled());
    view.unmount();
    useSheetPanelStore.getState().reset();
    mount("c2:u2", "conv2");
    await act(async () => pending.resolve({ template, sheet: {}, warnings: [] }));
    expect(useSheetPanelStore.getState().sheetId).toBeNull();
    expect(mocks.missions).not.toHaveBeenCalledWith("draft", "conv2");
  });
  it("dismisses a mission without altering the report", async () => {
    mount();
    fireEvent.click(await screen.findByRole("button", { name: "가동률 미션 닫기" }));
    expect(screen.queryByText("가동률을 추가할까요?")).not.toBeInTheDocument();
    expect(mocks.apply).not.toHaveBeenCalled();
    expect(useSheetPanelStore.getState().version).toBe(1);
  });
  it("does not offer content before there is a current report", async () => {
    useSheetPanelStore.getState().reset();
    mount();
    await screen.findByRole("option", { name: "Saved format" });
    expect(mocks.missions).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("보고서 콘텐츠 미션")).not.toBeInTheDocument();
  });
  it("does not replace a newer version with a delayed content addition", async () => {
    const pending = deferred<{ template: SheetTemplate; sheet: Partial<SheetTemplate>; warnings: string[]; diff: null }>();
    mocks.apply.mockReturnValue(pending.promise);
    mount();
    fireEvent.click(await screen.findByRole("button", { name: "가동률 추가" }));
    await waitFor(() => expect(mocks.apply).toHaveBeenCalled());
    act(() => useSheetPanelStore.getState().setTemplate({ ...template, version: 3 }));
    await act(async () => pending.resolve({ template: { ...template, version: 2 }, sheet: {}, warnings: [], diff: null }));
    expect(useSheetPanelStore.getState().version).toBe(3);
  });
  it("reloads a conflicting report instead of overwriting it", async () => {
    mocks.apply.mockRejectedValue(Object.assign(new Error("보고서가 변경되었습니다."), { status: 409 }));
    mocks.getSheet.mockResolvedValue({ ...template, version: 3 });
    mount();
    fireEvent.click(await screen.findByRole("button", { name: "가동률 추가" }));
    await waitFor(() => expect(useSheetPanelStore.getState().version).toBe(3));
    expect(mocks.getSheet).toHaveBeenCalledWith("draft");
  });
});
