export type Draw = {
  draw_no: number;
  draw_date: string;
  n1: number; n2: number; n3: number; n4: number; n5: number; n6: number;
  bonus: number;
  r1_winners: number | null; r1_prize_each: number | null; r1_prize_total: number | null;
  r2_winners: number | null; r2_prize_each: number | null; r2_prize_total: number | null;
  r3_winners: number | null; r3_prize_each: number | null; r3_prize_total: number | null;
  r4_winners: number | null; r4_prize_each: number | null; r4_prize_total: number | null;
  r5_winners: number | null; r5_prize_each: number | null; r5_prize_total: number | null;
  first_auto: number | null; first_manual: number | null; first_semi: number | null;
  sales_total: number | null;
  prize_pool: number | null;
};

export type DrawNumbers = Pick<Draw, "draw_no" | "draw_date" | "n1" | "n2" | "n3" | "n4" | "n5" | "n6" | "bonus">;

export type Store = {
  store_id: string;
  name: string;
  sido: string | null;
  sigungu: string | null;
  address: string | null;
  phone: string | null;
  lat: number | null;
  lng: number | null;
  status: "open" | "closed";
  sells_l645: boolean | null;
  master_seen_at: string | null;
};

export type RankingRow = {
  store_id: string;
  name: string;
  sido: string | null;
  sigungu: string | null;
  address: string | null;
  status: "open" | "closed";
  r1: number;
  r2: number;
  total: number;
  last_win: string;
  rnk: number; // 표준 경쟁 순위(1,1,1,4) — SQL rank() 가 페이징 전 전체 집합에서 계산
};

export type GeneratedSet = {
  id: number;
  numbers: number[];
  target_draw: number;
  matched_rank: number | null;
  checked_at: string | null;
  created_at: string;
};

// 그 기기의 해당 회차 당첨 세트(자랑 이미지·공유 착지 공용). 순서는 lib/queries getWinningSets 가 정한다.
export type WinningSet = Pick<GeneratedSet, "id" | "numbers"> & { matched_rank: number };

export type GenerationStats = {
  total: number;
  devices: number;        // 생성 인원(기기 단위)
  checked: number;        // 추첨 완료(대조된) 세트
  drawn_devices: number;  // 추첨 완료 세트를 가진 인원
  r1: number; r2: number; r3: number; r4: number; r5: number;
};
