import React from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import "@/index.css";
import { useSheetPanelStore, type ReportSheetEvent } from "@/features/reports/designer/core";
import { ChatReportPanel } from "@desktop/features/reportpanel/ChatReportPanel";

declare global {
  interface Window {
    reportVerification: { setEvent: (event: ReportSheetEvent) => void; beginEdit: () => void; getDefaults: () => unknown };
  }
}

window.reportVerification = {
  setEvent: (event) => useSheetPanelStore.getState().setFromEvent(event),
  beginEdit: () => useSheetPanelStore.getState().beginEdit("visual-eis", "visual-edit"),
  getDefaults: () => useSheetPanelStore.getState().template?.defaults,
};
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <MemoryRouter>
      <div style={{ height: "100vh", width: "100%" }}><ChatReportPanel onClose={() => {}} /></div>
    </MemoryRouter>
  </QueryClientProvider>,
);
