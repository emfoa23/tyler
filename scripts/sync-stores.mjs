// 주 1회 전국 판매점 마스터 동기화 엔트리.
import { syncMaster } from "./lib/master.mjs";

await syncMaster();
