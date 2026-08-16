// Supabase PostgREST 클라이언트 (service role). 의존성 없이 fetch 만 사용.
function need(name) {
  const v = process.env[name];
  if (!v) throw new Error(`missing env: ${name}`);
  return v;
}

const URL_ = need("SUPABASE_URL");
const KEY = need("SUPABASE_SERVICE_ROLE_KEY");

async function rest(pathAndQuery, { method = "GET", body, prefer } = {}) {
  const res = await fetch(`${URL_}/rest/v1/${pathAndQuery}`, {
    method,
    headers: {
      apikey: KEY,
      authorization: `Bearer ${KEY}`,
      "content-type": "application/json",
      ...(prefer ? { prefer } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`${method} ${pathAndQuery} -> ${res.status} ${await res.text()}`);
  }
  return res;
}

async function json(res) {
  const t = await res.text();
  return t ? JSON.parse(t) : null;
}

export const select = async (q) => json(await rest(q));

// PostgREST 는 요청당 최대 1000행을 돌려주므로 전량 조회는 offset 루프로 돈다.
export async function selectAll(table, columns, extra = "") {
  const out = [];
  const page = 1000;
  for (let offset = 0; ; offset += page) {
    const rows = await select(
      `${table}?select=${columns}${extra}&limit=${page}&offset=${offset}`,
    );
    out.push(...rows);
    if (rows.length < page) return out;
  }
}

export async function countRows(query) {
  const res = await rest(`${query}${query.includes("?") ? "&" : "?"}select=*`, {
    method: "HEAD",
    prefer: "count=exact",
  });
  const range = res.headers.get("content-range") || "";
  const total = range.split("/")[1];
  return total === "*" ? null : Number(total);
}

export const insert = (table, rows) =>
  rows.length
    ? rest(table, { method: "POST", body: rows, prefer: "return=minimal" })
    : null;

export const upsert = (table, rows, onConflict, { ignore = false } = {}) =>
  rows.length
    ? rest(`${table}?on_conflict=${onConflict}`, {
        method: "POST",
        body: rows,
        prefer: `resolution=${ignore ? "ignore" : "merge"}-duplicates,return=minimal`,
      })
    : null;

export const del = (q) => rest(q, { method: "DELETE", prefer: "return=minimal" });

export const patch = (q, body) =>
  rest(q, { method: "PATCH", body, prefer: "return=minimal" });

export async function patchCount(q, body) {
  const res = await rest(q, { method: "PATCH", body, prefer: "count=exact,return=minimal" });
  const range = res.headers.get("content-range") || "";
  const total = range.split("/")[1];
  return total === "*" ? null : Number(total);
}

export const rpc = async (fn, args = {}) =>
  json(await rest(`rpc/${fn}`, { method: "POST", body: args }));
