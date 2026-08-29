// 봇 UA 판별 — 클라 비콘·서버 라우트(/api/track, /api/share) 공용 단일 소스. 판별에만 사용·미저장.
export const BOT_UA_RE =
  /bot|spider|crawl|slurp|headless|lighthouse|preview|yeti|daum|petal|semrush|ahrefs|yandex|baidu|bytespider|gptbot|inspectiontool|googleother|google-extended|facebookexternalhit|kakaotalk-scrap|whatsapp|telegram|skype/i;

export function isBotUserAgent(ua: string): boolean {
  return BOT_UA_RE.test(ua);
}
