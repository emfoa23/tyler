import { ballColor } from "@/lib/lotto";

// iPhone SE(375px) 에서도 6+보너스 7개가 한 줄에 들어가도록 모바일에서 축소된다.
const SIZES = {
  sm: "size-7 text-xs",
  md: "size-8 text-xs min-[400px]:size-9 min-[400px]:text-sm",
  lg: "size-9 text-sm sm:size-11 sm:text-base",
} as const;

export function Ball({
  n,
  size = "md",
  faded = false,
}: {
  n: number;
  size?: keyof typeof SIZES;
  faded?: boolean;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white ${SIZES[size]} ${faded ? "opacity-30" : ""}`}
      style={{ backgroundColor: ballColor(n), textShadow: "0 1px 1px rgba(0,0,0,.3)" }}
    >
      {n}
    </span>
  );
}

// matched 가 주어지면 매치된 공만 진하게, 나머지는 흐리게 표시한다 (당첨 대조 뷰).
export function BallRow({
  numbers,
  bonus,
  size = "md",
  matched,
}: {
  numbers: number[];
  bonus?: number;
  size?: keyof typeof SIZES;
  matched?: Set<number>;
}) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1 sm:gap-1.5">
      {numbers.map((n) => (
        <Ball key={n} n={n} size={size} faded={matched ? !matched.has(n) : false} />
      ))}
      {bonus !== undefined && (
        <>
          <span className="px-0.5 text-stone-400">+</span>
          <Ball n={bonus} size={size} faded={matched ? !matched.has(bonus) : false} />
        </>
      )}
    </span>
  );
}
