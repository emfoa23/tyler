import type { Metadata } from "next";
import { GenerateClient } from "@/components/generate-client";

export const metadata: Metadata = {
  title: "번호 생성",
  description: "로또 6/45 무작위 번호 생성 — 생성한 번호의 실제 당첨 여부도 자동으로 확인",
};

export default function GeneratePage() {
  return <GenerateClient />;
}
