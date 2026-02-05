"""Tests for simulate_position_sizing."""
import pandas as pd
import numpy as np
import pytest
from app.models import ProfitTargetLevel
from app.services import simulate_position_sizing


def make_df(rows, tz=None):
    """Helper: create a DataFrame from list of (date, open, high, low, close) tuples."""
    dates = pd.DatetimeIndex([r[0] for r in rows])
    if tz:
        dates = dates.tz_localize(tz)
    return pd.DataFrame(
        {
            "Open": [r[1] for r in rows],
            "High": [r[2] for r in rows],
            "Low": [r[3] for r in rows],
            "Close": [r[4] for r in rows],
            "Volume": [1_000_000] * len(rows),
        },
        index=dates,
    )


def make_target(level, price, sell_ratio=0.5):
    return ProfitTargetLevel(
        level=level,
        target_price=price,
        pct_from_entry=0.0,
        atr_multiple=0.0,
        sell_ratio=sell_ratio,
    )


class TestSimulatePositionSizing:
    def test_no_sells_when_price_stays_flat(self):
        df = make_df([
            ("2025-01-02", 100, 105, 95, 100),
            ("2025-01-03", 100, 105, 95, 100),
            ("2025-01-06", 100, 105, 95, 100),
        ])
        targets = [make_target(1, 150)]
        stop_prices = np.zeros(3)

        sells = simulate_position_sizing(df, 100.0, "2025-01-02", targets, stop_prices)
        assert len(sells) == 0

    def test_stop_loss_triggers(self):
        df = make_df([
            ("2025-01-02", 100, 105, 95, 100),
            ("2025-01-03", 100, 102, 89, 90),  # Low=89 <= stop=90
        ])
        targets = [make_target(1, 150)]
        stop_prices = np.array([90.0, 90.0])

        sells = simulate_position_sizing(df, 100.0, "2025-01-02", targets, stop_prices)
        assert len(sells) == 1
        assert sells[0].level == 0  # stop-loss
        assert sells[0].remaining == 0.0

    def test_tp1_triggers(self):
        df = make_df([
            ("2025-01-02", 100, 105, 95, 100),
            ("2025-01-03", 100, 155, 100, 150),  # High=155 >= target=150
        ])
        targets = [make_target(1, 150, sell_ratio=0.5)]
        stop_prices = np.array([80.0, 80.0])

        sells = simulate_position_sizing(df, 100.0, "2025-01-02", targets, stop_prices)
        assert len(sells) == 1
        assert sells[0].level == 1
        assert sells[0].ratio == 0.5
        assert sells[0].remaining == 0.5

    def test_stop_loss_checked_before_tp(self):
        """If both stop and TP hit on the same candle, stop-loss takes priority."""
        df = make_df([
            ("2025-01-02", 100, 160, 85, 100),  # High>=150(TP), Low<=90(stop)
        ])
        targets = [make_target(1, 150)]
        stop_prices = np.array([90.0])

        sells = simulate_position_sizing(df, 100.0, "2025-01-02", targets, stop_prices)
        assert len(sells) == 1
        assert sells[0].level == 0  # stop-loss, not TP

    def test_multiple_tps_on_same_day(self):
        """If high is above multiple targets, sell at each in sequence."""
        df = make_df([
            ("2025-01-02", 100, 200, 95, 190),  # High=200 >= both TP1=120, TP2=140
        ])
        targets = [
            make_target(1, 120, sell_ratio=0.5),
            make_target(2, 140, sell_ratio=0.125),
        ]
        stop_prices = np.array([80.0])

        sells = simulate_position_sizing(df, 100.0, "2025-01-02", targets, stop_prices)
        assert len(sells) == 2
        assert sells[0].level == 1
        assert sells[1].level == 2

    def test_entry_date_skips_earlier_data(self):
        df = make_df([
            ("2025-01-02", 100, 200, 95, 100),  # TP would trigger here
            ("2025-01-03", 100, 105, 95, 100),  # but we start here
            ("2025-01-06", 100, 105, 95, 100),
        ])
        targets = [make_target(1, 150)]
        stop_prices = np.zeros(3)

        sells = simulate_position_sizing(df, 100.0, "2025-01-03", targets, stop_prices)
        assert len(sells) == 0  # TP was only on Jan 2, which we skip

    def test_entry_date_after_all_data(self):
        df = make_df([
            ("2025-01-02", 100, 200, 95, 100),
        ])
        targets = [make_target(1, 150)]
        stop_prices = np.zeros(1)

        sells = simulate_position_sizing(df, 100.0, "2026-01-01", targets, stop_prices)
        assert len(sells) == 0

    def test_timezone_aware_index(self):
        """Should work with timezone-aware DatetimeIndex (like yfinance)."""
        df = make_df(
            [
                ("2025-01-02", 100, 105, 95, 100),
                ("2025-01-03", 100, 160, 95, 155),  # TP hit
            ],
            tz="America/New_York",
        )
        targets = [make_target(1, 150)]
        stop_prices = np.array([80.0, 80.0])

        sells = simulate_position_sizing(df, 100.0, "2025-01-03", targets, stop_prices)
        assert len(sells) == 1
        assert sells[0].level == 1

    def test_remaining_position_tracks_correctly(self):
        df = make_df([
            ("2025-01-02", 100, 125, 95, 120),   # TP1 hit (sell 50%)
            ("2025-01-03", 120, 145, 115, 140),   # TP2 hit (sell 12.5%)
            ("2025-01-06", 140, 142, 100, 105),   # stop hit (sell remaining)
        ])
        targets = [
            make_target(1, 120, sell_ratio=0.5),
            make_target(2, 140, sell_ratio=0.125),
        ]
        stop_prices = np.array([0.0, 0.0, 110.0])

        sells = simulate_position_sizing(df, 100.0, "2025-01-02", targets, stop_prices)
        assert len(sells) == 3
        # After TP1: 50% remaining
        assert sells[0].remaining == pytest.approx(0.5)
        # After TP2: 50% - 12.5% = 37.5% remaining
        assert sells[1].remaining == pytest.approx(0.375)
        # After stop: 0%
        assert sells[2].remaining == 0.0
        assert sells[2].ratio == pytest.approx(0.375)
