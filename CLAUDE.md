# ATR Trailing Stop Visualizer

## Project Overview
ATR(Average True Range) 기반 트레일링 스톱 시각화 도구. 주식 종목의 가격 데이터와 ATR 트레일링 스톱 라인을 캔들스틱 차트로 시각화한다.

## Architecture
- **Monorepo** 구조: `frontend/` + `backend/` 디렉터리
- Frontend → Backend API 호출 (`GET /analyze`)

### Backend (Python / FastAPI)
- **Runtime**: Python 3.14, FastAPI + Uvicorn
- **Dependencies**: `backend/requirements.txt` (fastapi, uvicorn, yfinance, pandas, numpy, pydantic)
- **Virtual env**: `backend/.venv/`
- **Entry point**: `backend/app/main.py`
- **Port**: 8000

#### Key files
| File | Role |
|---|---|
| `app/main.py` | FastAPI app 생성, CORS, 라우터 등록 |
| `app/api.py` | `GET /analyze` 엔드포인트 (query params: ticker, period, multiplier, days, interval, trade_type, entry_price, entry_date, first_tp_ratio) |
| `app/models.py` | Pydantic 모델 (`AnalyzeRequest`, `ChartDataPoint`, `AnalyzeResponse`, `ExitStrategyData` 등) |
| `app/services.py` | yfinance 데이터 수집, ATR 계산, 트레일링 스톱/바이 래칫 로직, Exit Strategy 계산 |

#### Domain Logic
- ATR: Wilder's smoothing (pandas `ewm(alpha=1/period)`)
- 트레일링 스톱: 래칫 메커니즘 (상승 추세 시 스톱은 올라가기만 함, 이탈 시 리셋)
- 트레일링 바이: 래칫 메커니즘 (하락 추세 시 바이는 내려가기만 함, 이탈 시 리셋)
- 한국 주식 지원: 숫자 티커 → `.KS` 접미사 자동 변환, KRW 통화 감지
- Exit Strategy: Trade Type (A/M/B)별 Profit Target 계산, Position Sizing 시뮬레이션

### Frontend (React / TypeScript / Vite)
- **Runtime**: Node.js, Vite 7, React 19, TypeScript 5.9
- **Styling**: Tailwind CSS v4 (postcss plugin 방식)
- **Chart**: TradingView Lightweight Charts v5 — 캔들스틱 + 트레일링 스톱/바이 라인 + 매도/매수 시그널 마커
- **Data fetching**: TanStack React Query + Axios
- **Port**: 5173 (Vite default)

#### Key files
| File | Role |
|---|---|
| `src/App.tsx` | 메인 컴포넌트, React Query로 데이터 fetch, showStop/showBuy 토글 |
| `src/components/InputForm.tsx` | 입력 폼 (ticker, interval, period, days, multiplier slider, trade type, exit strategy, 최근 검색 이력) |
| `src/components/StockChart.tsx` | Lightweight Charts 캔들스틱 차트 렌더링 (Stop/Buy 라인, 시그널 마커, Exit Strategy 마커) |
| `src/components/StatsPanel.tsx` | 현재가, Stop/Buy 거리 등 핵심 지표 카드 |
| `src/components/ATRInfo.tsx` | ATR, Multiplier, Volatility Amount 표시 |
| `src/components/ExitStrategyInfo.tsx` | Exit Strategy 상세 (Profit Targets, Simulation Timeline) |
| `src/components/Header.tsx` | 앱 헤더 |
| `src/components/Footer.tsx` | 앱 푸터 |
| `src/components/ErrorBanner.tsx` | 에러 배너 |
| `src/components/LoadingSkeleton.tsx` | 로딩 스켈레톤 |
| `src/api/client.ts` | Axios 클라이언트, `analyzeStock()` 함수 |

## Common Commands

```bash
# Backend
cd backend
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload

# Frontend
cd frontend
pnpm install
pnpm dev           # dev server (port 5173)
pnpm build         # tsc -b && vite build
pnpm lint          # eslint
```

## Conventions
- Backend: Python, snake_case, Pydantic models for request/response validation
- Frontend: TypeScript, React functional components, Tailwind utility classes
- Dark theme UI with glassmorphism styling
- Korean language comments are acceptable
