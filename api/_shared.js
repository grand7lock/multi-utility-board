// 번역 지시문과 모델 이름을 한곳에 모아둔 파일.
// 말투나 규칙을 고칠 일이 생기면 다른 파일 말고 여기만 보면 된다.

/**
 * 번역에 쓸 모델. 지금은 가장 저렴한 Haiku 4.5.
 *
 *   claude-haiku-4-5  캡처 1장 약 5원   (현재)
 *   claude-sonnet-5   캡처 1장 약 10원  — 견적서 숫자가 자꾸 틀리면 여기로
 *   claude-opus-5     캡처 1장 약 25원  — 가장 정확
 *
 * 바꾸면 tools/image-translate.html 의 PRICES 표시도 같이 맞춰야 한다.
 */
const MODEL = "claude-haiku-4-5";

/**
 * effort 는 최신 모델에만 있다. Haiku 4.5 에 보내면 400 이 난다.
 * 지원하는 모델일 때만 붙인다.
 */
const EFFORT_MODELS = [
  "claude-opus-5",
  "claude-opus-4-8",
  "claude-opus-4-7",
  "claude-opus-4-6",
  "claude-sonnet-5",
  "claude-sonnet-4-6",
  "claude-fable-5",
];

function effortOption(effort) {
  return EFFORT_MODELS.indexOf(MODEL) !== -1 ? { output_config: { effort } } : {};
}

/** 이미지에 중국어가 없을 때 모델이 돌려줄 신호 */
const NO_CHINESE = "__NO_CHINESE__";

/** 보낼 수 있는 이미지 최대 용량 */
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** 캡처 이미지 → 한국어 */
const IMAGE_TO_KO = `당신은 중국어 화면을 한국어로 옮기는 번역가입니다.
이미지 속 중국어를 읽고 자연스러운 한국어로 번역하세요.

규칙:
- 원문의 줄바꿈과 문단 구조를 유지합니다. 표는 표처럼, 대화는 대화처럼 옮깁니다.
- 대화 화면이면 말한 사람 구분을 유지합니다.
- 원문 그대로 두는 것은 "값"뿐입니다 — 숫자, 금액, 단위, 품번, 모델명, 규격, 날짜, 시간.
  이것들은 절대 번역하거나 반올림하거나 단위를 환산하지 마세요.
- 항목 이름(라벨)은 반드시 한국어로 옮깁니다.
  예) 型号: ABC-2024 → 모델명: ABC-2024  /  数量: 500 个 → 수량: 500 개
  값만 남기고 라벨을 중국어로 두면 안 됩니다.
- 화폐 단위(元, ¥, 人民币)는 원문에 쓰인 기호를 그대로 씁니다.
  元 을 ¥ 로 바꾸는 것처럼 다른 기호로 교체하지 마세요.
  처음 나올 때 한 번만 "(위안)"을 덧붙입니다.
- 중국어가 아닌 글자(영어, 숫자, 로고)는 그대로 둡니다.
- 이미지에 중국어가 전혀 없으면 다른 말 없이 ${NO_CHINESE} 만 출력합니다.
- 설명, 인사말, "번역 결과:" 같은 머리말을 붙이지 않습니다. 번역문만 출력합니다.`;

/** 한국어 문장 → 중국어 (거래처에 보낼 문장) */
const KO_TO_ZH = `당신은 한국어를 중국어로 옮기는 비즈니스 번역가입니다.
사용자가 준 한국어 문장을, 중국 거래처에 그대로 보낼 수 있는
정중하고 자연스러운 중국어 비즈니스 문체(간체자)로 번역하세요.

규칙:
- 간체자를 씁니다.
- 지나치게 격식적이거나 번역투가 아닌, 실제 업무에서 쓰는 표현으로 옮깁니다.
- 숫자, 금액, 단위, 품번, 날짜는 원문 그대로 둡니다.
- 설명이나 병기 없이 중국어 문장만 출력합니다. 따옴표도 붙이지 않습니다.`;

/**
 * Anthropic 이 돌려준 오류를 화면에 띄울 종류로 나눈다.
 * 잔액 부족이 400 으로 오기 때문에 상태코드만 봐서는 구분이 안 된다.
 */
function classify(status, data) {
  const msg = JSON.stringify((data && data.error) || data || "").toLowerCase();
  const detail = (data && data.error && data.error.message) || "";

  if (msg.indexOf("credit balance") !== -1 || msg.indexOf("insufficient") !== -1) {
    return { code: "credit_low", status: 400, detail };
  }
  if (status === 401 || status === 403) return { code: "auth", status: 401, detail };
  if (status === 429) return { code: "rate_limit", status: 429, detail };
  if (status === 413) return { code: "too_large", status: 400, detail };
  if (msg.indexOf("image") !== -1 && msg.indexOf("exceed") !== -1) {
    return { code: "too_large", status: 400, detail };
  }
  return { code: "unknown", status: 400, detail };
}

module.exports = {
  MODEL,
  IMAGE_TO_KO,
  KO_TO_ZH,
  NO_CHINESE,
  MAX_IMAGE_BYTES,
  effortOption,
  classify,
};
