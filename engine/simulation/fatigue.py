from __future__ import annotations

from ..models.player import Player


class FatigueSystem:
    """Player fatigue tracking and its effects on performance."""

    BASE_FATIGUE_PER_MINUTE: float = 0.030
    RECOVERY_RATE_PER_MINUTE: float = 0.025

    def update_fatigue(
        self, player: Player, minutes_played: float, intensity: float = 1.0
    ) -> float:
        """Increase a player's fatigue based on minutes and intensity. Returns new fatigue value."""
        stamina_factor = 1.0 - (player.ratings.stamina / 200.0)
        new_fatigue = player.status.fatigue + (
            self.BASE_FATIGUE_PER_MINUTE * minutes_played * intensity * stamina_factor
        )
        player.status.fatigue = max(0.0, min(1.0, new_fatigue))
        return player.status.fatigue

    def recover_fatigue(
        self, player: Player, minutes_resting: float
    ) -> float:
        """Reduce a player's fatigue after resting. Returns new fatigue value."""
        recovery = self.RECOVERY_RATE_PER_MINUTE * minutes_resting
        stamina_bonus = player.ratings.stamina / 400.0
        new_fatigue = player.status.fatigue - recovery * (1.0 + stamina_bonus)
        player.status.fatigue = max(0.0, new_fatigue)
        return player.status.fatigue

    def get_fatigue_penalty(self, player: Player) -> dict[str, float]:
        """Return per-attribute penalty multipliers based on current fatigue."""
        f = player.status.fatigue
        return {
            "shooting": -(f * 0.10),
            "defense": -(f * 0.08),
            "speed": -(f * 0.12),
            "turnovers": f * 0.05,
            "rebounding": -(f * 0.06),
        }

    def should_substitute(
        self, player: Player, quarter: int, foul_count: int
    ) -> bool:
        """Decide if a player should be substituted out due to fatigue or fouls."""
        if player.status.fatigue > 0.75:
            return True
        if foul_count >= 5:
            return True
        if foul_count >= 4 and quarter <= 3:
            return True
        if player.status.fatigue > 0.60 and quarter <= 3:
            return True
        return False

    def reset_fatigue(self, player: Player) -> None:
        """Reset a player's fatigue to zero (e.g., between games)."""
        player.status.fatigue = 0.0

    def apply_back_to_back_penalty(self, player: Player) -> float:
        """Apply additional fatigue for back-to-back game scenarios. Returns penalty value."""
        penalty = 0.15 * (1.0 - player.ratings.stamina / 200.0)
        player.status.fatigue = min(1.0, player.status.fatigue + penalty)
        return penalty
