// 중국어 캡처 → 한국어 번역 중계
//
// API 키는 서버에 두지 않는다. 브라우저가 자기 키를 x-anthropic-key 헤더로 보내고,
// 이 함수는 그대로 Anthropic 에 넘기기만 한다. 저장도 로그도 하지 않는다.
// 그래서 이 페이지 주소가 공개돼도 남이 내 크레딧을 쓸 수 없다.
//
// 요청: POST { image: "<base64>", mediaType: "image/png" }  + 헤더 x-anthropic-key
// 응답: { text, usage: { input, output } }  또는  { code, detail }

const { MODEL, IMAGE_TO_KO, NO_CHINESE, MAX_IMAGE_BYTES, classify, effortOption } =
  require("./_shared.js");

const ALLOWED_MEDIA = ["image/png", "image/jpeg", "image/webp", "image/gif"];

module.exports = async (req, res) => {
  // CORS 를 열지 않는다. 이 페이지에서만 부르면 되고,
  // 열어두면 남이 이 함수를 공짜 프록시로 쓴다.
  if (req.method !== "POST") {
    return res.status(405).json({ code: "unknown", detail: "POST only" });
  }

  const key = req.headers["x-anthropic-key"];
  if (!key || typeof key !== "string" || key.indexOf("sk-ant-") !== 0) {
    return res.status(401).json({ code: "auth" });
  }

  const body = req.body || {};
  const image = body.image;
  const mediaType = body.mediaType;

  if (!image || typeof image !== "string") {
    return res.status(400).json({ code: "not_image" });
  }
  if (ALLOWED_MEDIA.indexOf(mediaType) === -1) {
    return res.status(400).json({ code: "not_image" });
  }
  // base64 는 원본보다 약 4/3 크다. 원본 기준으로 검사한다.
  if ((image.length * 3) / 4 > MAX_IMAGE_BYTES) {
    return res.status(400).json({ code: "too_large" });
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
            max_tokens: 8000,
            system: IMAGE_TO_KO,
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "image",
                    source: { type: "base64", media_type: mediaType, data: image },
                  },
                  { type: "text", text: "이 이미지를 번역해주세요." },
                ],
              },
            ],
          },
          effortOption("medium"),
        ),
      ),
    });

    const data = await r.json();
    if (!r.ok) {
      const c = classify(r.status, data);
      return res.status(c.status).json({ code: c.code, detail: c.detail });
    }

    const text = (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    if (!text || text.indexOf(NO_CHINESE) !== -1) {
      return res.status(400).json({ code: "no_chinese" });
    }

    return res.status(200).json({
      text,
      usage: {
        input: (data.usage && data.usage.input_tokens) || 0,
        output: (data.usage && data.usage.output_tokens) || 0,
      },
    });
  } catch (e) {
    return res.status(500).json({ code: "unknown", detail: String(e && e.message) });
  }
};
