export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function chunks(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export function uniqueBy(arr, key) {
  const seen = new Set();
  return arr.filter((x) => {
    const k = x[key];
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
