/**
 * OntologyPage (/ontology) — S4: 온톨로지 플러그인 다운로드/설치/뷰어 진입 페이지.
 *
 * 데스크탑 자체 페이지 (R1/R6 — 조립만). 본문은 features/app 의 OntologyPackCatalog.
 */
import { OntologyPackCatalog } from "@desktop/features/app";

export default function OntologyPage() {
  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
      <OntologyPackCatalog />
    </div>
  );
}
