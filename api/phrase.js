// 한국어 문장 → 중국어 번역 중계 (문장집용)
//
// translate.js 와 같은 원칙. 키는 브라우저가 헤더로 보내고 서버는 저장하지 않는다.
//
// 요청: POST { text: "납기일이 언제인가요?" }  + 헤더 x-anthropic-key
// 응답: { zh, usage: { input, output } }  또는  { code, detail }

const { MODEL, KO_TO_ZH, classify, effortOption } = require("./_shared.js");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ code: "unknown", detail: "POST only" });
  }

  const key = req.headers["x-anthropic-key"];
  if (!key || typeof key !== "string" || key.indexOf("sk-ant-") !== 0) {
    return res.status(401).json({ code: "auth" });
  }

  const text = req.body && req.body.text;
  if (typeof text !== "string" || !text.trim()) {
    return res.status(400).json({ code: "unknown", detail: "문장을 입력해주세요." });
  }
  if (text.length > 1000) {
    return res
      .status(400)
      .json({ code: "unknown", detail: "문장이 너무 깁니다. 1000자 이내로 입력해주세요." });
  }

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(
        Object.assign(
          {
            model: MODEL,
            max_tokens: 2000,
            system: KO_TO_ZH,
            messages: [{ role: "user", content: text.trim() }],
          },
          effortOption("low"),
        ),
      ),
    });

    const data = await r.json();
    if (!r.ok) {
      const c = classify(r.status, data);
      return res.status(c.status).json({ code: c.code, detail: c.detail });
    }

    const zh = (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    if (!zh) return res.status(400).json({ code: "unknown" });

    return res.status(200).json({
      zh,
      usage: {
        input: (data.usage && data.usage.input_tokens) || 0,
        output: (data.usage && data.usage.output_tokens) || 0,
      },
    });
  } catch (e) {
    return res.status(500).json({ code: "unknown", detail: String(e && e.message) });
  }
};
