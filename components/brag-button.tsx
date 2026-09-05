"use client";

import { useState } from "react";
import { buildBragImage } from "@/lib/brag-image";
import { trackShare } from "@/lib/analytics-client";
import { getClientId } from "@/lib/client-id";
import type { DrawNumbers, GeneratedSet, WinningSet } from "@/lib/types";

// 자랑하기 — 클릭 시 토큰과 당첨 세트를 서버에서 받아(착지 페이지와 같은 순서) 이미지 생성 → Web Share 시트
// (이미지 + text=링크만, url 필드 미사용:
// 안드로이드는 url 도 EXTRA_TEXT 로 합쳐지므로 동등하고, 둘 다 넣으면 링크가 중복 표기된다.
// 저장/공유 선택은 OS 시트가 제공 — 서비스에서 분기하지 않는다(사용자 확정 설계).
// Web Share 미지원(데스크탑 일부)은 이미지 다운로드 + 링크 클립보드 복사로 폴백.
export function BragButton({
  target,
  drawDate,
  draw,
  sets,
}: {
  target: number;
  drawDate: string;
  draw: DrawNumbers;
  sets: GeneratedSet[];
}) {
  const [state, setState] = useState<"idle" | "busy" | "copied" | "error">("idle");
  const wins = sets.filter((s) => (s.matched_rank ?? 0) >= 1);
  if (wins.length === 0) return null; // 낙첨 회차는 자랑 스킵(사용자 확정)

  const brag = async () => {
    if (state === "busy") return;
    setState("busy");
    try {
      // 1) 토큰 발급 + 당첨 세트(서버가 착지 페이지와 같은 순서로 준다 — 화면에 로드된 일부가 아니라 전건)
      // 2) 그 세트로 이미지 생성. 순차지만 fetch 뒤 캔버스는 수십 ms 라 share() 의 user-activation 창 안에 끝난다.
      const body = await fetch("/api/share", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ clientId: getClientId(), drawNo: target }),
      })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null);
      const token: string | null = typeof body?.token === "string" ? body.token : null;
      const serverSets: WinningSet[] = Array.isArray(body?.sets) ? body.sets : [];
      if (!token || serverSets.length === 0) {
        // 착지 페이지 없는 공유는 무의미 — 짧게 알리고 종료(레거시 회차 착지는 제거됨)
        setState("error");
        window.setTimeout(() => setState("idle"), 2500);
        return;
      }
      const blob = await buildBragImage({ target, drawDate, draw, sets: serverSets });
      const file = new File([blob], `lottogen-${target}-win.png`, { type: "image/png" });
      const link = `${window.location.origin}/share/${token}`;

      // 폴백: 이미지 저장 + 링크 복사 (Web Share 미지원, 또는 취소가 아닌 share 실패)
      const fallback = async () => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `lottogen-${target}-win.png`;
        a.click();
        URL.revokeObjectURL(url);
        try {
          await navigator.clipboard.writeText(link);
        } catch {
          // 클립보드 불가 — 이미지 저장만
        }
        trackShare("share_download", target);
        setState("copied");
        window.setTimeout(() => setState("idle"), 2500);
      };

      if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], text: link });
          trackShare("share", target); // 시트에서 대상 선택까지 완료된 경우만 resolve
          setState("idle");
        } catch (e) {
          if ((e as DOMException)?.name === "AbortError") {
            setState("idle"); // 사용자가 시트를 닫음 — 미집계·폴백 없음
          } else {
            await fallback(); // 지원 표방했지만 실패(일부 데스크탑 등) — 저장+복사로 구제
          }
        }
        return;
      }
      await fallback();
    } catch {
      setState("idle");
    }
  };

  return (
    <button
      type="button"
      onClick={brag}
      disabled={state === "busy"}
      className="shrink-0 whitespace-nowrap rounded-lg bg-amber-400 px-2.5 py-1 text-xs font-bold text-stone-900 transition hover:bg-amber-300 disabled:opacity-50"
    >
      {state === "copied"
        ? "이미지 저장 · 링크 복사됨"
        : state === "error"
          ? "잠시 후 다시 시도해주세요"
          : state === "busy"
            ? "만드는 중…"
            : "자랑하기"}
    </button>
  );
}
