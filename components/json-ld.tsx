// JSON-LD 구조화 데이터 <script>. 검색엔진은 head/body 어느 위치든 읽는다.
export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
