import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { DEFAULT_GRID, useSheetPanelStore, type SheetTemplate } from "@/features/reports/designer/core";

const mocks = vi.hoisted(() => ({ getConv: vi.fn(), getSheet: vi.fn(), preview: vi.fn(), stream: vi.fn() }));
vi.mock("@/features/auth/context/AuthContext", () => ({
  useAuth: () => ({ user: { id: "u1" }, profile: null }),
}));
vi.mock("@/api/chat", () => ({ getConversationV2: mocks.getConv, streamChatV2: mocks.stream }));
vi.mock("simplebar-react", () => ({ default: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock("react-router-dom", () => ({ useNavigate: () => vi.fn() }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/features/reports/designer/BlockHighlightOverlay", () => ({ BlockHighlightOverlay: () => null }));
vi.mock("@desktop/api/reports", () => ({
  saveReportSheet: vi.fn(),
  sheetApi: { getSheet: mocks.getSheet, previewSheet: mocks.preview },
  REPORT_KEYS: {
    sheets: ["reports", "sheets"],
    sheet: (id: string, version: number) => ["reports", "sheet", id, version],
    sheetPreview: (id: string, version: number, mode: string) => ["reports", "preview", id, version, mode],
  },
}));
vi.mock("@desktop/features/settings/sections/reports/useReports", () => ({
  useGenerateReport: () => ({ isPending: false, mutate: vi.fn() }),
  useReportRun: () => ({ data: null }),
}));
vi.mock("@desktop/lib/electron", () => ({ electron: { openExternal: vi.fn() } }));

import { useAIChat } from "@/features/monitoring/hooks/useAIChat";
import { ChatReportPanel } from "@desktop/features/reportpanel/ChatReportPanel";

const pointer = (id = "A", version = 1) => ({ sheet_id: id, version, status: "saved" as const, title: `Report ${id}` });
const template = (id = "A", version = 1): SheetTemplate => ({
  id, version, status: "saved", name: `Report ${id}`, visibility: "private",
  page: { size: "A4", orientation: "portrait" }, grid: DEFAULT_GRID, defaults: {},
  blocks: [{ id: "summary", title: "Research", source: { kind: "synth", ref: "summary" },
    params: {}, viz: { type: "text" }, pos: { x: 0, y: 0, w: 12, h: 8 }, content: `Saved research ${id}` }],
});
const conversation = (id = "cA", report: unknown = pointer()) => ({
  id, user_id: "u1", company_id: "co", plant_uid: null,
  messages: [{ role: "user", content: "Report" }, { role: "assistant", content: "Created", state: report }],
  final_answer: { text: "Created", state: report }, stage_traces: [], intent: null,
  created_at: "2026-10-03T00:00:00Z", updated_at: "2026-10-03T00:00:00Z",
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((yes) => { resolve = yes; });
  return { promise, resolve };
}
function Host() {
  const chat = useAIChat({ onOpenReportPanel: () => useSheetPanelStore.getState().setOpen(true) });
  const open = useSheetPanelStore((s) => s.open);
  return <>
    <button onClick={() => void chat.loadConversation("cA")}>Load A</button>
    <button onClick={() => void chat.loadConversation("cB")}>Load B</button>
    <button onClick={() => void chat.loadConversation("empty")}>Load empty</button>
    <button onClick={() => chat.startNewConversation()}>New</button>
    <output data-testid="conversation">{chat.conversationId}</output>
    {open && <ChatReportPanel onClose={() => useSheetPanelStore.getState().close()} />}
  </>;
}
function mount(client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })) {
  render(<QueryClientProvider client={client}><Host /></QueryClientProvider>);
  return client;
}
const body = () => screen.getByTestId("sheet-preview-frame").querySelector("iframe")?.getAttribute("srcdoc") ?? null;

beforeEach(() => {
  vi.resetAllMocks();
  useSheetPanelStore.getState().reset();
  mocks.getConv.mockImplementation(async (id: string) => id === "empty"
    ? conversation(id, null) : conversation(id, pointer(id === "cB" ? "B" : "A")));
  mocks.getSheet.mockImplementation(async (id: string) => template(id));
  mocks.preview.mockImplementation(async (id: string) => ({ html: `<p>Saved research ${id}</p>`, budget: null }));
});

describe("conversation report content restoration", () => {
  it("opens the report automatically and waits for its saved content before previewing", async () => {
    const saved = deferred<SheetTemplate>();
    mocks.getSheet.mockReturnValue(saved.promise);
    mount();
    fireEvent.click(screen.getByText("Load A"));
    await waitFor(() => expect(mocks.getSheet).toHaveBeenCalledWith("A"));
    expect(screen.getByTestId("chat-report-panel")).toBeInTheDocument();
    expect(mocks.preview).not.toHaveBeenCalled();
    await act(async () => saved.resolve(template()));
    await waitFor(() => expect(body()).toContain("Saved research A"));
    expect(useSheetPanelStore.getState().template?.blocks[0].content).toBe("Saved research A");
    expect(mocks.preview).toHaveBeenCalledTimes(1);
    expect(mocks.stream).not.toHaveBeenCalled();
  });

  it("restores the previous report when the final response is an ordinary answer", async () => {
    const row = conversation();
    mocks.getConv.mockResolvedValue({ ...row, final_answer: { text: "No alarms" }, messages: [
      ...row.messages, { role: "user", content: "Alarms" }, { role: "assistant", content: "No alarms" },
    ] });
    mount();
    fireEvent.click(screen.getByText("Load A"));
    await waitFor(() => expect(body()).toContain("Saved research A"));
  });

  it("does not replace B with A's delayed report content", async () => {
    const savedA = deferred<SheetTemplate>();
    mocks.getSheet.mockImplementation((id: string) => id === "A" ? savedA.promise : Promise.resolve(template("B")));
    mount();
    fireEvent.click(screen.getByText("Load A"));
    await waitFor(() => expect(mocks.getSheet).toHaveBeenCalledWith("A"));
    fireEvent.click(screen.getByText("Load B"));
    await waitFor(() => expect(body()).toContain("Saved research B"));
    await act(async () => savedA.resolve(template("A")));
    expect(body()).toContain("Saved research B");
    expect(useSheetPanelStore.getState().template?.id).toBe("B");
  });

  it("clears the panel for conversations without a report and for a new conversation", async () => {
    mocks.getConv.mockImplementation(async (id: string) => id === "empty"
      ? { ...conversation(id), messages: [], final_answer: { text: "Empty" } } : conversation());
    mount();
    fireEvent.click(screen.getByText("Load A"));
    await waitFor(() => expect(body()).toContain("Saved research A"));
    fireEvent.click(screen.getByText("Load empty"));
    await waitFor(() => expect(screen.queryByTestId("chat-report-panel")).not.toBeInTheDocument());
    expect(useSheetPanelStore.getState().sheetId).toBeNull();
    fireEvent.click(screen.getByText("Load A"));
    await waitFor(() => expect(body()).toContain("Saved research A"));
    fireEvent.click(screen.getByText("New"));
    expect(screen.queryByTestId("chat-report-panel")).not.toBeInTheDocument();
  });

  it("loads the server's current saved version before rendering, instead of stale query cache", async () => {
    const saved = deferred<SheetTemplate>();
    mocks.getSheet.mockReturnValue(saved.promise);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
    client.setQueryData(["reports", "sheet", "A", 1, null], template("A", 1));
    client.setQueryData(["reports", "preview", "A", 1, "sample", "post", null], { html: "Stale preview" });
    mount(client);
    fireEvent.click(screen.getByText("Load A"));
    await waitFor(() => expect(mocks.getSheet).toHaveBeenCalled());
    expect(body()).toBeNull();
    expect(mocks.preview).not.toHaveBeenCalled();
    await act(async () => saved.resolve(template("A", 3)));
    await waitFor(() => expect(body()).toContain("Saved research A"));
    expect(useSheetPanelStore.getState().version).toBe(3);
    expect(mocks.preview).toHaveBeenCalledTimes(1);
  });

  it("shows a missing report error and can retry without reviving another report", async () => {
    mocks.getSheet.mockRejectedValueOnce(new Error("HTTP 404: report not found"));
    mount();
    fireEvent.click(screen.getByText("Load A"));
    await screen.findByText("HTTP 404: report not found");
    expect(mocks.preview).not.toHaveBeenCalled();
    expect(body()).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    await waitFor(() => expect(body()).toContain("Saved research A"));
  });

  it("reloads the same conversation's content without briefly showing its cached preview", async () => {
    mount(new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } }));
    fireEvent.click(screen.getByText("Load A"));
    await waitFor(() => expect(body()).toContain("Saved research A"));
    const fresh = deferred<{ html: string; budget: null }>();
    mocks.preview.mockReturnValueOnce(fresh.promise);
    fireEvent.click(screen.getByText("Load A"));
    await waitFor(() => expect(mocks.preview).toHaveBeenCalledTimes(2));
    expect(mocks.getSheet).toHaveBeenCalledTimes(2);
    expect(body()).toBeNull();
    await act(async () => fresh.resolve({ html: "<p>Reloaded saved content A</p>", budget: null }));
    await waitFor(() => expect(body()).toContain("Reloaded saved content A"));
    expect(mocks.stream).not.toHaveBeenCalled();
  });
});
