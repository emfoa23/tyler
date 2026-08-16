import { isOnlineStore } from "@/lib/lotto";

// 온라인 채널(동행복권 사이트)·폐점 배지. 랭킹/배출점/지점 페이지 공통.
export function StoreBadges({
  storeId,
  status,
}: {
  storeId: string;
  status?: "open" | "closed";
}) {
  return (
    <>
      {isOnlineStore(storeId) && (
        <span className="inline-flex items-center whitespace-nowrap rounded-full border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[11px] font-medium text-blue-600">
          온라인
        </span>
      )}
      {status === "closed" && !isOnlineStore(storeId) && (
        <span className="inline-flex items-center whitespace-nowrap rounded-full border border-stone-200 bg-stone-100 px-1.5 py-0.5 text-[11px] font-medium text-stone-500">
          폐점
        </span>
      )}
    </>
  );
}
