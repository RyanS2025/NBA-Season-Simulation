from __future__ import annotations

import math
from ..models.player import Player
from ..models.game import GameContext


class FatigueSystem:
    """Player fatigue with schedule awareness, position-based drain, and age effects."""

    BASE_FATIGUE_PER_POSSESSION: float = 0.004
    RECOVERY_PER_POSSESSION_BENCH: float = 0.006

    POSITION_INTENSITY: dict[str, float] = {
        "PG": 1.10,
        "SG": 1.05,
        "SF": 1.00,
        "PF": 1.05,
        "C": 1.12,
    }

    def apply_pregame_fatigue(self, player: Player, context: GameContext) -> float:
        """Set baseline fatigue before tipoff based on schedule context."""
        base = 0.0

        if context.is_second_of_back_to_back:
            base += 0.15 * (1.0 - player.ratings.stamina / 250.0)
        elif context.is_back_to_back:
            base += 0.08 * (1.0 - player.ratings.stamina / 250.0)

        if context.days_rest == 0:
            base += 0.05
        elif context.days_rest >= 3:
            base -= 0.02

        if context.games_in_last_5_days >= 4:
            base += 0.08
        elif context.games_in_last_5_days >= 3:
            base += 0.04

        distance = context.travel_distance
        if distance > 2000:
            base += 0.06
        elif distance > 1000:
            base += 0.04
        elif distance > 500:
            base += 0.02

        if context.altitude_game:
            base += 0.03

        if context.road_trip_length > 4:
            base += 0.02 * (context.road_trip_length - 4)

        age = player.bio.age
        if age >= 35:
            base *= 1.35
        elif age >= 32:
            base *= 1.20
        elif age >= 30:
            base *= 1.10
        elif age <= 23:
            base *= 0.85

        durability_factor = 1.0 - (player.durability.overall_durability / 200.0)
        base *= (1.0 + durability_factor * 0.3)

        player.status.fatigue = max(0.0, min(0.35, base))
        return player.status.fatigue

    def update_fatigue_possession(
        self, player: Player, is_on_offense: bool, intensity: float = 1.0
    ) -> float:
        """Update fatigue after a single possession of play."""
        pos_mult = self.POSITION_INTENSITY.get(player.bio.position, 1.0)
        stamina_factor = 1.0 - (player.ratings.stamina / 200.0)

        drain = self.BASE_FATIGUE_PER_POSSESSION * pos_mult * stamina_factor * intensity

        if is_on_offense:
            drain *= 0.95
        else:
            drain *= 1.05

        age = player.bio.age
        if age >= 35:
            drain *= 1.25
        elif age >= 32:
            drain *= 1.12
        elif age <= 22:
            drain *= 0.90

        current = player.status.fatigue
        if current > 0.7:
            drain *= 1.3
        elif current > 0.5:
            drain *= 1.1

        player.status.fatigue = min(1.0, current + drain)
        return player.status.fatigue

    def recover_fatigue_possession(self, player: Player) -> float:
        """Recover fatigue for one possession of bench rest."""
        stamina_bonus = player.ratings.stamina / 300.0
        recovery = self.RECOVERY_PER_POSSESSION_BENCH * (1.0 + stamina_bonus)

        age = player.bio.age
        if age >= 35:
            recovery *= 0.75
        elif age >= 32:
            recovery *= 0.85
        elif age <= 22:
            recovery *= 1.15

        player.status.fatigue = max(0.0, player.status.fatigue - recovery)
        return player.status.fatigue

    def get_fatigue_penalties(self, player: Player) -> dict[str, float]:
        """Return per-attribute penalty multipliers based on current fatigue."""
        f = player.status.fatigue
        f_sq = f * f

        return {
            "shooting": -(f * 0.08 + f_sq * 0.07),
            "three_point": -(f * 0.10 + f_sq * 0.08),
            "finishing": -(f * 0.06 + f_sq * 0.05),
            "free_throw": -(f * 0.04 + f_sq * 0.03),
            "defense": -(f * 0.07 + f_sq * 0.06),
            "lateral_quickness": -(f * 0.12 + f_sq * 0.10),
            "speed": -(f * 0.10 + f_sq * 0.08),
            "turnovers": f * 0.06 + f_sq * 0.04,
            "rebounding": -(f * 0.05 + f_sq * 0.04),
            "passing": -(f * 0.04 + f_sq * 0.03),
            "defensive_iq": -(f * 0.06 + f_sq * 0.05),
            "vertical": -(f * 0.08 + f_sq * 0.06),
        }

    def get_effective_rating(self, player: Player, attribute: str) -> float:
        """Get a rating adjusted for fatigue."""
        base = getattr(player.ratings, attribute, 50)
        penalties = self.get_fatigue_penalties(player)

        penalty_key = attribute
        for key in penalties:
            if key in attribute or attribute in key:
                penalty_key = key
                break

        modifier = penalties.get(penalty_key, 0.0)
        return max(1.0, base * (1.0 + modifier))

    def should_substitute(
        self,
        player: Player,
        quarter: int,
        foul_count: int,
        minutes_played: float,
        score_diff: int,
        is_playoff: bool = False,
    ) -> bool:
        """Decide if a player should be substituted out."""
        star = player.ratings.overall >= 88
        superstar = player.ratings.overall >= 93

        fatigue_threshold = 0.75
        if is_playoff:
            fatigue_threshold = 0.85
        if superstar:
            fatigue_threshold += 0.05

        if player.status.fatigue > fatigue_threshold:
            return True

        if foul_count >= 6:
            return True
        if foul_count >= 5 and quarter <= 3:
            if not (superstar and quarter == 3 and abs(score_diff) <= 5):
                return True
        if foul_count >= 4 and quarter <= 2:
            if not star:
                return True
        if foul_count >= 3 and quarter == 1:
            return True

        if not is_playoff:
            if minutes_played >= 38 and not star:
                return True
            if minutes_played >= 42:
                return True
        else:
            if minutes_played >= 44 and not superstar:
                return True

        if abs(score_diff) >= 25 and quarter == 4 and star:
            return True

        return False

    def get_minutes_target(
        self,
        player: Player,
        roster_rank: int,
        is_playoff: bool = False,
        pregame_fatigue: float = 0.0,
    ) -> float:
        """Target minutes for this player this game."""
        if is_playoff:
            targets = [40, 38, 36, 28, 24, 18, 14, 10, 0, 0, 0, 0, 0, 0, 0]
        else:
            targets = [34, 33, 32, 30, 28, 22, 18, 14, 10, 6, 3, 0, 0, 0, 0]

        idx = min(roster_rank, len(targets) - 1)
        base = float(targets[idx])

        if pregame_fatigue > 0.15:
            base *= 0.85
        elif pregame_fatigue > 0.10:
            base *= 0.92

        age = player.bio.age
        if age >= 35:
            base *= 0.88
        elif age >= 33:
            base *= 0.93

        return round(base, 1)

    def reset_fatigue(self, player: Player) -> None:
        """Reset fatigue between games."""
        player.status.fatigue = 0.0
