from __future__ import annotations

from ..models.player import Player


class FatigueSystem:
    """Player fatigue tracking and its effects on performance."""

    BASE_FATIGUE_PER_MINUTE: float = 0.012
    RECOVERY_RATE_PER_MINUTE: float = 0.025

    def update_fatigue(
        self, player: Player, minutes_played: float, intensity: float = 1.0
    ) -> float:
        """Increase a player's fatigue based on minutes and intensity. Returns new fatigue value."""
        return 0.0

    def recover_fatigue(
        self, player: Player, minutes_resting: float
    ) -> float:
        """Reduce a player's fatigue after resting. Returns new fatigue value."""
        return 0.0

    def get_fatigue_penalty(self, player: Player) -> dict[str, float]:
        """Return per-attribute penalty multipliers based on current fatigue."""
        return {}

    def should_substitute(
        self, player: Player, quarter: int, foul_count: int
    ) -> bool:
        """Decide if a player should be substituted out due to fatigue or fouls."""
        return False

    def reset_fatigue(self, player: Player) -> None:
        """Reset a player's fatigue to zero (e.g., between games)."""
        pass

    def apply_back_to_back_penalty(self, player: Player) -> float:
        """Apply additional fatigue for back-to-back game scenarios. Returns penalty value."""
        return 0.0
