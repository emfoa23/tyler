import type { Metadata } from "next";
import { GenerateClient } from "@/components/generate-client";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  core: "로또 번호 생성·당첨 확인",
  description: "지금 바로 행운을 뽑고 결과를 기다려보세요",
  path: "/generate",
});

export default function GeneratePage() {
  return <GenerateClient />;
}
