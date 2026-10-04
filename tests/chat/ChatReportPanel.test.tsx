import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import {
  DEFAULT_GRID, useSheetPanelStore, SheetConflictError,
  type ReportSheetEvent, type SheetTemplate,
} from "@/features/reports/designer/core";

const mocks = vi.hoisted(() => ({ apply: vi.fn(), undo: vi.fn(), toast: vi.fn(), invalidate: vi.fn() }));
vi.mock("simplebar-react", () => ({ default: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock("react-router-dom", () => ({ useNavigate: () => vi.fn() }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: null, error: null, isFetching: false, refetch: vi.fn() }),
  useQueryClient: () => ({ invalidateQueries: mocks.invalidate }),
}));
vi.mock("@/features/reports/designer/BlockHighlightOverlay", () => ({
  BlockHighlightOverlay: () => <div data-testid="designer-grid-overlay" />,
}));
vi.mock("@/features/reports/designer/SheetPreviewFrame", () => ({
  SheetPreviewFrame: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("@desktop/api/reports", () => ({
  saveReportSheet: mocks.apply,
  sheetApi: { applySheet: mocks.apply, applyOps: mocks.undo },
  REPORT_KEYS: { sheets: ["sheets"], sheet: () => [], sheetPreview: () => [] },
}));
vi.mock("@desktop/features/settings/sections/reports/useReports", () => ({
  useGenerateReport: () => ({ isPending: false, mutate: vi.fn() }),
  useReportRun: () => ({ data: null }),
}));
vi.mock("@desktop/lib/electron", () => ({ electron: { openExternal: vi.fn() } }));

import { ChatReportPanel } from "@desktop/features/reportpanel/ChatReportPanel";

const template = (id: string, version = 1, status: "draft" | "saved" = "draft"): SheetTemplate => ({
  id, version, status, name: id, visibility: "company",
  page: { size: "A4", orientation: "landscape" }, grid: DEFAULT_GRID,
  defaults: { period: { mode: "relative", days: 7 } }, blocks: [],
});
function openSheet(id: string, version = 1) {
  useSheetPanelStore.getState().setFromEvent({
    sheet_id: id, version, status: "draft", title: id, template: template(id, version),
    diff: null, preview: { mode: "sample", url: null, html: "<p>preview</p>" },
    budget: null, warnings: [], ops_applied: [],
  } as ReportSheetEvent);
}
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

beforeEach(() => {
  vi.clearAllMocks();
  useSheetPanelStore.getState().reset();
  openSheet("A");
});

describe("chat report save isolation", () => {
  it("shows editing feedback only while this sheet is being edited", () => {
    render(<ChatReportPanel onClose={() => {}} />);
    act(() => useSheetPanelStore.getState().beginEdit("A", "request-1"));
    expect(screen.getByRole("status")).toHaveTextContent("보고서 수정 중");
    expect(screen.getByRole("button", { name: "저장", exact: true })).toBeDisabled();
    act(() => useSheetPanelStore.getState().finishEdit("request-1"));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("undo sends the current version and refreshes the restored report", async () => {
    openSheet("A", 2);
    const diff = { from_version: 2, to_version: 3, added: [], removed: [], moved: [], rearranged: [],
      changed: [{ block_id: "$sheet", field: "defaults.hidden_sections", from: ["materials"], to: [] }], summary: "자재 복원" };
    mocks.undo.mockResolvedValue({ template: template("A", 3), version: 3, status: "draft", diff, warnings: [], applied: ["undo"] });
    render(<ChatReportPanel onClose={() => {}} />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "보고서 수정 되돌리기" })); });
    expect(mocks.undo).toHaveBeenCalledWith("A", [{ op: "undo", steps: 1 }], 2);
    expect(useSheetPanelStore.getState()).toMatchObject({ version: 3, dirty: true, previewHtml: null, previewUrl: null });
    expect(screen.getByText("자재 복원")).toBeInTheDocument();
  });

  it("a delayed undo does not overwrite another report", async () => {
    openSheet("A", 2);
    const pending = deferred<unknown>();
    mocks.undo.mockReturnValue(pending.promise);
    render(<ChatReportPanel onClose={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "보고서 수정 되돌리기" }));
    act(() => openSheet("B", 5));
    await act(async () => { pending.resolve({ template: template("A", 3), version: 3 }); });
    expect(useSheetPanelStore.getState()).toMatchObject({ sheetId: "B", version: 5 });
  });

  it("undo failure leaves the current report intact", async () => {
    openSheet("A", 2);
    mocks.undo.mockRejectedValue(new Error("unavailable"));
    render(<ChatReportPanel onClose={() => {}} />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "보고서 수정 되돌리기" })); });
    expect(useSheetPanelStore.getState()).toMatchObject({ sheetId: "A", version: 2 });
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "되돌리기 실패" }));
  });

  it("keeps the grid overlay for designer sheets", () => {
    render(<ChatReportPanel onClose={() => {}} />);
    expect(screen.getByTestId("designer-grid-overlay")).toBeInTheDocument();
  });

  it("does not draw a designer grid over monthly EIS report content", () => {
    useSheetPanelStore.getState().setTemplate({ ...template("A"), defaults: {
      period: { mode: "relative", days: 7 }, layout: "eis_executive",
    } });
    render(<ChatReportPanel onClose={() => {}} />);
    expect(screen.queryByTestId("designer-grid-overlay")).not.toBeInTheDocument();
  });
  it("labels saved historical content separately from invented sample numbers", () => {
    useSheetPanelStore.getState().setFromEvent({
      sheet_id: "A", version: 1, status: "draft", title: "A", template: {
        ...template("A"), blocks: [{ id: "summary", title: "Summary", source: { kind: "synth", ref: "summary" },
          params: {}, viz: { type: "text" }, pos: { x: 0, y: 0, w: 12, h: 8 }, content: "Verified 23 ea" }],
      }, diff: null, preview: { mode: "sample", html: "<p>Verified 23 ea</p>", url: null },
      budget: null, warnings: [], ops_applied: [],
    });
    render(<ChatReportPanel onClose={() => {}} />);
    expect(screen.getByRole("radio", { name: "저장 내용" })).toBeInTheDocument();
    expect(screen.getByText(/저장된 조회 내용 · 최신 데이터 재조회 없음/)).toBeInTheDocument();
    expect(screen.queryByText(/샘플 데이터 — 수치는 예시/)).not.toBeInTheDocument();
  });
  it("applies a successful save to the unchanged active sheet", async () => {
    const pending = deferred<SheetTemplate>();
    mocks.apply.mockReturnValue(pending.promise);
    render(<ChatReportPanel onClose={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "저장", exact: true }));
    await act(async () => { pending.resolve(template("A", 2, "saved")); });
    expect(mocks.apply).toHaveBeenCalledWith("A", 1);
    expect(useSheetPanelStore.getState()).toMatchObject({ sheetId: "A", version: 2, status: "saved", dirty: false });
    expect(mocks.invalidate).toHaveBeenCalled();
  });

  it("does not replace B with the delayed save result for A", async () => {
    const pending = deferred<SheetTemplate>();
    mocks.apply.mockReturnValue(pending.promise);
    render(<ChatReportPanel onClose={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "저장", exact: true }));
    act(() => openSheet("B", 3));
    await act(async () => { pending.resolve(template("A", 2, "saved")); });
    expect(useSheetPanelStore.getState()).toMatchObject({ sheetId: "B", version: 3, status: "draft", dirty: true });
  });

  it("does not mark a newer draft of the same sheet as saved", async () => {
    const pending = deferred<SheetTemplate>();
    mocks.apply.mockReturnValue(pending.promise);
    render(<ChatReportPanel onClose={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "저장", exact: true }));
    act(() => openSheet("A", 3));
    await act(async () => { pending.resolve(template("A", 2, "saved")); });
    expect(useSheetPanelStore.getState()).toMatchObject({ sheetId: "A", version: 3, status: "draft", dirty: true });
  });

  it("does not revive a sheet after starting a new conversation", async () => {
    const pending = deferred<SheetTemplate>();
    mocks.apply.mockReturnValue(pending.promise);
    render(<ChatReportPanel onClose={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "저장", exact: true }));
    act(() => useSheetPanelStore.getState().reset());
    await act(async () => { pending.resolve(template("A", 2, "saved")); });
    expect(useSheetPanelStore.getState().sheetId).toBeNull();
  });

  it("does not apply an old conflict template to another sheet", async () => {
    const pending = deferred<SheetTemplate>();
    mocks.apply.mockReturnValue(pending.promise);
    render(<ChatReportPanel onClose={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "저장", exact: true }));
    act(() => openSheet("B"));
    await act(async () => { pending.reject(new SheetConflictError({ current_version: 2, template: template("A", 2) })); });
    expect(useSheetPanelStore.getState()).toMatchObject({ sheetId: "B", version: 1, dirty: true });
  });
});
