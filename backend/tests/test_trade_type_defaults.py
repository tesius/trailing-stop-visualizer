"""Tests for get_trade_type_defaults."""
import pytest
from app.services import get_trade_type_defaults


class TestGetTradeTypeDefaults:
    def test_type_a_uses_lower_of_pct_and_atr(self):
        # ATR=5, entry=100 → +50%=$150, +10*ATR=$150 → tie → $150
        result = get_trade_type_defaults("A", current_atr=5.0, entry_price=100.0)
        assert result["first_tp_price"] == 150.0

    def test_type_a_atr_cap_wins(self):
        # ATR=3, entry=100 → +50%=$150, +10*ATR=$130 → min=$130
        result = get_trade_type_defaults("A", current_atr=3.0, entry_price=100.0)
        assert result["first_tp_price"] == 130.0

    def test_type_a_pct_cap_wins(self):
        # ATR=20, entry=100 → +50%=$150, +10*ATR=$300 → min=$150
        result = get_trade_type_defaults("A", current_atr=20.0, entry_price=100.0)
        assert result["first_tp_price"] == 150.0

    def test_type_a_defaults(self):
        result = get_trade_type_defaults("A", current_atr=5.0, entry_price=100.0)
        assert result["period"] == 14
        assert result["multiplier"] == 3.0

    def test_type_m(self):
        result = get_trade_type_defaults("M", current_atr=5.0, entry_price=100.0)
        assert result["period"] == 20
        assert result["multiplier"] == 2.5
        assert result["first_tp_price"] == pytest.approx(127.5)
        assert result["first_tp_pct"] == pytest.approx(0.275)

    def test_type_b(self):
        result = get_trade_type_defaults("B", current_atr=5.0, entry_price=100.0)
        assert result["period"] == 22
        assert result["multiplier"] == 2.0
        assert result["first_tp_price"] == pytest.approx(111.0)
        assert result["first_tp_pct"] == pytest.approx(0.11)
