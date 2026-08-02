from __future__ import annotations

import random
from ..models.player import Player, ActiveInjury, InjuryRecord


class InjurySystem:
    """Injury probability, generation, healing, and record-keeping."""

    def check_injury(
        self, player: Player, play_type: str, intensity: float = 1.0
    ) -> ActiveInjury | None:
        """Roll for an injury during a play. Returns an injury or None."""
        return None

    def generate_injury(
        self, player: Player, body_part: str
    ) -> ActiveInjury:
        """Create a new active injury for the given body part."""
        return ActiveInjury(
            body_part=body_part,
            injury_type="strain",
            severity="minor",
            games_remaining=0,
            date_injured="",
        )

    def determine_severity(self, player: Player, body_part: str) -> str:
        """Determine injury severity based on player durability and body part."""
        return "minor"

    def calculate_games_out(self, severity: str, body_part: str) -> int:
        """Return the number of games a player will miss for a given injury."""
        return 0

    def update_injuries(self, players: list[Player]) -> list[dict]:
        """Advance healing for all injured players by one game day. Returns status updates."""
        return []

    def heal_player(self, player: Player) -> bool:
        """Attempt to clear a player's injury. Returns True if fully healed."""
        return False

    def get_injury_probability(
        self, player: Player, play_type: str
    ) -> float:
        """Calculate the base probability of injury for a play type."""
        return 0.0

    def record_injury(
        self, player: Player, injury: ActiveInjury, season_year: int
    ) -> InjuryRecord:
        """Convert an active injury into a permanent history record."""
        return InjuryRecord(
            injury_type=injury.injury_type,
            severity=injury.severity,
            body_part=injury.body_part,
            games_out=injury.games_remaining,
            season_year=season_year,
        )
