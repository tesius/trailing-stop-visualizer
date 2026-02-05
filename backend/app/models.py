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
    trend: Optional[str] = None # 'up' or 'down'

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
