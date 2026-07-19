from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from app.models import AnalyzeRequest, AnalyzeResponse, QuoteData, InterpretRequest, InterpretResponse
from app.services import analyze_stock, fetch_quotes
from app.ai import interpret_indicators

router = APIRouter()


@router.post("/interpret", response_model=InterpretResponse)
async def interpret_endpoint(request: InterpretRequest):
    """지표 스냅샷을 Gemini Flash로 해석 (온디맨드, 서버 캐시)."""
    try:
        return interpret_indicators(request)
    except RuntimeError as e:
        # 키 미설정 등 예상된 실패 → 503
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI 해석 실패: {e}")


@router.get("/quotes", response_model=List[QuoteData])
async def quotes_endpoint(
    tickers: str = Query(..., description="Comma-separated tickers, e.g. AAPL,TSLA,005930"),
):
    """워치리스트 요약 (price, change%, RSI, MACD 방향). 서버 캐시 TTL 45초."""
    symbols = [t.strip() for t in tickers.split(",") if t.strip()]
    if not symbols:
        return []
    try:
        return fetch_quotes(symbols)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/analyze", response_model=AnalyzeResponse)
async def analyze_endpoint(
    ticker: str = Query(..., description="Stock ticker symbol (e.g. AAPL)"),
    period: int = Query(14, description="ATR Period"),
    multiplier: float = Query(2.5, description="ATR Multiplier"),
    days: int = Query(365, description="Days of history to analyze"),
    interval: str = Query("1d", description="Interval (1d, 1wk, 1mo)"),
    trade_type: Optional[str] = Query(None, description="Trade type: A (Homerun), M (Mid-range), B (Single)"),
    entry_price: Optional[float] = Query(None, description="Entry price for exit strategy"),
    entry_date: Optional[str] = Query(None, description="Entry date YYYY-MM-DD for simulation start"),
    first_tp_ratio: Optional[float] = Query(None, description="First take-profit sell ratio (0.5 or 0.25)"),
):
    try:
        request = AnalyzeRequest(
            ticker=ticker,
            period=period,
            multiplier=multiplier,
            days=days,
            interval=interval,
            trade_type=trade_type,
            entry_price=entry_price,
            entry_date=entry_date,
            first_tp_ratio=first_tp_ratio,
        )
        response = analyze_stock(request)
        return response
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
