from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from enum import Enum

class TradeType(str, Enum):
    A = "A"  # Homerun
    M = "M"  # Mid-range
    B = "B"  # Single/Bunt

class ProfitTargetLevel(BaseModel):
    level: int
    target_price: float
    pct_from_entry: float  # e.g. 0.50 for +50%
    atr_multiple: float    # target distance in ATR multiples
    sell_ratio: float      # fraction of position to sell at this level

class PositionSell(BaseModel):
    date: str
    price: float
    ratio: float        # fraction of original position sold
    remaining: float    # remaining position after sell
    level: int          # 0 = stop-loss, 1-5 = profit target level
    label: str

class ExitStrategyData(BaseModel):
    trade_type: str
    entry_price: float
    stop_loss_price: float
    first_tp_ratio: float
    profit_targets: List[ProfitTargetLevel]
    sells: List[PositionSell]
    weighted_avg_sell_price: Optional[float] = None
    total_return_pct: Optional[float] = None

class AnalyzeRequest(BaseModel):
    ticker: str
    period: int = 14
    multiplier: float = 2.5
    days: int = 365
    interval: str = "1d"
    trade_type: Optional[str] = None
    entry_price: Optional[float] = None
    entry_date: Optional[str] = None  # YYYY-MM-DD
    first_tp_ratio: Optional[float] = None  # 0.5 or 0.25

class ChartDataPoint(BaseModel):
    date: str  # ISO dates
    open: float
    high: float
    low: float
    close: float
    volume: int
    stop_price: Optional[float] = None
    buy_price: Optional[float] = None
    trend: Optional[str] = None # 'up' or 'down'
    rsi: Optional[float] = None
    macd: Optional[float] = None
    macd_signal: Optional[float] = None
    macd_hist: Optional[float] = None

class InterpretRequest(BaseModel):
    """지표 AI 해석 요청 — 프론트가 /analyze에서 받은 최신 지표 스냅샷을 전달."""
    ticker: str
    currency: str = "USD"
    date: str                          # 최신 캔들 날짜 (캐시 키)
    price: float
    rsi: Optional[float] = None
    macd: Optional[float] = None
    macd_signal: Optional[float] = None
    macd_hist: Optional[float] = None
    stop_price: Optional[float] = None
    buy_price: Optional[float] = None

class InterpretResponse(BaseModel):
    ticker: str
    interpretation: str
    model: str
    cached: bool = False

class QuoteData(BaseModel):
    """워치리스트 요약 (경량 배치)."""
    ticker: str                      # 요청한 원본 티커
    price: Optional[float] = None
    change_pct: Optional[float] = None
    rsi: Optional[float] = None
    macd_hist: Optional[float] = None  # 부호로 MACD 방향(↑/↓) 판단
    currency: str = "USD"
    error: Optional[str] = None      # 개별 티커 조회 실패 시

class AnalyzeResponse(BaseModel):
    ticker: str
    period: int
    multiplier: float
    currency: str
    interval: str
    current_atr: float
    volatility_amount: float
    data: List[ChartDataPoint]
    exit_strategy: Optional[ExitStrategyData] = None

# ---- 보유 종목 (Portfolio Holdings) ----

class Holding(BaseModel):
    id: str
    ticker: str
    alias: Optional[str] = None
    memo: Optional[str] = None
    period: int = 14
    multiplier: float = 2.5
    interval: str = "1d"      # 1d / 1wk / 1mo
    days: int = 365           # 조회 히스토리 폭
    order: int = 0            # 탭 정렬 순서

class HoldingCreate(BaseModel):
    ticker: str
    alias: Optional[str] = None
    memo: Optional[str] = None
    period: int = 14
    multiplier: float = 2.5
    interval: str = "1d"
    days: int = 365

class HoldingUpdate(BaseModel):
    ticker: Optional[str] = None
    alias: Optional[str] = None
    memo: Optional[str] = None
    period: Optional[int] = None
    multiplier: Optional[float] = None
    interval: Optional[str] = None
    days: Optional[int] = None
    order: Optional[int] = None
