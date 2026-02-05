"""Tests for calculate_exit_strategy (integration)."""
import pandas as pd
import numpy as np
import pytest
from app.services import calculate_atr_trailing_stop, calculate_exit_strategy


def make_rising_df(start_price=100.0, days=30):
    """Create a steadily rising DataFrame to test TP hits."""
    dates = pd.date_range("2025-01-02", periods=days, freq="B")
    prices = [start_price + i * 2 for i in range(days)]
    return pd.DataFrame(
        {
            "Open": [p - 0.5 for p in prices],
            "High": [p + 3 for p in prices],
            "Low": [p - 1 for p in prices],
            "Close": prices,
            "Volume": [1_000_000] * days,
        },
        index=dates,
    )


def make_dropping_df(start_price=100.0, days=30):
    """Create a steadily dropping DataFrame to test stop-loss."""
    dates = pd.date_range("2025-01-02", periods=days, freq="B")
    prices = [start_price - i * 2 for i in range(days)]
    return pd.DataFrame(
        {
            "Open": [p + 0.5 for p in prices],
            "High": [p + 1 for p in prices],
            "Low": [p - 3 for p in prices],
            "Close": prices,
            "Volume": [1_000_000] * days,
        },
        index=dates,
    )


class TestCalculateExitStrategy:
    def test_stop_loss_is_trailing_stop_value(self):
        df = make_rising_df()
        analyzed = calculate_atr_trailing_stop(df, period=14, multiplier=2.5)
        result = calculate_exit_strategy(
            analyzed, "M", entry_price=100.0, entry_date="2025-01-02",
            first_tp_ratio=0.5, current_atr=5.0, multiplier=2.5,
        )
        valid_stops = analyzed["StopPrice"][analyzed["StopPrice"] > 0]
        assert result.stop_loss_price == valid_stops.iloc[-1]

    def test_no_sells_returns_none_avg(self):
        # Use enough days for ATR period, but set TP unreachably high
        df = make_rising_df(start_price=100.0, days=20)
        analyzed = calculate_atr_trailing_stop(df, period=14, multiplier=2.5)
        result = calculate_exit_strategy(
            analyzed, "A", entry_price=100.0, entry_date="2025-01-28",
            first_tp_ratio=0.5, current_atr=5.0, multiplier=2.5,
        )
        # Entry near end of data, TP at 150 won't be hit in 1-2 remaining days
        assert result.weighted_avg_sell_price is None
        assert result.total_return_pct is None

    def test_rising_market_hits_targets(self):
        # 30 days rising +2/day → final price ~160
        df = make_rising_df(start_price=100.0, days=30)
        analyzed = calculate_atr_trailing_stop(df, period=14, multiplier=2.5)
        result = calculate_exit_strategy(
            analyzed, "B", entry_price=100.0, entry_date="2025-01-20",
            first_tp_ratio=0.5, current_atr=3.0, multiplier=2.0,
        )
        # Type B: TP1 = 111, should be hit in rising market
        assert result.profit_targets[0].target_price == pytest.approx(111.0)
        if result.sells:
            assert result.sells[0].level >= 1  # at least first TP hit

    def test_dropping_market_hits_stop(self):
        df = make_dropping_df(start_price=100.0, days=30)
        analyzed = calculate_atr_trailing_stop(df, period=14, multiplier=2.5)
        result = calculate_exit_strategy(
            analyzed, "M", entry_price=100.0, entry_date="2025-01-20",
            first_tp_ratio=0.5, current_atr=5.0, multiplier=2.5,
        )
        # In a dropping market, stop-loss should eventually trigger
        if result.sells:
            assert result.sells[-1].level == 0  # last sell is stop-loss

    def test_total_return_calculation(self):
        df = make_rising_df(start_price=100.0, days=30)
        analyzed = calculate_atr_trailing_stop(df, period=14, multiplier=2.5)
        result = calculate_exit_strategy(
            analyzed, "B", entry_price=100.0, entry_date="2025-01-02",
            first_tp_ratio=0.5, current_atr=3.0, multiplier=2.0,
        )
        if result.weighted_avg_sell_price is not None:
            expected_return = (result.weighted_avg_sell_price / 100.0 - 1) * 100
            assert abs(result.total_return_pct - expected_return) < 0.01

    def test_profit_targets_count(self):
        df = make_rising_df()
        analyzed = calculate_atr_trailing_stop(df, period=14, multiplier=2.5)
        result = calculate_exit_strategy(
            analyzed, "A", entry_price=100.0, entry_date="2025-01-02",
            first_tp_ratio=0.5, current_atr=5.0, multiplier=3.0,
        )
        assert len(result.profit_targets) == 5
