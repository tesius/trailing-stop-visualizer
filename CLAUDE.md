# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ATR Trailing Stop Visualizer is a full-stack application for visualizing stock price movements with ATR (Average True Range) based trailing stop indicators. The system helps traders visualize when to exit positions based on volatility-adjusted stop losses.

**Architecture**: Monorepo with separate frontend and backend directories
- **Frontend**: React + TypeScript + Vite + TailwindCSS + ApexCharts
- **Backend**: FastAPI (Python) + yfinance for stock data

## Development Commands

### Backend (FastAPI)
```bash
cd backend

# Install dependencies
pip install -r requirements.txt

# Run development server (default port 8000)
uvicorn app.main:app --reload

# Verify currency detection
python verify_currency.py
```

### Frontend (React + Vite)
```bash
cd frontend

# Install dependencies
npm install

# Run development server (default port 5173)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Lint code
npm run lint
```

### Running Full Stack
1. Start backend: `cd backend && uvicorn app.main:app --reload`
2. Start frontend: `cd frontend && npm run dev`
3. Access at `http://localhost:5173`

## Code Architecture

### Backend Structure (`backend/app/`)

**Core Logic Flow**: `api.py` → `services.py` → `models.py`

- **`main.py`**: FastAPI app initialization with CORS middleware configured for localhost:5173 (Vite) and localhost:3000
- **`api.py`**: Single endpoint `/analyze` (GET) that accepts query parameters: ticker, period, multiplier, days, interval
- **`services.py`**: Contains the main ATR calculation logic:
  - `fetch_stock_data()`: Uses yfinance to fetch OHLCV data. Auto-converts numeric tickers to `.KS` suffix for Korean stocks
  - `calculate_atr_trailing_stop()`: Implements ATR calculation using exponential weighted moving average (Wilder's smoothing) and ratchet-style trailing stop logic
  - `analyze_stock()`: Orchestrates data fetching, calculation, and response formatting
- **`models.py`**: Pydantic models for request/response validation (AnalyzeRequest, AnalyzeResponse, ChartDataPoint)

**Key Algorithm**: The trailing stop uses a "ratchet mechanism" where the stop price can only move up (for long positions). If price crosses below stop, it resets to the new basic stop level (Close - ATR × Multiplier).

### Frontend Structure (`frontend/src/`)

**Component Hierarchy**: `App.tsx` → `InputForm.tsx` + `StockChart.tsx`

- **`App.tsx`**: Main component managing state with TanStack Query for API calls. Handles loading, error, and success states
- **`components/InputForm.tsx`**:
  - Form with ticker input, interval toggle (1d/1wk/1mo), period/days inputs, and multiplier slider
  - Implements debounced auto-refresh (500ms) for multiplier and interval changes after initial fetch
  - Stores recent tickers (max 5) in localStorage for quick access
- **`components/StockChart.tsx`**:
  - Uses ApexCharts to render candlestick chart with trailing stop line overlay
  - Shows red scatter markers for "sell signals" (when close < stop_price)
  - Auto-formats currency based on ticker (KRW for Korean stocks, USD otherwise)
- **`api/client.ts`**: Axios client configured for `http://localhost:8000` backend

### Data Flow

1. User inputs ticker and parameters in `InputForm`
2. Form triggers API call via TanStack Query in `App.tsx`
3. Backend fetches historical data from yfinance, calculates ATR and trailing stop
4. Frontend receives array of `ChartDataPoint` objects with OHLCV + stop_price
5. `StockChart` renders candlestick chart with trailing stop line and sell signals

### Korean Stock Support

The app supports Korean stock tickers:
- Numeric tickers (e.g., "005930") are automatically converted to KS format ("005930.KS")
- Currency display switches to KRW (₩) for Korean stocks
- Detection logic checks for `.KS`, `.KQ` suffixes or numeric-only tickers

## Key Technical Details

### ATR Calculation Method
- Uses exponential weighted moving average with alpha=1/period (Wilder's smoothing)
- True Range = max(High-Low, |High-PrevClose|, |Low-PrevClose|)
- Trailing Stop = Close - (ATR × Multiplier)
- Ratchet mechanism: stop only moves up in uptrends, resets on stop-out

### API Endpoint
- **GET** `/analyze`
- Query params: `ticker` (required), `period` (default: 14), `multiplier` (default: 2.5), `days` (default: 365), `interval` (default: "1d")
- Returns: `AnalyzeResponse` with ticker info, currency, and array of data points

### State Management
- TanStack Query for server state (caching, loading, error handling)
- React useState for form inputs and UI state
- LocalStorage for persisting recent tickers

### Styling
- TailwindCSS v4 with custom glassmorphism effects
- Dark theme with gradient backgrounds (gray-900 → gray-800 → black)
- Blue/emerald accent colors for interactive elements
