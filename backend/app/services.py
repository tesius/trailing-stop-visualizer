import time
import yfinance as yf
import pandas as pd
import numpy as np
from app.models import (
    AnalyzeRequest, ChartDataPoint, AnalyzeResponse, QuoteData,
    TradeType, ProfitTargetLevel, PositionSell, ExitStrategyData,
)


def resolve_symbol(ticker: str) -> str:
    """숫자 티커(한국) → .KS 접미사 부여. 그 외는 그대로."""
    return f"{ticker}.KS" if ticker.isdigit() else ticker


def detect_currency(ticker: str) -> str:
    upper = ticker.upper()
    if upper.endswith(".KS") or upper.endswith(".KQ") or ticker.isdigit():
        return "KRW"
    return "USD"

def fetch_stock_data(ticker: str, days: int, interval: str = "1d") -> pd.DataFrame:
    """
    Fetches stock data from yfinance.
    """
    # Support for numeric tickers (Korean Market)
    ticker = resolve_symbol(ticker)

    stock = yf.Ticker(ticker)

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

    df = df[['Open', 'High', 'Low', 'Close', 'Volume']]
    return df

def calculate_atr(df: pd.DataFrame, period: int = 14) -> pd.DataFrame:
    """
    Calculates True Range and ATR (Wilder's smoothing).
    Returns DataFrame with 'TR' and 'ATR' columns added.
    """
    data = df.copy()

    data['PrevClose'] = data['Close'].shift(1)
    data['TR1'] = data['High'] - data['Low']
    data['TR2'] = abs(data['High'] - data['PrevClose'])
    data['TR3'] = abs(data['Low'] - data['PrevClose'])
    data['TR'] = data[['TR1', 'TR2', 'TR3']].max(axis=1)
    data['ATR'] = data['TR'].ewm(alpha=1/period, adjust=False).mean()

    return data

def calculate_rsi(df: pd.DataFrame, period: int = 14) -> pd.DataFrame:
    """
    Calculates RSI using Wilder's smoothing (동일 ewm(alpha=1/period) 방식).
    Returns DataFrame with 'RSI' column added.
    """
    data = df.copy()

    delta = data['Close'].diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)

    avg_gain = gain.ewm(alpha=1/period, adjust=False).mean()
    avg_loss = loss.ewm(alpha=1/period, adjust=False).mean()

    rs = avg_gain / avg_loss
    data['RSI'] = 100 - (100 / (1 + rs))
    # avg_loss == 0 이면 rs=inf → RSI=100. 첫 캔들(delta NaN)은 NaN 유지.
    data.loc[avg_loss == 0, 'RSI'] = 100.0

    return data


def calculate_macd(df: pd.DataFrame, fast: int = 12, slow: int = 26, signal: int = 9) -> pd.DataFrame:
    """
    Calculates MACD (EMA fast/slow), signal line, histogram.
    Returns DataFrame with 'MACD', 'MACDSignal', 'MACDHist' columns added.
    """
    data = df.copy()

    ema_fast = data['Close'].ewm(span=fast, adjust=False).mean()
    ema_slow = data['Close'].ewm(span=slow, adjust=False).mean()
    data['MACD'] = ema_fast - ema_slow
    data['MACDSignal'] = data['MACD'].ewm(span=signal, adjust=False).mean()
    data['MACDHist'] = data['MACD'] - data['MACDSignal']

    return data


def calculate_atr_trailing_stop(df: pd.DataFrame, period: int = 14, multiplier: float = 2.5) -> pd.DataFrame:
    """
    Calculates Trailing Stop Price using ATR.
    Expects df to already have 'ATR' column (from calculate_atr).
    """
    data = df.copy()

    data['BasicStop'] = data['Close'] - (data['ATR'] * multiplier)

    final_stops = np.zeros(len(data))

    closes = data['Close'].values
    basic_stops = data['BasicStop'].values

    final_stops[period-1] = basic_stops[period-1]

    for i in range(period, len(data)):
        prev_stop = final_stops[i-1]
        prev_close = closes[i-1]
        basic_stop = basic_stops[i]

        if prev_close > prev_stop:
            final_stops[i] = max(prev_stop, basic_stop)
        else:
            final_stops[i] = basic_stop

    data['StopPrice'] = final_stops

    return data

def calculate_atr_trailing_buy(df: pd.DataFrame, period: int = 14, multiplier: float = 2.5) -> pd.DataFrame:
    """
    Calculates Trailing Buy Price using ATR.
    Expects df to already have 'ATR' column (from calculate_atr).
    BasicBuy = Close + (ATR * Multiplier) — above the price
    Ratchet: in downtrend (close < buy line), buy line can only go DOWN.
    When close crosses above buy line, reset.
    """
    data = df.copy()

    data['BasicBuy'] = data['Close'] + (data['ATR'] * multiplier)

    final_buys = np.zeros(len(data))

    closes = data['Close'].values
    basic_buys = data['BasicBuy'].values

    final_buys[period-1] = basic_buys[period-1]

    for i in range(period, len(data)):
        prev_buy = final_buys[i-1]
        prev_close = closes[i-1]
        basic_buy = basic_buys[i]

        if prev_close < prev_buy:
            final_buys[i] = min(prev_buy, basic_buy)
        else:
            final_buys[i] = basic_buy

    data['BuyPrice'] = final_buys

    return data


def get_trade_type_defaults(trade_type: str, current_atr: float, entry_price: float) -> dict:
    """Returns default ATR period, multiplier, and 1st TP calculation for the given trade type."""
    if trade_type == "A":
        tp_by_pct = entry_price * 1.50
        tp_by_atr = entry_price + 10 * current_atr
        first_tp = min(tp_by_pct, tp_by_atr)
        return {"period": 14, "multiplier": 3.0, "first_tp_price": first_tp, "first_tp_pct": (first_tp / entry_price) - 1}
    elif trade_type == "M":
        first_tp = entry_price * 1.275
        return {"period": 20, "multiplier": 2.5, "first_tp_price": first_tp, "first_tp_pct": 0.275}
    else:
        first_tp = entry_price * 1.11
        return {"period": 22, "multiplier": 2.0, "first_tp_price": first_tp, "first_tp_pct": 0.11}


def calculate_profit_targets(entry_price: float, first_tp_price: float, current_atr: float, first_tp_ratio: float) -> list[ProfitTargetLevel]:
    """
    Calculates up to 5 profit target levels.
    Level 1: type-based first TP
    Levels 2-5: each +10% of entry_price above the previous level
    """
    targets = []
    increment = entry_price * 0.10

    sell_ratio_1 = first_tp_ratio
    targets.append(ProfitTargetLevel(
        level=1,
        target_price=first_tp_price,
        pct_from_entry=(first_tp_price / entry_price) - 1,
        atr_multiple=(first_tp_price - entry_price) / current_atr if current_atr > 0 else 0,
        sell_ratio=sell_ratio_1,
    ))

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

    entry_dt = pd.Timestamp(entry_date)
    if dates.tz is not None:
        entry_dt = entry_dt.tz_localize(dates.tz)
    start_idx = 0
    for i in range(len(dates)):
        if dates[i] >= entry_dt:
            start_idx = i
            break
    else:
        return sells

    for i in range(start_idx, len(df)):
        if remaining <= 0.001:
            break

        date_str = dates[i].strftime('%Y-%m-%d')
        stop = stop_prices[i]

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

    weighted_avg = None
    total_return = None
    if sells:
        total_sold = sum(s.ratio for s in sells)
        if total_sold > 0:
            weighted_avg = sum(s.price * s.ratio for s in sells) / total_sold
            total_return = (weighted_avg / entry_price - 1) * 100

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

    # Step 1: Calculate ATR
    df_atr = calculate_atr(df, request.period)

    # Step 2: Calculate Trailing Stop
    df_stop = calculate_atr_trailing_stop(df_atr, request.period, request.multiplier)

    # Step 3: Calculate Trailing Buy
    df_analyzed = calculate_atr_trailing_buy(df_stop, request.period, request.multiplier)

    # Step 4: Momentum indicators (RSI, MACD) — tail 자르기 전 전체 히스토리로 계산
    df_analyzed = calculate_rsi(df_analyzed, 14)
    df_analyzed = calculate_macd(df_analyzed)

    # Filter for the requested 'days'
    days_per_year_approx = 252
    if request.interval == "1wk":
        days_per_year_approx = 52
    elif request.interval == "1mo":
        days_per_year_approx = 12

    trading_days_needed = int(request.days * (days_per_year_approx/365))
    df_final = df_analyzed.tail(max(trading_days_needed, request.period + 10))

    def _num(value):
        """NaN/inf → None (JSON 직렬화 안전)."""
        if value is None or pd.isna(value) or np.isinf(value):
            return None
        return float(value)

    data_points = []
    for index, row in df_final.iterrows():
        stop_price = row['StopPrice'] if not pd.isna(row['StopPrice']) and row['StopPrice'] > 0 else None
        buy_price = row['BuyPrice'] if not pd.isna(row['BuyPrice']) and row['BuyPrice'] > 0 else None

        point = ChartDataPoint(
            date=index.strftime('%Y-%m-%d'),
            open=row['Open'],
            high=row['High'],
            low=row['Low'],
            close=row['Close'],
            volume=row['Volume'],
            stop_price=stop_price,
            buy_price=buy_price,
            rsi=_num(row.get('RSI')),
            macd=_num(row.get('MACD')),
            macd_signal=_num(row.get('MACDSignal')),
            macd_hist=_num(row.get('MACDHist')),
        )
        data_points.append(point)

    # Determine currency
    currency = detect_currency(request.ticker)

    # Extract current ATR
    current_atr = 0.0
    if not df_final.empty and 'ATR' in df_final.columns:
        atr_values = df_final['ATR'].dropna()
        if not atr_values.empty:
            current_atr = float(atr_values.iloc[-1])

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


# ---- 워치리스트 요약 (Quotes) ----

# 단순 인메모리 캐시: {symbol: (timestamp, QuoteData)}. 단일 사용자 셀프호스팅 기준.
_QUOTE_CACHE: dict[str, tuple[float, QuoteData]] = {}
_QUOTE_TTL_SEC = 45


def _compute_quote(ticker: str, df: pd.DataFrame) -> QuoteData:
    """단일 종목 OHLC DataFrame → QuoteData (price, change_pct, rsi, macd_hist)."""
    df = df.dropna(subset=['Close'])
    if df.empty:
        return QuoteData(ticker=ticker, currency=detect_currency(ticker), error="No data")

    df = calculate_rsi(df, 14)
    df = calculate_macd(df)
    last = df.iloc[-1]

    price = float(last['Close'])
    change_pct = None
    if len(df) >= 2:
        prev = float(df['Close'].iloc[-2])
        if prev:
            change_pct = (price / prev - 1) * 100

    def _num(v):
        if v is None or pd.isna(v) or np.isinf(v):
            return None
        return float(v)

    return QuoteData(
        ticker=ticker,
        price=price,
        change_pct=change_pct,
        rsi=_num(last.get('RSI')),
        macd_hist=_num(last.get('MACDHist')),
        currency=detect_currency(ticker),
    )


def fetch_quotes(tickers: list[str]) -> list[QuoteData]:
    """여러 종목의 요약 지표를 반환. 캐시 미스 종목만 yf.download 배치 1회로 조회."""
    now = time.time()
    results: dict[str, QuoteData] = {}
    to_fetch: list[str] = []

    for t in tickers:
        cached = _QUOTE_CACHE.get(t)
        if cached and now - cached[0] < _QUOTE_TTL_SEC:
            results[t] = cached[1]
        else:
            to_fetch.append(t)

    if to_fetch:
        # 요청 원본 티커 → yfinance 심볼 매핑 (숫자 → .KS)
        symbol_map = {t: resolve_symbol(t) for t in to_fetch}
        symbols = list(symbol_map.values())
        try:
            raw = yf.download(
                symbols,
                period="6mo",
                interval="1d",
                group_by="ticker",
                auto_adjust=True,
                progress=False,
                threads=True,
            )
        except Exception as e:  # noqa: BLE001 — 배치 전체 실패 시 종목별 에러로 표기
            raw = None
            batch_error = str(e)
        else:
            batch_error = None

        for t in to_fetch:
            sym = symbol_map[t]
            try:
                if raw is None:
                    quote = QuoteData(ticker=t, currency=detect_currency(t), error=batch_error or "fetch failed")
                else:
                    # yf.download는 group_by="ticker" 시 종목 수와 무관하게 MultiIndex 컬럼을
                    # 반환할 수 있다. 심볼 레벨이 있으면 해당 서브프레임, 없으면 평면 사용.
                    if isinstance(raw.columns, pd.MultiIndex):
                        df = raw[sym] if sym in raw.columns.get_level_values(0) else pd.DataFrame()
                    else:
                        df = raw
                    if df is None or df.empty:
                        quote = QuoteData(ticker=t, currency=detect_currency(t), error="No data")
                    else:
                        quote = _compute_quote(t, df)
            except Exception as e:  # noqa: BLE001
                quote = QuoteData(ticker=t, currency=detect_currency(t), error=str(e))

            # 성공한 조회만 캐시 (에러는 매번 재시도)
            if quote.error is None:
                _QUOTE_CACHE[t] = (now, quote)
            results[t] = quote

    # 요청 순서 보존
    return [results[t] for t in tickers]
