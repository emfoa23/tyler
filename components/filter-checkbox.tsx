"use client";

// 필터 체크박스 공통 표현 (명당 순위·판매점 검색 '폐점 제외', 생성기 '당첨만 보기') — 바뀌는 즉시 onChange 로 반영
export function FilterCheckbox({
  label,
  checked,
  onChange,
  disabled = false,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex shrink-0 items-center gap-1.5 text-sm text-stone-500">
      <input
        type="checkbox"
        className="size-4 accent-amber-500"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}
