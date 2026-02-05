from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from app.models import AnalyzeRequest, AnalyzeResponse
from app.services import analyze_stock

router = APIRouter()

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
