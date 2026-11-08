import { runAction } from "@/shared/lib/async-errors";
import { useCallback, useEffect, useRef, useState } from "react";
import type { SavedDocument } from "../../../../foundation/documentSessionProtocol.ts";
import { PaginatedDocumentRenderer } from "../document-editor/rendering/PaginatedDocumentRenderer.tsx";
export function AgentRenderPage() {
  const jobId = new URLSearchParams(location.search).get("agentRender") ?? "";
  const [snapshot, setSnapshot] = useState<SavedDocument>();
  const [pass, setPass] = useState(0);
  const processing = useRef(false); const warnings = useRef(new Set<string>());
  useEffect(() => {
    for (const element of [document.documentElement, document.body, document.getElementById("root")]) {
      if (element) { element.style.height = "auto"; element.style.overflow = "visible"; }
    }
    runAction((window.agentRender.snapshot(jobId).then(setSnapshot)));
  }, [jobId]);
  const ready = useCallback(async () => {
    if (processing.current) return;
    processing.current = true;
    await document.fonts.ready;
    await Promise.all(Array.from(document.images).map(async (image) => {
      try { await image.decode(); }
      catch { warnings.current.add("일부 이미지를 불러오지 못했습니다."); }
    }));
    if (pass === 0) { processing.current = false; setPass(1); return; }
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    const elements = Array.from(document.querySelectorAll<HTMLElement>(".document-page-stack--print > .document-page"));
    if (elements.some((page) => page.dataset.documentPageOverflow)) warnings.current.add("페이지 높이를 초과하는 요소가 있습니다.");
    window.agentRender.ready(jobId, { pageCount: elements.length, pages: elements.map((page) => {
      const bounds = page.getBoundingClientRect();
      return { x: bounds.x + scrollX, y: bounds.y + scrollY, width: bounds.width, height: bounds.height };
    }), warnings: [...warnings.current] });
  }, [jobId, pass]);
  return snapshot ? <div className="bg-white"><PaginatedDocumentRenderer key={pass} document={snapshot.document} mode="print" onLayoutReady={() => { runAction((ready())); }} /></div> : null;
}
