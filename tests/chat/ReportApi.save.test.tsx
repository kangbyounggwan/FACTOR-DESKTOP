import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SheetConflictError } from "@/features/reports/designer/core";

vi.mock("@/lib/supabase", () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: { access_token: "test-token" } } }) } },
}));

import { saveReportSheet } from "@desktop/api/reports";

const fetchMock = vi.fn();
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock); });
afterEach(() => vi.unstubAllGlobals());

describe("versioned report save", () => {
  it("sends displayed version and preserves shared auth and response handling", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      sheet: { id: "sheet-A", version: 7, status: "saved" },
      template: { id: "sheet-A", version: 7, name: "Report", blocks: [] },
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    const saved = await saveReportSheet("sheet-A", 7);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/sheets\/sheet-A\/apply$/);
    expect(init.method).toBe("POST");
    expect(init.headers.get("If-Match")).toBe("7");
    expect(init.headers.get("Authorization")).toBe("Bearer test-token");
    expect(saved).toMatchObject({ id: "sheet-A", version: 7, status: "saved" });
  });

  it("retains typed version conflicts rather than marking another version saved", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ detail: {
      current_version: 8, template: { id: "sheet-A", version: 8, blocks: [] },
    } }), { status: 409, headers: { "Content-Type": "application/json" } }));
    await expect(saveReportSheet("sheet-A", 7)).rejects.toBeInstanceOf(SheetConflictError);
  });

  it.each([-1, NaN, 1.5])("does not send an invalid version %s", async (version) => {
    await expect(saveReportSheet("sheet-A", version)).rejects.toThrow("Invalid sheet version");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
