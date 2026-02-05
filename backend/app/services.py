import yfinance as yf
import pandas as pd
import numpy as np
from app.models import (
    AnalyzeRequest, ChartDataPoint, AnalyzeResponse,
    TradeType, ProfitTargetLevel, PositionSell, ExitStrategyData,
)

def fetch_stock_data(ticker: str, days: int, interval: str = "1d") -> pd.DataFrame:
    """
    Fetches stock data from yfinance.
    """
    # Support for numeric tickers (Korean Market)
    if ticker.isdigit():
        ticker = f"{ticker}.KS"

    # Create Ticker object
    stock = yf.Ticker(ticker)

    # Calculate start date based on 'days' roughly, or just use period string.
    # yfinance period options: 1d,5d,1mo,3mo,6mo,1y,2y,5y,10y,ytd,max
    # We will try to map days to a period string or just fetch enough history.
    # To be safe for 365 days, we might want '2y' to have buffer for calculations.

    period = "1y"
    if days > 365:
        period = "2y"
    if days > 730:
        period = "5y"
    if days > 1825:
        period = "max"

    df = stock.history(period=period, interval=interval)

    if df.empty:
        raise ValueError(f"No data found for ticker {ticker}")

    # Standardize columns
    df = df[['Open', 'High', 'Low', 'Close', 'Volume']]
    return df

def calculate_atr_trailing_stop(df: pd.DataFrame, period: int = 14, multiplier: float = 2.5) -> pd.DataFrame:
    """
    Calculates ATR and Trailing Stop Price.
    Returns DataFrame with 'stop_price' column.
    """
    # Create a copy to allow modification
    data = df.copy()

    # 1. Calculate TR (True Range)
    # TR = Max(High - Low, abs(High - PrevClose), abs(Low - PrevClose))

    data['PrevClose'] = data['Close'].shift(1)
    data['TR1'] = data['High'] - data['Low']
    data['TR2'] = abs(data['High'] - data['PrevClose'])
    data['TR3'] = abs(data['Low'] - data['PrevClose'])
    data['TR'] = data[['TR1', 'TR2', 'TR3']].max(axis=1)

    # 2. Calculate ATR
    # Using simple rolling mean for ATR to start, or EWMA (Wilder's Smoothing is standard but simple rolling is okay for V1)
    # yfinance/pandas often use Wilder's: ATR = (PrevATR * (n-1) + CurrentTR) / n
    # For simplicity here, we use pandas ewm with com=period-1 which approximates Wilder's
    data['ATR'] = data['TR'].ewm(alpha=1/period, adjust=False).mean()

    # 3. Calculate Trailing Stop (Chandelier Exit-like / Ratchet)
    # Concept: Long Stop.
    # Initial Basic Stop = Close - (ATR * Multiplier)
    # Logic:
    # If PrevClose > PrevStop:
    #    CurrentStop = Max(BasicStop, PrevStop)
    # Else:
    #    CurrentStop = BasicStop

    data['BasicStop'] = data['Close'] - (data['ATR'] * multiplier)
    data['FinalStop'] = 0.0
    data['Trend'] = 'up' # Assume starting up

    # Iterative calculation for ratchet mechanism
    # Note: Vectorizing this conditionally based on previous row is hard, using loop is safer for correctness here
    # Start from index 'period' to have valid ATR

    final_stops = np.zeros(len(data))
    trends = np.empty(len(data), dtype=object)
    trends[:] = 'up' # Initialize all to 'up'

    # Convert series to numpy for speed
    closes = data['Close'].values
    basic_stops = data['BasicStop'].values

    # Initialize first valid value
    final_stops[period-1] = basic_stops[period-1]

    # Using the standard 'SuperTrend' indicator logic partly,
    # or just a simple Trailing Stop that resets when price crosses under.

    current_stop = basic_stops[period-1]

    for i in range(period, len(data)):
        prev_stop = final_stops[i-1]
        close = closes[i]
        prev_close = closes[i-1]
        basic_stop = basic_stops[i]

        # Ratchet Logic for Long Position
        # If we were in an uptrend (Close > Stop), we keep raising the stop.
        # If Close drops below Stop, the trend breaks (Stop Hit).
        # For visualization, we often want to see where the stop WOULD be.

        # Implementation: Standard Trailing Stop (Long Only view)
        # "If the price is above the stop line, the stop line can only move up."
        # If the price drops below, we reset the stop line to the new basic stop (or it becomes a short stop).
        # PRD implies a single line. Let's do the "Always Long Data" version for simplicity,
        # or better: Resettable Trailing Stop.

        if prev_close > prev_stop:
            # We were safe. New stop is max(old stop, new basic stop)
            current_stop = max(prev_stop, basic_stop)
        else:
            # We were stopped out. Reset to basic stop.
            current_stop = basic_stop

        final_stops[i] = current_stop

    data['StopPrice'] = final_stops

    # Clean up
    return data


def get_trade_type_defaults(trade_type: str, current_atr: float, entry_price: float) -> dict:
    """Returns default ATR period, multiplier, and 1st TP calculation for the given trade type."""
    if trade_type == "A":
        # Homerun: ATR 14, Stop 3.0×ATR, 1st TP = min(+50%, +10×ATR)
        tp_by_pct = entry_price * 1.50
        tp_by_atr = entry_price + 10 * current_atr
        first_tp = min(tp_by_pct, tp_by_atr)
        return {"period": 14, "multiplier": 3.0, "first_tp_price": first_tp, "first_tp_pct": (first_tp / entry_price) - 1}
    elif trade_type == "M":
        # Mid-range: ATR 20, Stop 2.5×ATR, 1st TP = +27.5%
        first_tp = entry_price * 1.275
        return {"period": 20, "multiplier": 2.5, "first_tp_price": first_tp, "first_tp_pct": 0.275}
    else:
        # Single/Bunt: ATR 22, Stop 2.0×ATR, 1st TP = +11%
        first_tp = entry_price * 1.11
        return {"period": 22, "multiplier": 2.0, "first_tp_price": first_tp, "first_tp_pct": 0.11}


def calculate_profit_targets(entry_price: float, first_tp_price: float, current_atr: float, first_tp_ratio: float) -> list[ProfitTargetLevel]:
    """
    Calculates up to 5 profit target levels.
    Level 1: type-based first TP
    Levels 2-5: each +10% of entry_price above the previous level
    """
    targets = []
    increment = entry_price * 0.10  # +10% of entry per subsequent level

    # Level 1
    sell_ratio_1 = first_tp_ratio
    targets.append(ProfitTargetLevel(
        level=1,
        target_price=first_tp_price,
        pct_from_entry=(first_tp_price / entry_price) - 1,
        atr_multiple=(first_tp_price - entry_price) / current_atr if current_atr > 0 else 0,
        sell_ratio=sell_ratio_1,
    ))

    # Levels 2-5: sell 1/4 of remaining each time
    remaining = 1.0 - sell_ratio_1
    for lvl in range(2, 6):
        tp_price = first_tp_price + (lvl - 1) * increment
        sell_this = remaining * 0.25
        targets.append(ProfitTargetLevel(
            level=lvl,
            target_price=tp_price,
            pct_from_entry=(tp_price / entry_price) - 1,
            atr_multiple=(tp_price - entry_price) / current_atr if current_atr > 0 else 0,
            sell_ratio=sell_this,
        ))
        remaining -= sell_this

    return targets


def simulate_position_sizing(
    df: pd.DataFrame,
    entry_price: float,
    entry_date: str,
    targets: list[ProfitTargetLevel],
    stop_prices: np.ndarray,
) -> list[PositionSell]:
    """
    Walk through price data starting from entry_date and simulate selling
    at profit targets or stop-loss.
    """
    sells: list[PositionSell] = []
    remaining = 1.0
    current_target_idx = 0
    dates = df.index
    highs = df['High'].values
    lows = df['Low'].values

    # Find the start index: first date >= entry_date
    entry_dt = pd.Timestamp(entry_date)
    if dates.tz is not None:
        entry_dt = entry_dt.tz_localize(dates.tz)
    start_idx = 0
    for i in range(len(dates)):
        if dates[i] >= entry_dt:
            start_idx = i
            break
    else:
        # entry_date is after all data — no simulation possible
        return sells

    for i in range(start_idx, len(df)):
        if remaining <= 0.001:
            break

        date_str = dates[i].strftime('%Y-%m-%d')
        stop = stop_prices[i]

        # Check stop-loss first: if Low <= stop_price
        if stop > 0 and lows[i] <= stop:
            sells.append(PositionSell(
                date=date_str,
                price=stop,
                ratio=remaining,
                remaining=0.0,
                level=0,
                label=f"Stop-loss @ {stop:.2f}",
            ))
            remaining = 0.0
            break

        # Check profit targets
        while current_target_idx < len(targets) and remaining > 0.001:
            target = targets[current_target_idx]
            if highs[i] >= target.target_price:
                sell_amount = target.sell_ratio if current_target_idx == 0 else min(target.sell_ratio, remaining)
                sell_amount = min(sell_amount, remaining)
                remaining -= sell_amount
                sells.append(PositionSell(
                    date=date_str,
                    price=target.target_price,
                    ratio=sell_amount,
                    remaining=remaining,
                    level=target.level,
                    label=f"TP{target.level} @ {target.target_price:.2f}",
                ))
                current_target_idx += 1
            else:
                break

    return sells


def calculate_exit_strategy(
    df_analyzed: pd.DataFrame,
    trade_type: str,
    entry_price: float,
    entry_date: str,
    first_tp_ratio: float,
    current_atr: float,
    multiplier: float,
) -> ExitStrategyData:
    """Orchestrates exit strategy calculation."""
    defaults = get_trade_type_defaults(trade_type, current_atr, entry_price)
    first_tp_price = defaults["first_tp_price"]

    targets = calculate_profit_targets(entry_price, first_tp_price, current_atr, first_tp_ratio)

    stop_prices = df_analyzed['StopPrice'].values
    sells = simulate_position_sizing(df_analyzed, entry_price, entry_date, targets, stop_prices)

    # Calculate weighted average sell price and total return
    weighted_avg = None
    total_return = None
    if sells:
        total_sold = sum(s.ratio for s in sells)
        if total_sold > 0:
            weighted_avg = sum(s.price * s.ratio for s in sells) / total_sold
            total_return = (weighted_avg / entry_price - 1) * 100

    # Use the latest valid trailing stop from the chart (dynamic ratchet value)
    valid_stops = df_analyzed['StopPrice'][df_analyzed['StopPrice'] > 0]
    stop_loss_price = float(valid_stops.iloc[-1]) if not valid_stops.empty else entry_price - current_atr * multiplier

    return ExitStrategyData(
        trade_type=trade_type,
        entry_price=entry_price,
        stop_loss_price=stop_loss_price,
        first_tp_ratio=first_tp_ratio,
        profit_targets=targets,
        sells=sells,
        weighted_avg_sell_price=weighted_avg,
        total_return_pct=total_return,
    )


def analyze_stock(request: AnalyzeRequest) -> AnalyzeResponse:
    df = fetch_stock_data(request.ticker, request.days, request.interval)
    df_analyzed = calculate_atr_trailing_stop(df, request.period, request.multiplier)

    # Filter for the requested 'days' (approximate slicing)
    # Since we fetched dynamic period, let's just take the tail
    # Assuming approx 252 trading days per year

    # Adjust slicing based on interval
    days_per_year_approx = 252
    if request.interval == "1wk":
        days_per_year_approx = 52
    elif request.interval == "1mo":
        days_per_year_approx = 12

    trading_days_needed = int(request.days * (days_per_year_approx/365))
    # Ensure at least 'period' data points + some buffer, but allow full fetch if needed
    # If the calculations are already done on the full df, we can just slice the tail to send back

    df_final = df_analyzed.tail(max(trading_days_needed, request.period + 10))

    data_points = []
    for index, row in df_final.iterrows():
        # Handle NaN values (start of data)
        stop_price = row['StopPrice'] if not pd.isna(row['StopPrice']) and row['StopPrice'] > 0 else None

        point = ChartDataPoint(
            date=index.strftime('%Y-%m-%d'),
            open=row['Open'],
            high=row['High'],
            low=row['Low'],
            close=row['Close'],
            volume=row['Volume'],
            stop_price=stop_price
        )
        data_points.append(point)

    # Determine currency
    currency = "USD"
    ticker_upper = request.ticker.upper()
    if ticker_upper.endswith(".KS") or ticker_upper.endswith(".KQ") or request.ticker.isdigit():
        currency = "KRW"

    # Extract current ATR (last valid ATR value)
    current_atr = 0.0
    if not df_final.empty and 'ATR' in df_final.columns:
        # Get the last non-NaN ATR value
        atr_values = df_final['ATR'].dropna()
        if not atr_values.empty:
            current_atr = float(atr_values.iloc[-1])

    # Calculate volatility amount (ATR × multiplier)
    volatility_amount = current_atr * request.multiplier

    # Exit strategy (optional)
    exit_strategy = None
    if request.trade_type and request.entry_price and request.entry_price > 0 and request.entry_date:
        first_tp_ratio = request.first_tp_ratio if request.first_tp_ratio else 0.5
        exit_strategy = calculate_exit_strategy(
            df_final,
            request.trade_type,
            request.entry_price,
            request.entry_date,
            first_tp_ratio,
            current_atr,
            request.multiplier,
        )

    return AnalyzeResponse(
        ticker=request.ticker,
        period=request.period,
        multiplier=request.multiplier,
        currency=currency,
        interval=request.interval,
        current_atr=current_atr,
        volatility_amount=volatility_amount,
        data=data_points,
        exit_strategy=exit_strategy,
    )
