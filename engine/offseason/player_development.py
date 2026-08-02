from __future__ import annotations

import random
from typing import Any

from ..models.player import Player, PlayerRatings
from ..models.team import CoachingStaff


# ---------------------------------------------------------------------------
# Rating categories
# ---------------------------------------------------------------------------

# Physical ratings decline faster with age
PHYSICAL_RATINGS = [
    "speed", "acceleration", "lateral_quickness", "vertical",
    "strength", "stamina",
]

# Skill ratings are more durable
SKILL_RATINGS = [
    "finishing", "close_range", "mid_range", "three_point",
    "free_throw", "post_game", "draw_foul", "off_ball_movement",
    "ball_handling", "passing_vision", "passing_accuracy",
    "perimeter_defense", "interior_defense", "shot_blocking",
    "stealing", "defensive_iq", "defensive_consistency",
    "basketball_iq", "offensive_iq", "rebounding",
    "offensive_rebounding", "hustle",
]

ALL_RATINGS = SKILL_RATINGS + PHYSICAL_RATINGS

# Physical ratings get an extra decline multiplier past prime
PHYSICAL_DECLINE_MULTIPLIER = 1.5

# Clamp bounds for individual ratings
RATING_MIN = 25
RATING_MAX = 99


class PlayerDevelopment:
    """Handles offseason player growth, decline, and training camp."""

    # ------------------------------------------------------------------
    # Age curve
    # ------------------------------------------------------------------

    @staticmethod
    def _get_growth_range(age: int) -> tuple[float, float]:
        """Return the (low, high) overall change range for a given age.

        Age curve:
            19-22: +2 to +4
            23-26: +1 to +2
            27-29: -0.5 to +0.5
            30-32: -1 to -2  (note: both negative, low < high numerically
                              means low is the *worst* outcome)
            33+:   -2 to -4  (same convention: -4 is worst, -2 is best)
        """
        if age <= 22:
            return (2.0, 4.0)
        if age <= 26:
            return (1.0, 2.0)
        if age <= 29:
            return (-0.5, 0.5)
        if age <= 32:
            return (-2.0, -1.0)
        # 33+
        return (-4.0, -2.0)

    # ------------------------------------------------------------------
    # Offseason development
    # ------------------------------------------------------------------

    def apply_offseason_development(
        self,
        player: Player,
        coaching_staff: CoachingStaff | None = None,
    ) -> dict:
        """Apply age-curve development and modifiers to a player.

        Returns a summary dict with per-rating deltas and the new overall.
        """
        age = player.bio.age
        low, high = self._get_growth_range(age)
        base_delta = random.uniform(low, high)

        # --- Modifiers ---
        modifier = 0.0

        # Work ethic (0-100 scale, 50 is neutral)
        work_ethic = player.character.work_ethic
        modifier += (work_ethic - 50) / 100.0  # -0.5 to +0.5

        # Coaching quality
        if coaching_staff is not None:
            coach_dev = coaching_staff.head_coach.player_development
            modifier += (coach_dev - 50) / 100.0  # -0.5 to +0.5

        # Potential gap: young players with room to grow get a bonus
        pot_gap = player.ratings.potential - player.ratings.overall
        if pot_gap > 0 and age <= 26:
            modifier += pot_gap * 0.05  # up to ~1.0 for big gaps

        total_delta = base_delta + modifier

        changes: dict[str, int] = {}
        ratings = player.ratings

        for attr in ALL_RATINGS:
            current = getattr(ratings, attr, None)
            if current is None:
                continue

            # Per-rating jitter around total_delta
            jitter = random.uniform(-1.0, 1.0)
            raw_change = total_delta + jitter

            # Physical ratings decline faster for older players
            if attr in PHYSICAL_RATINGS and age >= 30:
                raw_change *= PHYSICAL_DECLINE_MULTIPLIER

            change = int(round(raw_change))
            new_val = max(RATING_MIN, min(RATING_MAX, current + change))
            if new_val != current:
                changes[attr] = new_val - current
                setattr(ratings, attr, new_val)

        # Recalculate overall
        old_overall = ratings.overall
        ratings.overall = self._compute_overall(ratings)
        overall_change = ratings.overall - old_overall

        return {
            "player_id": player.id,
            "player_name": f"{player.bio.first_name} {player.bio.last_name}",
            "age": age,
            "base_delta": round(base_delta, 2),
            "modifier": round(modifier, 2),
            "total_delta": round(total_delta, 2),
            "rating_changes": changes,
            "old_overall": old_overall,
            "new_overall": ratings.overall,
            "overall_change": overall_change,
        }

    # ------------------------------------------------------------------
    # Training camp
    # ------------------------------------------------------------------

    def apply_training_camp(
        self,
        player: Player,
        focus_area: str | None = None,
    ) -> dict:
        """Apply a small training-camp boost, optionally focused on one area.

        Focus areas: 'shooting', 'defense', 'playmaking', 'athleticism',
        'post_game', 'rebounding'.
        """
        focus_map: dict[str, list[str]] = {
            "shooting": ["mid_range", "three_point", "free_throw"],
            "defense": [
                "perimeter_defense", "interior_defense",
                "shot_blocking", "stealing", "defensive_iq",
                "defensive_consistency",
            ],
            "playmaking": [
                "ball_handling", "passing_vision", "passing_accuracy",
                "offensive_iq",
            ],
            "athleticism": [
                "speed", "acceleration", "lateral_quickness",
                "vertical", "stamina",
            ],
            "post_game": ["post_game", "close_range", "strength"],
            "rebounding": ["rebounding", "offensive_rebounding", "hustle"],
        }

        target_attrs = focus_map.get(focus_area, []) if focus_area else []
        changes: dict[str, int] = {}
        ratings = player.ratings

        if target_attrs:
            for attr in target_attrs:
                current = getattr(ratings, attr, None)
                if current is None:
                    continue
                boost = random.randint(0, 2)
                new_val = min(RATING_MAX, current + boost)
                if new_val != current:
                    changes[attr] = new_val - current
                    setattr(ratings, attr, new_val)
        else:
            # General camp: small random boost to 3 random attributes
            sample_attrs = random.sample(ALL_RATINGS, min(3, len(ALL_RATINGS)))
            for attr in sample_attrs:
                current = getattr(ratings, attr, None)
                if current is None:
                    continue
                boost = random.randint(0, 1)
                new_val = min(RATING_MAX, current + boost)
                if new_val != current:
                    changes[attr] = new_val - current
                    setattr(ratings, attr, new_val)

        old_overall = ratings.overall
        ratings.overall = self._compute_overall(ratings)

        return {
            "player_id": player.id,
            "player_name": f"{player.bio.first_name} {player.bio.last_name}",
            "focus_area": focus_area,
            "rating_changes": changes,
            "old_overall": old_overall,
            "new_overall": ratings.overall,
            "overall_change": ratings.overall - old_overall,
        }

    # ------------------------------------------------------------------
    # Overall rating computation
    # ------------------------------------------------------------------

    @staticmethod
    def _compute_overall(ratings: PlayerRatings) -> int:
        """Re-derive the overall rating from component ratings.

        Weighted average across major skill buckets.
        """
        offense = (
            ratings.finishing * 0.12
            + ratings.close_range * 0.06
            + ratings.mid_range * 0.10
            + ratings.three_point * 0.12
            + ratings.free_throw * 0.04
            + ratings.post_game * 0.04
            + ratings.draw_foul * 0.03
            + ratings.off_ball_movement * 0.05
            + ratings.ball_handling * 0.08
            + ratings.passing_vision * 0.06
            + ratings.passing_accuracy * 0.05
        )

        defense = (
            ratings.perimeter_defense * 0.12
            + ratings.interior_defense * 0.10
            + ratings.shot_blocking * 0.06
            + ratings.stealing * 0.06
            + ratings.defensive_iq * 0.08
            + ratings.defensive_consistency * 0.06
        )

        physical = (
            ratings.speed * 0.08
            + ratings.acceleration * 0.06
            + ratings.lateral_quickness * 0.06
            + ratings.vertical * 0.04
            + ratings.strength * 0.06
            + ratings.stamina * 0.06
        )

        intangibles = (
            ratings.basketball_iq * 0.10
            + ratings.offensive_iq * 0.06
            + ratings.rebounding * 0.06
            + ratings.offensive_rebounding * 0.03
            + ratings.hustle * 0.05
        )

        # Weights sum to roughly 2.07 across all buckets; normalise
        raw = offense + defense + physical + intangibles
        # The individual weights intentionally don't sum to 1.0 --
        # each bucket contributes and we rescale.
        total_weight = (
            0.12 + 0.06 + 0.10 + 0.12 + 0.04 + 0.04 + 0.03 + 0.05
            + 0.08 + 0.06 + 0.05
            + 0.12 + 0.10 + 0.06 + 0.06 + 0.08 + 0.06
            + 0.08 + 0.06 + 0.06 + 0.04 + 0.06 + 0.06
            + 0.10 + 0.06 + 0.06 + 0.03 + 0.05
        )
        overall = int(round(raw / total_weight))
        return max(RATING_MIN, min(RATING_MAX, overall))
