from __future__ import annotations

import random
from ..models.player import Player, ShotZone

ZONE_BASE_PERCENTAGES: dict[str, float] = {
    "restricted_area": 0.63,
    "paint_non_ra": 0.40,
    "midrange_left_baseline": 0.41,
    "midrange_left_wing": 0.40,
    "midrange_center": 0.41,
    "midrange_right_wing": 0.40,
    "midrange_right_baseline": 0.41,
    "three_left_corner": 0.39,
    "three_left_wing": 0.36,
    "three_center": 0.36,
    "three_right_wing": 0.36,
    "three_right_corner": 0.39,
    "backcourt": 0.02,
    "post_up": 0.45,
}

_PLAY_TYPE_ZONE_BOOSTS: dict[str, dict[str, float]] = {
    "isolation": {"midrange_center": 1.3, "midrange_left_wing": 1.2, "midrange_right_wing": 1.2},
    "pick_and_roll": {"restricted_area": 1.4, "paint_non_ra": 1.3, "three_left_wing": 1.2, "three_right_wing": 1.2},
    "spot_up": {"three_left_corner": 1.5, "three_right_corner": 1.5, "three_left_wing": 1.3, "three_right_wing": 1.3, "three_center": 1.3},
    "post_up": {"post_up": 2.0, "paint_non_ra": 1.3},
    "transition": {"restricted_area": 1.6, "three_left_wing": 1.2, "three_right_wing": 1.2},
    "cut": {"restricted_area": 1.8, "paint_non_ra": 1.4},
    "catch_and_shoot": {"three_left_corner": 1.4, "three_right_corner": 1.4, "three_left_wing": 1.3, "three_right_wing": 1.3, "three_center": 1.3, "midrange_left_wing": 1.1, "midrange_right_wing": 1.1},
}


class ShotSelector:
    """Resolves shot selection across a 14-zone shot chart."""

    def __init__(self, player: Player):
        self.player = player

    def select_zone(
        self, play_type: str, shot_clock: float, is_contested: bool
    ) -> str:
        """Choose the shot zone based on play context and player tendencies."""
        zones = self.player.shot_chart.zones
        if not zones:
            return "midrange_center"

        boosts = _PLAY_TYPE_ZONE_BOOSTS.get(play_type, {})

        # Low shot clock pressure: shift weight toward zones the player already favors
        shot_clock_pressure = max(0.0, 1.0 - shot_clock / 24.0)

        weights: list[float] = []
        zone_ids: list[str] = []
        for sz in zones:
            w = sz.tendency
            w *= boosts.get(sz.zone_id, 1.0)
            if shot_clock_pressure > 0.5:
                w *= 1.0 + shot_clock_pressure * sz.tendency
            if is_contested:
                if self.is_three_pointer(sz.zone_id):
                    w *= 0.8
                elif self.is_paint_shot(sz.zone_id):
                    w *= 0.85
            weights.append(w)
            zone_ids.append(sz.zone_id)

        total = sum(weights)
        if total <= 0:
            return zones[0].zone_id

        r = random.random() * total
        cumulative = 0.0
        for i, w in enumerate(weights):
            cumulative += w
            if r <= cumulative:
                return zone_ids[i]
        return zone_ids[-1]

    def get_zone_probability(
        self,
        zone_id: str,
        defender_rating: int,
        fatigue: float,
        is_home: bool,
    ) -> float:
        """Return the adjusted make probability for a given zone."""
        base_pct = ZONE_BASE_PERCENTAGES.get(zone_id, 0.35)
        skill_attr = self.get_skill_for_zone(zone_id)
        player_skill = getattr(self.player.ratings, skill_attr, 50)

        skill_mod = 0.5 + (player_skill / 100.0)
        contest = (defender_rating / 100.0) * 0.15
        fatigue_penalty = fatigue * 0.10
        home_bonus = 0.015 if is_home else 0.0

        final = base_pct * skill_mod - contest - fatigue_penalty + home_bonus
        return max(0.05, min(0.85, final))

    @staticmethod
    def get_skill_for_zone(zone_id: str) -> str:
        """Map a zone id to the relevant player rating attribute."""
        if zone_id == "restricted_area":
            return "finishing"
        if zone_id == "paint_non_ra":
            return "close_range"
        if zone_id.startswith("midrange_"):
            return "mid_range"
        if zone_id.startswith("three_"):
            return "three_point"
        if zone_id == "backcourt":
            return "three_point"
        if zone_id == "post_up":
            return "post_game"
        return "mid_range"

    @staticmethod
    def is_three_pointer(zone_id: str) -> bool:
        """Return True if the zone is behind the three-point line."""
        return zone_id.startswith("three_") or zone_id == "backcourt"

    @staticmethod
    def is_paint_shot(zone_id: str) -> bool:
        """Return True if the zone is in the paint."""
        return zone_id in ("restricted_area", "paint_non_ra")

    @staticmethod
    def is_midrange(zone_id: str) -> bool:
        """Return True if the zone is in the midrange area."""
        return zone_id.startswith("midrange_")
