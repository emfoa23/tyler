// 자랑하기 이미지 — 클라이언트 캔버스 생성(서버 인프라 0). 회차 당첨 결과를 카드로 그린다.
// 내용: 회차 헤더·등수 요약·당첨번호·당첨 세트(맞춘 번호 하이라이트)·워터마크(lottogen.click).
// 워터마크는 이미지-only 로 공유되는 지면(링크를 버리는 앱)에서 유일한 유입 경로다.
import { ballColor, drawNumbers, matchedNumbers, RANK_LABEL } from "@/lib/lotto";
import type { DrawNumbers, GeneratedSet } from "@/lib/types";

const W = 1080;
const PAD = 72;
const MAX_SETS = 5; // 카드가 길어지지 않게 표시 상한(초과분은 "+n세트")

const FONT = (weight: number, px: number) =>
  `${weight} ${px}px system-ui, -apple-system, "Apple SD Gothic Neo", sans-serif`;

/** 글리프 실측 기반 광학 정중앙 텍스트 — baseline "middle" 은 em 박스 기준이라 숫자가
 *  시각적 중심에서 어긋난다(사용자 실기기 제보). actualBoundingBox 로 정확히 가운데 놓는다. */
function centerText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  align: CanvasTextAlign = "center",
): void {
  ctx.textAlign = align;
  ctx.textBaseline = "alphabetic";
  const m = ctx.measureText(text);
  const asc = m.actualBoundingBoxAscent || 0;
  const desc = m.actualBoundingBoxDescent || 0;
  // 실측 불가 환경 폴백: em 근사(대략 0.35em 상승분)
  const dy = asc || desc ? (asc - desc) / 2 : 0.35 * parseInt(ctx.font, 10);
  // 수평도 advance 폭이 아니라 잉크 bbox 로 보정(center 정렬일 때만 의미)
  const dx = align === "center" ? ((m.actualBoundingBoxLeft || 0) - (m.actualBoundingBoxRight || 0)) / 2 : 0;
  ctx.fillText(text, x + dx, y + dy);
}

function drawBall(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  n: number,
  dimmed: boolean,
): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = dimmed ? "#e7e5e4" : ballColor(n); // dimmed = stone-200
  ctx.fill();
  ctx.fillStyle = dimmed ? "#a8a29e" : "#ffffff"; // stone-400 vs white
  ctx.font = FONT(700, r * 1.05);
  centerText(ctx, String(n), x, y);
}

export type BragInput = {
  target: number;
  drawDate: string; // YYYY-MM-DD
  draw: DrawNumbers;
  sets: GeneratedSet[]; // 당첨(matched_rank ≥ 1) 세트만
};

/** 회차 자랑 카드 PNG Blob. 실패 시 reject. */
export function buildBragImage(input: BragInput): Promise<Blob> {
  const { target, drawDate, draw, sets } = input;
  const shown = sets.slice(0, MAX_SETS);
  const extra = sets.length - shown.length;

  // 등수 요약: "5등 2개 · 4등 1개" (높은 등수 우선)
  const rankCounts = new Map<number, number>();
  for (const s of sets) {
    const r = s.matched_rank ?? 0;
    if (r >= 1) rankCounts.set(r, (rankCounts.get(r) ?? 0) + 1);
  }
  const summary = [...rankCounts.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([r, c]) => `${RANK_LABEL[r] ?? `${r}등`} ${c}개`)
    .join(" · ");

  const setRowH = 108;
  const H =
    300 + // 헤더·요약
    150 + // 당첨번호 행
    shown.length * setRowH +
    (extra > 0 ? 56 : 0) +
    150; // 워터마크 푸터

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.reject(new Error("canvas_unavailable"));

  // 배경 + 테두리(사이트 카드 톤)
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "#e7e5e4";
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, W - 4, H - 4);

  // 헤더
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#f59e0b"; // amber-500 포인트
  ctx.font = FONT(800, 40);
  ctx.fillText("●", PAD, 116);
  ctx.fillStyle = "#1c1917"; // stone-900
  ctx.font = FONT(800, 64);
  ctx.fillText(`${target}회 당첨 인증`, PAD + 56, 124);
  ctx.fillStyle = "#78716c"; // stone-500
  ctx.font = FONT(400, 34);
  ctx.fillText(`${drawDate} 추첨 · lottogen 생성 번호`, PAD, 178);

  // 등수 요약
  ctx.fillStyle = "#b45309"; // amber-700
  ctx.font = FONT(800, 46);
  ctx.fillText(summary, PAD, 254);

  // 당첨번호 행
  ctx.fillStyle = "#78716c";
  ctx.font = FONT(600, 30);
  ctx.fillText("당첨번호", PAD, 320);
  const nums = drawNumbers(draw);
  const ballR = 33;
  const gap = 82;
  let bx = PAD + 170;
  const by = 310;
  for (const n of nums) {
    drawBall(ctx, bx, by, ballR, n, false);
    bx += gap;
  }
  // '+' 는 마지막 공과 보너스 공 사이 정중앙·수직 광학 중앙(양쪽 여백 대칭)
  const lastEdge = bx - gap + ballR;
  const plusX = lastEdge + 30;
  const bonusX = plusX + 30 + ballR;
  ctx.fillStyle = "#a8a29e";
  ctx.font = FONT(700, 40);
  centerText(ctx, "+", plusX, by);
  drawBall(ctx, bonusX, by, ballR, draw.bonus, false);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  // 구분선
  ctx.strokeStyle = "#f5f5f4";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(PAD, 386);
  ctx.lineTo(W - PAD, 386);
  ctx.stroke();

  // 당첨 세트들 — 맞춘 번호만 컬러, 나머지는 dimmed
  let y = 386 + 72;
  for (const s of shown) {
    const matched = matchedNumbers(s.numbers, draw);
    let x = PAD + 40;
    for (const n of s.numbers) {
      drawBall(ctx, x, y, 38, n, !matched.has(n));
      x += 94;
    }
    const rank = s.matched_rank ?? 0;
    ctx.fillStyle = "#b45309";
    ctx.font = FONT(800, 42);
    centerText(ctx, RANK_LABEL[rank] ?? `${rank}등`, W - PAD, y, "right");
    ctx.textAlign = "left";
    y += setRowH;
  }
  if (extra > 0) {
    ctx.fillStyle = "#78716c";
    ctx.font = FONT(600, 32);
    ctx.fillText(`외 당첨 ${extra}세트`, PAD + 40, y - 24);
    y += 56 - setRowH + 108;
  }

  // 워터마크 푸터
  ctx.strokeStyle = "#f5f5f4";
  ctx.beginPath();
  ctx.moveTo(PAD, H - 118);
  ctx.lineTo(W - PAD, H - 118);
  ctx.stroke();
  ctx.fillStyle = "#f59e0b";
  ctx.font = FONT(800, 34);
  ctx.fillText("●", PAD, H - 54);
  ctx.fillStyle = "#1c1917";
  ctx.font = FONT(800, 38);
  ctx.fillText("lottogen.click", PAD + 48, H - 52);
  ctx.fillStyle = "#a8a29e";
  ctx.font = FONT(400, 28);
  ctx.textAlign = "right";
  ctx.fillText("로또 당첨번호 · 명당 순위 · 번호 생성", W - PAD, H - 52);
  ctx.textAlign = "left";

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("to_blob_failed"));
    }, "image/png");
  });
}
