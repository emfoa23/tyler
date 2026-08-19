import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "개인정보처리방침",
  description:
    "lottogen 개인정보처리방침 — 회원가입 없이 이용하는 서비스로, 개인을 식별하는 정보를 수집하지 않습니다.",
};

export default function PrivacyPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">개인정보처리방침</h1>

      <section className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6 text-sm leading-relaxed text-stone-600">
        <p>
          lottogen(https://lottogen.click, 이하 "서비스")은 회원가입 없이 이용하는 서비스로,
          이름·연락처·이메일 등 개인을 식별할 수 있는 정보를 수집하지 않습니다. 이 문서는
          서비스가 처리하는 정보와 그 방식을 설명합니다.
        </p>
      </section>

      <section className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6">
        <h2 className="font-bold">1. 처리하는 정보</h2>
        <ul className="mt-3 list-disc space-y-1.5 pl-4 text-sm leading-relaxed text-stone-600">
          <li>
            <b>익명 기기 식별자</b> — 번호 생성 이력을 기기별로 보관하기 위해 무작위로 만든
            식별자를 브라우저(localStorage)에 저장하고, 서버에는 이 식별자와 생성한 번호·생성
            시각이 저장됩니다. 이 식별자는 무작위 값으로, 이용자가 누구인지와 연결할 수
            없습니다.
          </li>
          <li>
            <b>접속 기록</b> — 서비스 운영 과정에서 호스팅 사업자의 표준 로그(접속 IP, 요청
            경로 등)가 일시적으로 처리될 수 있습니다.
          </li>
        </ul>
      </section>

      <section className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6">
        <h2 className="font-bold">2. 이용 목적</h2>
        <ul className="mt-3 list-disc space-y-1.5 pl-4 text-sm leading-relaxed text-stone-600">
          <li>생성한 번호의 보관·표시와 실제 당첨번호와의 자동 대조</li>
          <li>서비스의 안정적 운영과 남용 방지(기기당 일일 생성 한도 적용)</li>
        </ul>
      </section>

      <section className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6">
        <h2 className="font-bold">3. 보관과 삭제</h2>
        <ul className="mt-3 list-disc space-y-1.5 pl-4 text-sm leading-relaxed text-stone-600">
          <li>번호 생성 이력은 서비스 제공을 위해 보관됩니다.</li>
          <li>
            브라우저의 사이트 데이터(localStorage)를 삭제하면 기기와 생성 이력의 연결이
            끊어지며, 이후 새 식별자가 발급됩니다.
          </li>
        </ul>
      </section>

      <section className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6">
        <h2 className="font-bold">4. 처리 위탁</h2>
        <p className="mt-3 text-sm leading-relaxed text-stone-600">
          서비스는 인프라 운영을 위해 다음 사업자를 이용합니다. 이 외에 정보를 제3자에게
          제공하지 않습니다.
        </p>
        <ul className="mt-3 list-disc space-y-1.5 pl-4 text-sm leading-relaxed text-stone-600">
          <li>Vercel Inc. — 웹 호스팅</li>
          <li>Supabase Inc. — 데이터 저장(서울 리전)</li>
        </ul>
      </section>

      <section className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6">
        <h2 className="font-bold">5. 쿠키와 광고</h2>
        <ul className="mt-3 list-disc space-y-1.5 pl-4 text-sm leading-relaxed text-stone-600">
          <li>서비스 자체 기능은 쿠키를 사용하지 않습니다.</li>
          <li>
            서비스에 광고(Google AdSense)가 게재되는 경우, Google 을 포함한 제3자 광고
            사업자는 쿠키를 사용해 이용자의 이전 방문 기록에 기반한 광고를 게재할 수
            있습니다.
          </li>
          <li>
            맞춤 광고에 사용되는 Google 의 광고 쿠키는{" "}
            <a
              href="https://adssettings.google.com"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-amber-600 hover:underline"
            >
              Google 광고 설정
            </a>
            에서 사용 중지할 수 있으며,{" "}
            <a
              href="https://www.aboutads.info"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-amber-600 hover:underline"
            >
              www.aboutads.info
            </a>
            에서 제3자 광고 쿠키 사용을 거부할 수 있습니다.
          </li>
        </ul>
      </section>

      <section className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6">
        <h2 className="font-bold">6. 문의와 변경</h2>
        <ul className="mt-3 list-disc space-y-1.5 pl-4 text-sm leading-relaxed text-stone-600">
          <li>
            이 방침에 대한 문의는{" "}
            <a
              href="mailto:emfoa23@gmail.com"
              className="font-medium text-amber-600 hover:underline"
            >
              emfoa23@gmail.com
            </a>
            으로 보내주세요.
          </li>
          <li>방침이 변경되는 경우 이 페이지에 게시하며, 본문 하단의 시행일을 갱신합니다.</li>
        </ul>
        <p className="mt-4 text-xs text-stone-400">시행일: 2026-08-19</p>
      </section>
    </div>
  );
}
