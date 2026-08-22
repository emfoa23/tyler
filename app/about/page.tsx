import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "서비스 소개",
  description:
    "lottogen 은 로또 6/45 번호 생성, 1회차부터의 회차별 당첨 결과, 1·2등 배출 명당 순위를 제공하는 무료 서비스입니다.",
};

export default function AboutPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">서비스 소개</h1>

      <section className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6">
        <h2 className="font-bold">lottogen 은 이런 서비스입니다</h2>
        <p className="mt-3 text-sm leading-relaxed text-stone-600">
          lottogen(로또젠)은 로또 6/45 정보를 한곳에 모은 무료 서비스입니다. 회원가입 없이
          바로 이용할 수 있습니다.
        </p>
        <ul className="mt-3 space-y-2 text-sm leading-relaxed text-stone-600">
          <li>
            <Link href="/generate" className="font-medium text-amber-600 hover:underline">
              번호 생성
            </Link>{" "}
            — 서버에서 완전한 무작위로 번호를 생성합니다. 원하는 번호를 최대 5개까지 고정하고
            나머지만 무작위로 채우는 반자동도 지원합니다. 생성한 번호는 기기별로 보관되며,
            추첨이 끝나면 실제 당첨번호와 자동으로 대조해 등수를 보여줍니다.
          </li>
          <li>
            <Link href="/history" className="font-medium text-amber-600 hover:underline">
              회차별 당첨 결과
            </Link>{" "}
            — 2002년 1회차부터 전 회차의 당첨번호, 등위별 당첨자 수와 당첨금을 제공합니다.
          </li>
          <li>
            <Link href="/stores" className="font-medium text-amber-600 hover:underline">
              명당 순위
            </Link>{" "}
            — 1·2등을 배출한 판매점 순위를 지역·기간·등수별로 볼 수 있고, 지점마다 회차별
            배출 이력을 제공합니다.
          </li>
          <li>
            <Link href="/numbers" className="font-medium text-amber-600 hover:underline">
              자주 나오는 번호
            </Link>{" "}
            — 번호별 출현 횟수 순위를 기간별로, 보너스 번호 포함 여부를 골라 볼 수 있습니다.
          </li>
        </ul>
      </section>

      <section className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6">
        <h2 className="font-bold">데이터 출처와 갱신</h2>
        <ul className="mt-3 list-disc space-y-1.5 pl-4 text-sm leading-relaxed text-stone-600">
          <li>당첨 결과·배출점·판매점 데이터의 출처는 동행복권이 공개하는 데이터입니다.</li>
          <li>당첨 결과는 매주 토요일 추첨 후 자동으로 동기화되고, 판매점 정보는 주 1회 갱신됩니다.</li>
          <li>1·2등 배출점 정보는 원천 데이터가 제공되는 262회차(2007년 12월)부터 제공됩니다.</li>
          <li>
            원천 데이터가 사후 정정되는 경우가 있어 최근 회차는 자동으로 재보정됩니다. 그래도
            조회 시점에 따라 실제와 차이가 있을 수 있으므로, 실제 구매·당첨 확인은 동행복권
            공식 채널을 기준으로 해주세요.
          </li>
        </ul>
      </section>

      <section className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6">
        <h2 className="font-bold">꼭 알아두세요</h2>
        <ul className="mt-3 list-disc space-y-1.5 pl-4 text-sm leading-relaxed text-stone-600">
          <li>
            번호 생성은 완전한 무작위입니다. 모든 조합의 당첨 확률은 동일하며, 이 서비스는
            당첨을 보장하거나 당첨 확률을 높여주지 않습니다.
          </li>
          <li>
            과거 당첨 통계와 명당 순위는 흥미로운 기록일 뿐, 미래의 당첨 확률과는 무관합니다.
            매 회차 추첨은 독립 사건입니다.
          </li>
          <li>복권 구매는 만 19세 이상만 가능하며, 책임질 수 있는 범위에서 즐겨주세요.</li>
          <li>이 서비스는 복권을 판매하지 않으며, 동행복권과 무관한 개인이 운영하는 정보 서비스입니다.</li>
        </ul>
      </section>

      <section className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6">
        <h2 className="font-bold">문의</h2>
        <p className="mt-3 text-sm leading-relaxed text-stone-600">
          서비스 이용 중 문제나 제안이 있다면{" "}
          <a href="mailto:emfoa23@gmail.com" className="font-medium text-amber-600 hover:underline">
            emfoa23@gmail.com
          </a>
          으로 알려주세요.
        </p>
      </section>
    </div>
  );
}
