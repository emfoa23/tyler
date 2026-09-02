import Link from "next/link";

// 2차 메뉴 pill 탭 (섹션 안의 뷰 전환) — 어드민 기간 탭과 같은 표현.
// CJK 는 글자 사이 어디서나 줄바꿈되므로 nowrap 으로 pill 내부 꺾임을 금지한다.
// 링크는 쿼리 없는 canonical 진입점으로 둔다 (뷰마다 필터 구성이 달라 상태를 넘기지 않음).
export function SectionTabs({
  tabs,
  current,
}: {
  tabs: { href: string; label: string }[];
  current: string;
}) {
  return (
    <div className="flex flex-wrap gap-1 text-sm font-medium">
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={`whitespace-nowrap rounded-lg px-2.5 py-1.5 ${
            t.href === current
              ? "bg-stone-900 text-white"
              : "text-stone-500 hover:bg-stone-100 hover:text-stone-900"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
