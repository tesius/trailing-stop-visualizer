from fastapi import APIRouter, HTTPException, Query
from app.models import AnalyzeRequest, AnalyzeResponse
from app.services import analyze_stock

router = APIRouter()

@router.get("/analyze", response_model=AnalyzeResponse)
async def analyze_endpoint(
    ticker: str = Query(..., description="Stock ticker symbol (e.g. AAPL)"),
    period: int = Query(14, description="ATR Period"),
    multiplier: float = Query(2.5, description="ATR Multiplier"),
    days: int = Query(365, description="Days of history to analyze"),
    interval: str = Query("1d", description="Interval (1d, 1wk, 1mo)")
):
    try:
        request = AnalyzeRequest(
            ticker=ticker,
            period=period,
            multiplier=multiplier,
            days=days,
            interval=interval
        )
        response = analyze_stock(request)
        return response
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
