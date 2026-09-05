import { Ball } from "@/components/ball";
import { PagedList } from "@/components/paged-list";

export type NumberStatItem = {
  rank: number; // 표준 경쟁 순위 — 동률은 같은 번호(withCompetitionRank)
  num: number;
  ratio: number; // 막대 길이 (0~1, 뷰의 최댓값 대비)
  primary: string;
  secondary: string;
};

// 번호 통계 공통 리스트 템플릿 (자주 나오는 번호·안나온 번호) — 순위·볼·막대·우측 수치 2줄
export function NumberStatList({ items }: { items: NumberStatItem[] }) {
  return (
    <PagedList
      pageSize={10}
      className="divide-y divide-stone-100 rounded-2xl border border-stone-200 bg-white px-4"
      items={items.map((r) => (
        <li key={r.num} className="flex items-center gap-3 py-2.5">
          <span className="w-6 shrink-0 text-center text-sm font-bold text-stone-400">
            {r.rank}
          </span>
          <Ball n={r.num} size="md" />
          <span className="min-w-0 flex-1">
            <span className="block h-2 rounded-full bg-stone-100">
              <span
                className="block h-2 rounded-full bg-amber-400"
                style={{ width: `${r.ratio * 100}%` }}
              />
            </span>
          </span>
          <span className="w-24 shrink-0 text-right">
            <span className="block text-sm font-semibold">{r.primary}</span>
            <span className="block text-xs text-stone-400">{r.secondary}</span>
          </span>
        </li>
      ))}
    />
  );
}
