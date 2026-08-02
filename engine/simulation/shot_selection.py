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


class ShotSelector:
    """Resolves shot selection across a 14-zone shot chart."""

    def __init__(self, player: Player):
        self.player = player

    def select_zone(
        self, play_type: str, shot_clock: float, is_contested: bool
    ) -> str:
        """Choose the shot zone based on play context and player tendencies."""
        return "midrange_center"

    def get_zone_probability(
        self,
        zone_id: str,
        defender_rating: int,
        fatigue: float,
        is_home: bool,
    ) -> float:
        """Return the adjusted make probability for a given zone."""
        return 0.0

    @staticmethod
    def get_skill_for_zone(zone_id: str) -> str:
        """Map a zone id to the relevant player rating attribute."""
        return "mid_range"

    @staticmethod
    def is_three_pointer(zone_id: str) -> bool:
        """Return True if the zone is behind the three-point line."""
        return False

    @staticmethod
    def is_paint_shot(zone_id: str) -> bool:
        """Return True if the zone is in the paint."""
        return False

    @staticmethod
    def is_midrange(zone_id: str) -> bool:
        """Return True if the zone is in the midrange area."""
        return False
