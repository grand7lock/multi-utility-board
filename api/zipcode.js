// 우편번호 일괄 조회 프록시 (행정안전부 도로명주소 API — www.juso.go.kr)
// 요청: POST { key: "발급받은 승인키", addrs: ["주소1", ...] } (최대 20개)
// 응답: { results: [{ addr, zip, roadAddr }] }  — 못 찾으면 zip: ""

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const key = req.body && req.body.key;
  const addrs = (req.body && req.body.addrs) || [];
  if (!key) return res.status(400).json({ error: "juso.go.kr API 승인키(key)가 필요합니다" });
  if (!Array.isArray(addrs) || addrs.length === 0 || addrs.length > 20) {
    return res.status(400).json({ error: "addrs는 1~20개의 배열이어야 합니다" });
  }

  async function lookup(keyword) {
    const url =
      "https://business.juso.go.kr/addrlink/addrLinkApi.do?confmKey=" + encodeURIComponent(key) +
      "&currentPage=1&countPerPage=1&resultType=json&keyword=" + encodeURIComponent(keyword);
    const r = await fetch(url);
    const j = await r.json();
    if (j.results && j.results.common && j.results.common.errorCode !== "0") {
      throw new Error(j.results.common.errorMessage || "juso API 오류");
    }
    const list = (j.results && j.results.juso) || [];
    return list.length ? list[0] : null;
  }

  const results = [];
  for (const addr of addrs) {
    const a = String(addr).trim();
    let out = { addr: a, zip: "", roadAddr: "" };
    try {
      // 1차: 원문 주소로 검색 (괄호 안 상세는 제거)
      let hit = await lookup(a.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim());
      // 2차: 번지수까지만 잘라서 재시도 ("...로 71" / "...길 12-3" 까지)
      if (!hit) {
        const m = a.match(/^(.*?(?:로|길|가)\s*\d+(?:-\d+)?)/);
        if (m) hit = await lookup(m[1]);
      }
      if (hit) { out.zip = hit.zipNo || ""; out.roadAddr = hit.roadAddr || ""; }
      results.push(out);
    } catch (e) {
      return res.status(502).json({ error: e.message, results });
    }
    await new Promise((r2) => setTimeout(r2, 60));
  }
  return res.status(200).json({ results });
};
