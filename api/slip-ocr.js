// 거래명세표 사진 → JSON 중계
//
// api/translate.js 와 같은 원칙이다. 키는 서버에 두지 않는다.
// 브라우저가 자기 키를 x-anthropic-key 로 보내고, 이 함수는 Anthropic 에 그대로 넘긴다.
// 저장도 로그도 하지 않는다.
//
// 요청 본문은 브라우저가 만든 Anthropic 메시지 본문 그대로다.
// (model, max_tokens, system, messages) — 프롬프트는 tools/takara-slip.html 에 있다.

const { classify } = require("./_shared.js");

const MAX_BODY_BYTES = 8 * 1024 * 1024;

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ code: "unknown", detail: "POST only" });
  }

  const key = req.headers["x-anthropic-key"];
  if (!key || typeof key !== "string" || key.indexOf("sk-ant-") !== 0) {
    return res.status(401).json({ code: "auth", detail: "API 키가 없습니다." });
  }

  const body = req.body || {};
  if (!body.model || !Array.isArray(body.messages)) {
    return res.status(400).json({ code: "unknown", detail: "잘못된 요청입니다." });
  }
  if (JSON.stringify(body).length > MAX_BODY_BYTES) {
    return res.status(400).json({ code: "too_large", detail: "사진이 너무 큽니다." });
  }

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });

    const data = await r.json();
    if (!r.ok) {
      const c = classify(r.status, data);
      return res.status(c.status).json({ code: c.code, detail: c.detail });
    }
    return res.status(200).json(data);
  } catch (e) {
    return res.status(500).json({ code: "unknown", detail: String(e && e.message) });
  }
};
