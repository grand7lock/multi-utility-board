// 한진택배 배송조회 프록시
// 요청: POST { invoices: ["123456789012", ...] } (최대 20개)
// 응답: { results: [{ invcNo, status, time, where }] }
// 한진은 결과가 서버 렌더링 HTML로 오므로 여기서 파싱해 마지막 스캔 상태를 돌려준다.

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

function stripTags(s) {
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseHanjinHtml(html) {
  // 미등록/무효 운송장: 짧은 alert 페이지가 온다
  if (html.includes("운송장이 등록되지 않았거나")) {
    return { status: "미등록/준비중", time: "", where: "" };
  }
  // 배송 이력 행 파싱: 날짜(YYYY-MM-DD)가 든 <tr>들을 모아 마지막 행을 현재 상태로 본다
  const rows = [];
  const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let m;
  while ((m = trRe.exec(html))) {
    const cells = [];
    const tdRe = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
    let c;
    while ((c = tdRe.exec(m[1]))) cells.push(stripTags(c[1]));
    if (cells.length >= 2 && /^\d{4}[-.]\d{2}[-.]\d{2}/.test(cells[0])) rows.push(cells);
  }
  if (!rows.length) {
    // 이력 표를 못 찾은 경우: 페이지에 배송완료 문구가 있으면 그것이라도 반환
    if (html.includes("배송완료")) return { status: "배송완료", time: "", where: "" };
    return { status: "조회불가", time: "", where: "" };
  }
  const last = rows[rows.length - 1];
  // 한진 이력 표: [날짜, 시간, 장소, 내용] 형태가 일반적
  const date = last[0] || "";
  const time = last.length > 1 && /^\d{1,2}:\d{2}/.test(last[1]) ? last[1] : "";
  const where = last.length > 2 ? last[2] : "";
  const desc = last[last.length - 1] || "";
  let status = desc;
  if (desc.includes("배송완료") || desc.includes("배송이 완료")) status = "배송완료";
  else if (desc.includes("배송출발") || desc.includes("배송 출발")) status = "배송출발";
  else if (desc.includes("도착")) status = "터미널도착";
  else if (desc.includes("이동중") || desc.includes("이동 중")) status = "이동중";
  else if (desc.includes("접수") || desc.includes("집하")) status = "집하/접수";
  else if (status.length > 30) status = status.slice(0, 30) + "…";
  return { status: status || "조회불가", time: (date + " " + time).trim(), where: where };
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const invoices = (req.body && req.body.invoices) || [];
  if (!Array.isArray(invoices) || invoices.length === 0 || invoices.length > 20) {
    return res.status(400).json({ error: "invoices는 1~20개의 배열이어야 합니다" });
  }

  const results = [];
  for (const raw of invoices) {
    const inv = String(raw).replace(/\D/g, "");
    try {
      const r = await fetch(
        "https://www.hanjin.com/kor/CMS/DeliveryMgr/WaybillResult.do?mCode=MN038&schLang=KR&wblnumText2=" +
          encodeURIComponent(inv),
        { headers: { "User-Agent": UA, "Accept-Language": "ko-KR,ko;q=0.9" } }
      );
      const html = await r.text();
      const p = parseHanjinHtml(html);
      results.push({ invcNo: inv, status: p.status, time: p.time, where: p.where });
    } catch (e) {
      results.push({ invcNo: inv, status: "ERROR", time: "", where: "" });
    }
    await new Promise((r2) => setTimeout(r2, 100));
  }
  return res.status(200).json({ results });
};
