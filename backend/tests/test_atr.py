"""Tests for ATR trailing stop calculation."""
import numpy as np
from app.services import calculate_atr_trailing_stop


class TestCalculateAtrTrailingStop:
    def test_output_columns(self, sample_df):
        result = calculate_atr_trailing_stop(sample_df, period=14, multiplier=2.5)
        assert "ATR" in result.columns
        assert "StopPrice" in result.columns
        assert "BasicStop" in result.columns

    def test_atr_positive(self, sample_df):
        result = calculate_atr_trailing_stop(sample_df, period=14, multiplier=2.5)
        atr_valid = result["ATR"].dropna()
        assert (atr_valid > 0).all()

    def test_stop_below_close_initially(self, sample_df):
        """BasicStop should be below Close (Close - ATR*mult)."""
        result = calculate_atr_trailing_stop(sample_df, period=14, multiplier=2.5)
        valid = result.iloc[14:]
        assert (valid["BasicStop"] < valid["Close"]).all()

    def test_ratchet_only_goes_up_in_uptrend(self, sample_df):
        """When prev close > prev stop, stop can only increase or stay flat."""
        result = calculate_atr_trailing_stop(sample_df, period=14, multiplier=2.5)
        stops = result["StopPrice"].values
        closes = result["Close"].values
        for i in range(15, len(result)):
            if closes[i - 1] > stops[i - 1] and stops[i - 1] > 0:
                assert stops[i] >= stops[i - 1], (
                    f"Stop decreased at index {i}: {stops[i]} < {stops[i-1]}"
                )

    def test_stop_resets_after_breach(self, sample_df):
        """When close drops below stop, stop resets to basic stop."""
        result = calculate_atr_trailing_stop(sample_df, period=14, multiplier=2.5)
        stops = result["StopPrice"].values
        closes = result["Close"].values
        basic = result["BasicStop"].values
        for i in range(15, len(result)):
            if closes[i - 1] <= stops[i - 1] and stops[i - 1] > 0:
                assert stops[i] == basic[i]

    def test_higher_multiplier_lower_stop(self, sample_df):
        """Higher multiplier → wider stop (lower stop price)."""
        result_low = calculate_atr_trailing_stop(sample_df, period=14, multiplier=1.0)
        result_high = calculate_atr_trailing_stop(sample_df, period=14, multiplier=5.0)
        # Compare basic stops — higher mult should be lower
        assert (
            result_high["BasicStop"].iloc[-1] < result_low["BasicStop"].iloc[-1]
        )

    def test_preserves_original_df(self, sample_df):
        """Should not mutate the input DataFrame."""
        original_cols = set(sample_df.columns)
        calculate_atr_trailing_stop(sample_df, period=14, multiplier=2.5)
        assert set(sample_df.columns) == original_cols
