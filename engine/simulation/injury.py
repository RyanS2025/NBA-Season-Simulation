from __future__ import annotations

import random
from ..models.player import Player, ActiveInjury, InjuryRecord

BODY_PART_WEIGHTS = {
    "drive": [("ankle", 0.30), ("knee", 0.30), ("foot", 0.20), ("soft_tissue", 0.20)],
    "cut": [("ankle", 0.30), ("knee", 0.30), ("foot", 0.20), ("soft_tissue", 0.20)],
    "post_up": [("back", 0.30), ("shoulder", 0.25), ("knee", 0.25), ("wrist_hand", 0.20)],
}
DEFAULT_BODY_PART_WEIGHTS = [("soft_tissue", 0.30), ("ankle", 0.25), ("knee", 0.25), ("foot", 0.20)]

INJURY_TYPE_MAP = {
    "ankle": "sprain",
    "knee": "strain",
    "shoulder": "strain",
    "back": "soreness",
    "wrist_hand": "sprain",
    "foot": "soreness",
    "concussion": "concussion",
    "soft_tissue": "strain",
}

DURABILITY_MAP = {
    "ankle": "ankle_health",
    "knee": "knee_health",
    "shoulder": "shoulder_health",
    "back": "back_health",
    "wrist_hand": "wrist_hand_health",
    "foot": "foot_health",
    "concussion": "concussion_risk",
    "soft_tissue": "soft_tissue_risk",
}

BODY_PART_MULTIPLIER = {
    "knee": 1.3,
    "back": 1.3,
    "ankle": 1.0,
    "foot": 1.0,
    "shoulder": 0.9,
    "wrist_hand": 0.9,
    "concussion": 0.8,
    "soft_tissue": 0.7,
}

PLAY_TYPE_MODIFIER = {
    "drive": 1.5,
    "cut": 1.3,
    "post_up": 1.2,
    "transition": 1.4,
}


class InjurySystem:
    def check_injury(
        self, player: Player, play_type: str, intensity: float = 1.0
    ) -> ActiveInjury | None:
        base_prob = self.get_injury_probability(player, play_type) * intensity
        if random.random() < base_prob:
            weights = BODY_PART_WEIGHTS.get(play_type, DEFAULT_BODY_PART_WEIGHTS)
            parts, probs = zip(*weights)
            body_part = random.choices(parts, weights=probs, k=1)[0]
            return self.generate_injury(player, body_part)
        return None

    def generate_injury(self, player: Player, body_part: str) -> ActiveInjury:
        severity = self.determine_severity(player, body_part)
        games_out = self.calculate_games_out(severity, body_part)
        injury_type = INJURY_TYPE_MAP.get(body_part, "strain")
        return ActiveInjury(
            body_part=body_part,
            injury_type=injury_type,
            severity=severity,
            games_remaining=games_out,
            date_injured="",
        )

    def determine_severity(self, player: Player, body_part: str) -> str:
        attr_name = DURABILITY_MAP.get(body_part)
        health = getattr(player.durability, attr_name, player.durability.overall_durability) if attr_name else player.durability.overall_durability
        roll = random.random()

        if health > 80:
            if roll < 0.70:
                return "minor"
            if roll < 0.92:
                return "moderate"
            if roll < 0.98:
                return "severe"
            return "season_ending"
        if health > 50:
            if roll < 0.55:
                return "minor"
            if roll < 0.82:
                return "moderate"
            if roll < 0.95:
                return "severe"
            return "season_ending"
        if roll < 0.40:
            return "minor"
        if roll < 0.70:
            return "moderate"
        if roll < 0.90:
            return "severe"
        return "season_ending"

    def calculate_games_out(self, severity: str, body_part: str) -> int:
        ranges = {
            "minor": (1, 5),
            "moderate": (8, 20),
            "severe": (25, 45),
            "season_ending": (50, 82),
        }
        lo, hi = ranges.get(severity, (1, 5))
        games = random.randint(lo, hi)
        multiplier = BODY_PART_MULTIPLIER.get(body_part, 1.0)
        return int(games * multiplier)

    def update_injuries(self, players: list[Player]) -> list[dict]:
        updates = []
        for player in players:
            if player.status.current_injury is None:
                continue
            player.status.current_injury.games_remaining -= 1
            healed = player.status.current_injury.games_remaining <= 0
            if healed:
                self.heal_player(player)
            updates.append({
                "player_id": player.id,
                "healed": healed,
                "games_remaining": 0 if healed else player.status.current_injury.games_remaining,
            })
        return updates

    def heal_player(self, player: Player) -> bool:
        player.status.current_injury = None
        player.status.health = "healthy"
        return True

    def get_injury_probability(self, player: Player, play_type: str) -> float:
        base = 0.002
        play_modifier = PLAY_TYPE_MODIFIER.get(play_type, 1.0)
        durability_factor = 1.0 - (player.durability.overall_durability / 200)
        age_factor = max(1.0, (player.bio.age - 28) * 0.08 + 1.0)
        fatigue_factor = 1.0 + player.status.fatigue * 0.5
        return base * play_modifier * durability_factor * age_factor * fatigue_factor

    def record_injury(
        self, player: Player, injury: ActiveInjury, season_year: int
    ) -> InjuryRecord:
        return InjuryRecord(
            injury_type=injury.injury_type,
            severity=injury.severity,
            body_part=injury.body_part,
            games_out=injury.games_remaining,
            season_year=season_year,
        )
