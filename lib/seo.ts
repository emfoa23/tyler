import type { Metadata } from "next";

export const SITE_NAME = "lottogen";
export const SITE_URL = "https://lottogen.click";
// 홈·기본값(루트 레이아웃 fallback 과 동일) — 서비스 전체를 담는 표현(번호 생성기 ≠ 서비스 전체)
export const HOME_TITLE = "lottogen — 로또 당첨번호·명당·번호통계";
export const HOME_DESCRIPTION = "이번 주 결과를 확인하고 행운을 뽑아보세요";
export const OG_IMAGE_ALT = "lottogen — 로또 당첨번호 · 명당 순위 · 번호 통계";
const OG_IMAGE = { url: "/opengraph-image.png", width: 1200, height: 630, alt: OG_IMAGE_ALT };

/**
 * 페이지 메타 단일 진입점 — <title>·description·canonical·OG·Twitter 를 한 쌍의 값으로 채운다
 * (og:title = title, og:description = description 이 어긋날 수 없게, og:image 는 전 페이지 공통 1장).
 * 운영 규칙: core 는 'lottogen' 제외 15자 이내, description 은 30자 이내의 행동 유도문이며
 * title 과 내용이 겹치지 않는다. 홈은 absoluteTitle 로 템플릿 없이 그대로 쓴다.
 */
export function pageMeta({
  core,
  description,
  path,
  absoluteTitle,
  noindex = false,
}: {
  core?: string;
  description: string;
  path: string;
  absoluteTitle?: string;
  noindex?: boolean;
}): Metadata {
  const title = absoluteTitle ?? `${core} | ${SITE_NAME}`;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: path },
    openGraph: {
      title,
      description,
      url: path,
      siteName: SITE_NAME,
      locale: "ko_KR",
      type: "website",
      images: [OG_IMAGE],
    },
    twitter: { card: "summary_large_image", title, description, images: [OG_IMAGE.url] },
    ...(noindex ? { robots: { index: false, follow: false } } : {}),
  };
}

// 지점 title: 접두 "로또 명당: "(7자) 뒤 지점명 8자까지 그대로, 9자 이상은 앞 7자+… (15자 규칙)
export function storeTitleCore(name: string): string {
  const short = name.length <= 8 ? name : `${name.slice(0, 7)}…`;
  return `로또 명당: ${short}`;
}
