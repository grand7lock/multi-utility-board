// CJ대한통운 배송조회 프록시
// 브라우저에서 CJ API를 직접 호출하면 CORS로 막히므로 서버리스 함수가 중계한다.
// 요청: POST { invoices: ["123456789012", ...] }  (최대 20개)
// 응답: { results: [{ invcNo, status, time, where }] }

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const invoices = (req.body && req.body.invoices) || [];
  if (!Array.isArray(invoices) || invoices.length === 0 || invoices.length > 20) {
    return res.status(400).json({ error: "invoices는 1~20개의 배열이어야 합니다" });
  }

  try {
    // 1) 조회 페이지에서 세션 쿠키 + CSRF 토큰 확보
    const page = await fetch("https://www.cjlogistics.com/ko/tool/parcel/tracking", {
      headers: { "User-Agent": UA, "Accept-Language": "ko-KR,ko;q=0.9" },
    });
    const setCookies =
      typeof page.headers.getSetCookie === "function"
        ? page.headers.getSetCookie()
        : [page.headers.get("set-cookie")].filter(Boolean);
    const cookie = setCookies.map((c) => c.split(";")[0]).join("; ");
    const html = await page.text();
    const m =
      html.match(/name="_csrf"[^>]*value="([^"]+)"/) ||
      html.match(/name="_csrf"[^>]*content="([^"]+)"/) ||
      html.match(/content="([^"]+)"[^>]*name="_csrf"/);
    if (!m) {
      return res.status(502).json({
        error: "CSRF 토큰을 찾지 못했습니다. CJ 페이지 구조가 바뀌었거나 접속이 차단된 상태입니다.",
      });
    }
    const csrf = m[1];

    // 2) 송장별 조회 (순차, 간격 100ms — 상대 서버 부하 최소화)
    const results = [];
    for (const raw of invoices) {
      const inv = String(raw).replace(/\D/g, "");
      try {
        const r = await fetch("https://www.cjlogistics.com/ko/tool/parcel/tracking-detail", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": UA,
            Cookie: cookie,
            Referer: "https://www.cjlogistics.com/ko/tool/parcel/tracking",
            "X-Requested-With": "XMLHttpRequest",
          },
          body: `paramInvcNo=${encodeURIComponent(inv)}&_csrf=${encodeURIComponent(csrf)}`,
        });
        const j = await r.json();
        const dl = (j.parcelDetailResultMap && j.parcelDetailResultMap.resultList) || [];
        const last = dl.length ? dl[dl.length - 1] : null;
        results.push({
          invcNo: inv,
          status: last ? last.scanNm || "" : "조회불가",
          time: last ? last.dTime || last.regMonth || "" : "",
          where: last ? last.regBranNm || last.crgNm || "" : "",
        });
      } catch (e) {
        results.push({ invcNo: inv, status: "ERROR", time: "", where: "" });
      }
      await new Promise((r2) => setTimeout(r2, 100));
    }
    return res.status(200).json({ results });
  } catch (e) {
    return res.status(502).json({ error: "CJ대한통운 접속 실패: " + (e && e.message) });
  }
};
