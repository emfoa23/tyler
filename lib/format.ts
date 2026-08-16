export function won(v: number | null | undefined): string {
  if (v == null) return "-";
  return `${v.toLocaleString("ko-KR")}원`;
}

export function wonShort(v: number | null | undefined): string {
  if (v == null) return "-";
  if (v >= 1e12) return `${(v / 1e12).toFixed(1)}조원`;
  if (v >= 1e8) {
    const eok = v / 1e8;
    return `${eok >= 100 ? Math.round(eok).toLocaleString("ko-KR") : eok.toFixed(1)}억원`;
  }
  if (v >= 1e4) return `${Math.round(v / 1e4).toLocaleString("ko-KR")}만원`;
  return won(v);
}

export function dateK(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${y}년 ${m}월 ${d}일`;
}

export function dateShort(iso: string): string {
  return iso.replaceAll("-", ".");
}
