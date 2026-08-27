# 업무 반자동 모음 (multi-utility-board)

반복 업무를 반자동으로 처리하는 웹 도구 모음. 대시보드(`index.html`)에서 도구를 골라 실행한다.

## 도구 목록

| # | 도구 | 파일 | 설명 |
|---|---|---|---|
| 01 | CJ대한통운 대량 배송조회 | `tools/cj-tracking.html` + `api/cj-track.js` | 송장번호 대량 붙여넣기 → 실시간 배송상태 조회, 미배송 추출, 엑셀 저장 |
| 02 | 송장 엑셀 생성기 | `tools/invoice-excel.html` | 발송 정보/카톡 메시지 붙여넣기 → 한진택배 대량등록 + 플레이오토 업로드 엑셀 생성 |

앞으로 약 20개까지 확장 예정. 새 도구는 `tools/`에 페이지를 만들고 `index.html`의 `TOOLS` 배열에 한 줄 추가하면 된다.

## 구조

- `index.html` — 대시보드 (20개 슬롯)
- `tools/` — 개별 도구 페이지 (정적 HTML, 데이터는 브라우저 안에서만 처리)
- `api/` — Vercel 서버리스 함수 (외부 API 중계가 필요할 때만 사용)
- `lib/xlsx.full.min.js` — SheetJS (엑셀 생성/파싱 공용 라이브러리)

## 배포

Vercel 정적 + 서버리스 혼합 배포. `npx vercel deploy --prod`.
