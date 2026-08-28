import Link from "next/link";
import { STAT_WINDOW_TABS, statWindowParam, type StatWindow } from "@/lib/admin-analytics";

// 기간 탭(오늘/7일/30일/전체) — CJK 는 글자 사이 어디서나 줄바꿈되므로 nowrap+shrink-0 로
// pill 내부 꺾임을 금지하고, 좁은 화면에선 헤더 행(flex-wrap)이 탭 묶음째 다음 줄로 내린다.
export function AdminPeriodTabs({ current }: { current: StatWindow }) {
  return (
    <div className="flex shrink-0 gap-1 text-sm font-medium">
      {STAT_WINDOW_TABS.map((tab) => (
        <Link
          key={tab.label}
          href={`/admin?days=${statWindowParam(tab.window)}`}
          className={`whitespace-nowrap rounded-lg px-2.5 py-1.5 ${
            current === tab.window
              ? "bg-stone-900 text-white"
              : "text-stone-500 hover:bg-stone-100 hover:text-stone-900"
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
