import yfinance as yf
import pandas as pd
import numpy as np
from app.models import AnalyzeRequest, ChartDataPoint, AnalyzeResponse

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
    # If ticker ends with .KS or .KQ, it's KRW.
    # Note: If input was numeric "005930", fetch_stock_data converts it to "005930.KS" internally, but here request.ticker is still the original input?
    # Actually fetch_stock_data returns a dataframe, it doesn't return the modified ticker string.
    # We should re-evaluate the ticker format logic or check the input `request.ticker`.
    
    currency = "USD"
    ticker_upper = request.ticker.upper()
    if ticker_upper.endswith(".KS") or ticker_upper.endswith(".KQ") or request.ticker.isdigit():
        currency = "KRW"
        
    return AnalyzeResponse(
        ticker=request.ticker,
        period=request.period,
        multiplier=request.multiplier,
        currency=currency,
        interval=request.interval,
        data=data_points
    )
