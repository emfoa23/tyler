// 주 1회 전국 판매점 마스터 동기화 엔트리.
// 인자로 "서울,경기" 처럼 시도 부분집합을 줄 수 있다 (비우면 전국).
import { syncMaster } from "./lib/master.mjs";

const arg = (process.argv[2] || "").trim();
await syncMaster(arg ? arg.split(",").map((s) => s.trim()).filter(Boolean) : undefined);
