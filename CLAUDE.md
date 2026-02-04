# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ATR Trailing Stop Visualizer - a full-stack app for visualizing stock price movements with ATR (Average True Range) trailing stop indicators. Helps traders visualize volatility-adjusted exit points.

**Architecture**: Monorepo with separate frontend and backend directories
- **Frontend**: React 19 + TypeScript + Vite 7 + TailwindCSS v4 + ApexCharts
- **Backend**: FastAPI (Python) + yfinance for stock data

## Development Commands

### Backend (FastAPI)
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload          # Dev server on port 8000
python verify_currency.py              # Test currency detection logic
```

### Frontend (React + Vite)
```bash
cd frontend
npm install
npm run dev       # Dev server on port 5173
npm run build     # TypeScript check (tsc -b) + Vite production build
npm run lint      # ESLint
npm run preview   # Preview production build
```

### Running Full Stack
1. Start backend: `cd backend && uvicorn app.main:app --reload`
2. Start frontend: `cd frontend && npm run dev`
3. Access at `http://localhost:5173`

## Code Architecture

### Backend (`backend/app/`)

**Request flow**: `api.py` (endpoint) → `services.py` (business logic) → `models.py` (data shapes)

- **`main.py`**: FastAPI app with CORS middleware (allows localhost:5173, localhost:3000, and `*`)
- **`api.py`**: Single `GET /analyze` endpoint accepting query params: `ticker` (required), `period`, `multiplier`, `days`, `interval`
- **`services.py`**: Core logic in three functions:
  - `fetch_stock_data()` — fetches OHLCV via yfinance; auto-appends `.KS` for numeric tickers (Korean stocks)
  - `calculate_atr_trailing_stop()` — ATR via Wilder's smoothing (EWMA, alpha=1/period) + ratchet trailing stop
  - `analyze_stock()` — orchestrates fetch → calculate → format response; detects currency (KRW vs USD)
- **`models.py`**: Pydantic models — `AnalyzeRequest`, `AnalyzeResponse`, `ChartDataPoint`

### Frontend (`frontend/src/`)

**Component hierarchy**: `App.tsx` → `InputForm.tsx` + `StockChart.tsx`

- **`App.tsx`**: Manages state via TanStack Query (`useQuery` for `/analyze` calls); renders form, chart, and ATR info
- **`components/InputForm.tsx`**: Form with ticker input, interval toggle (1d/1wk/1mo), period/days inputs, multiplier slider; debounced auto-refresh (500ms); persists recent tickers in localStorage
- **`components/StockChart.tsx`**: ApexCharts candlestick chart with trailing stop line overlay and red scatter markers for sell signals (close < stop_price); currency-aware axis formatting (₩ / $)
- **`api/client.ts`**: Axios client pointing to `http://localhost:8000`

### Key Algorithm: ATR Trailing Stop

The trailing stop uses a **ratchet mechanism**:
- True Range: `TR = max(High-Low, |High-PrevClose|, |Low-PrevClose|)`
- ATR: exponential weighted moving average with `alpha = 1/period`
- Basic Stop: `Close - (ATR × Multiplier)`
- Ratchet: if previous close > previous stop → new stop = max(previous stop, basic stop) (only moves up); if previous close ≤ previous stop → reset to basic stop

### Korean Stock Support
- Numeric tickers (e.g., "005930") auto-convert to `.KS` format for yfinance
- Currency detection: `.KS`/`.KQ` suffixes or numeric-only tickers → KRW; otherwise USD
