"""Tests for calculate_profit_targets."""
from app.services import calculate_profit_targets


class TestCalculateProfitTargets:
    def test_returns_5_levels(self):
        targets = calculate_profit_targets(
            entry_price=100.0, first_tp_price=150.0, current_atr=5.0, first_tp_ratio=0.5
        )
        assert len(targets) == 5

    def test_level_1_matches_first_tp(self):
        targets = calculate_profit_targets(
            entry_price=100.0, first_tp_price=150.0, current_atr=5.0, first_tp_ratio=0.5
        )
        assert targets[0].level == 1
        assert targets[0].target_price == 150.0
        assert targets[0].sell_ratio == 0.5

    def test_level_1_with_25pct_ratio(self):
        targets = calculate_profit_targets(
            entry_price=100.0, first_tp_price=150.0, current_atr=5.0, first_tp_ratio=0.25
        )
        assert targets[0].sell_ratio == 0.25

    def test_subsequent_levels_increment_by_10pct(self):
        targets = calculate_profit_targets(
            entry_price=100.0, first_tp_price=150.0, current_atr=5.0, first_tp_ratio=0.5
        )
        # Level 2: 150 + 1*10 = 160
        assert targets[1].target_price == 160.0
        # Level 3: 150 + 2*10 = 170
        assert targets[2].target_price == 170.0
        # Level 4: 150 + 3*10 = 180
        assert targets[3].target_price == 180.0
        # Level 5: 150 + 4*10 = 190
        assert targets[4].target_price == 190.0

    def test_sell_ratios_sum_to_approximately_1(self):
        targets = calculate_profit_targets(
            entry_price=100.0, first_tp_price=150.0, current_atr=5.0, first_tp_ratio=0.5
        )
        total = sum(t.sell_ratio for t in targets)
        # Won't be exactly 1.0 because we sell 1/4 of remaining each time
        # 0.5 + 0.125 + 0.09375 + 0.0703125 + 0.052734375 ≈ 0.8418
        assert 0.8 < total < 1.0

    def test_pct_from_entry_correct(self):
        targets = calculate_profit_targets(
            entry_price=100.0, first_tp_price=150.0, current_atr=5.0, first_tp_ratio=0.5
        )
        assert targets[0].pct_from_entry == 0.5  # (150/100) - 1

    def test_atr_multiple_correct(self):
        targets = calculate_profit_targets(
            entry_price=100.0, first_tp_price=150.0, current_atr=5.0, first_tp_ratio=0.5
        )
        assert targets[0].atr_multiple == 10.0  # (150-100)/5

    def test_zero_atr_no_division_error(self):
        targets = calculate_profit_targets(
            entry_price=100.0, first_tp_price=150.0, current_atr=0.0, first_tp_ratio=0.5
        )
        assert targets[0].atr_multiple == 0
