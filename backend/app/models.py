from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class AnalyzeRequest(BaseModel):
    ticker: str
    period: int = 14
    multiplier: float = 2.5
    days: int = 365
    interval: str = "1d"

class ChartDataPoint(BaseModel):
    date: str  # ISO dates
    open: float
    high: float
    low: float
    close: float
    volume: int
    stop_price: Optional[float] = None
    trend: Optional[str] = None # 'up' or 'down'

class AnalyzeResponse(BaseModel):
    ticker: str
    period: int
    multiplier: float
    currency: str
    interval: str
    data: List[ChartDataPoint]
