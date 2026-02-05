import pandas as pd
import numpy as np
import pytest


@pytest.fixture
def sample_df():
    """20-day OHLCV DataFrame with naive index (no timezone)."""
    dates = pd.date_range("2025-01-02", periods=20, freq="B")
    np.random.seed(42)
    base = 100.0
    closes = base + np.cumsum(np.random.randn(20) * 2)
    data = {
        "Open": closes - np.random.rand(20),
        "High": closes + np.abs(np.random.randn(20) * 1.5),
        "Low": closes - np.abs(np.random.randn(20) * 1.5),
        "Close": closes,
        "Volume": np.random.randint(1_000_000, 10_000_000, 20),
    }
    return pd.DataFrame(data, index=dates)


@pytest.fixture
def sample_df_tz(sample_df):
    """Same data but with timezone-aware index (America/New_York), like yfinance."""
    return sample_df.tz_localize("America/New_York")


@pytest.fixture
def analyzed_df(sample_df):
    """sample_df after calculate_atr_trailing_stop."""
    from app.services import calculate_atr_trailing_stop
    return calculate_atr_trailing_stop(sample_df, period=14, multiplier=2.5)


@pytest.fixture
def analyzed_df_tz(sample_df_tz):
    """Timezone-aware version after calculate_atr_trailing_stop."""
    from app.services import calculate_atr_trailing_stop
    return calculate_atr_trailing_stop(sample_df_tz, period=14, multiplier=2.5)
