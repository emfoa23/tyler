// 자랑하기 이미지 — 클라이언트 캔버스 생성(서버 인프라 0). 회차 당첨 결과를 카드로 그린다.
// 내용: 회차 헤더·당첨번호·당첨 세트(맞춘 번호 하이라이트, 최대 5개)·워터마크(lottogen.click).
// 세트 순서는 서버(/api/share → lib/queries getWinningSets)가 준 그대로 = 공유 착지 페이지와 동일
// (등수 오름차순 → id 오름차순). 2026-09-05: 등수 요약 줄("4등 3개 · 5등 14개")과 "외 당첨 N세트" 줄을
// 뺐다 — 헤더 아래 당첨번호 행을 48px 당기고, 카드 높이는 세트 수에만 비례한다.
// 워터마크는 이미지-only 로 공유되는 지면(링크를 버리는 앱)에서 유일한 유입 경로다.
import { ballColor, drawNumbers, matchedNumbers, RANK_LABEL } from "@/lib/lotto";
import type { DrawNumbers, WinningSet } from "@/lib/types";

const W = 1080;
const PAD = 72;
const MAX_SETS = 5; // 카드가 길어지지 않게 표시 상한 — 등수순이라 상위 5개 = 가장 좋은 세트

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
  sets: Pick<WinningSet, "numbers" | "matched_rank">[]; // 당첨 세트만, 서버 순서 그대로
};

/** 회차 자랑 카드 PNG Blob. 실패 시 reject. */
export function buildBragImage(input: BragInput): Promise<Blob> {
  const { target, drawDate, draw, sets } = input;
  const shown = sets.slice(0, MAX_SETS);

  const setRowH = 108;
  const NUMS_Y = 262; // 당첨번호 공 중심
  const DIVIDER_Y = 338; // 구분선 — 공 하단과의 간격 43px
  const FIRST_ROW_Y = DIVIDER_Y + 72; // 첫 세트 공 중심
  const lastRowY = FIRST_ROW_Y + (Math.max(shown.length, 1) - 1) * setRowH;
  // 마지막 세트 중심 → 푸터선 132px, 푸터선 → 하단 118px
  const H = lastRowY + 132 + 118;

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

  // 당첨번호 행
  ctx.fillStyle = "#78716c";
  ctx.font = FONT(600, 30);
  ctx.fillText("당첨번호", PAD, NUMS_Y + 10);
  const nums = drawNumbers(draw);
  const ballR = 33;
  const gap = 82;
  let bx = PAD + 170;
  const by = NUMS_Y;
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
  ctx.moveTo(PAD, DIVIDER_Y);
  ctx.lineTo(W - PAD, DIVIDER_Y);
  ctx.stroke();

  // 당첨 세트들 — 맞춘 번호만 컬러, 나머지는 dimmed
  let y = FIRST_ROW_Y;
  for (const s of shown) {
    const matched = matchedNumbers(s.numbers, draw);
    let x = PAD + 40;
    for (const n of s.numbers) {
      drawBall(ctx, x, y, 38, n, !matched.has(n));
      x += 94;
    }
    const rank = s.matched_rank;
    ctx.fillStyle = "#b45309";
    ctx.font = FONT(800, 42);
    centerText(ctx, RANK_LABEL[rank] ?? `${rank}등`, W - PAD, y, "right");
    ctx.textAlign = "left";
    y += setRowH;
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
