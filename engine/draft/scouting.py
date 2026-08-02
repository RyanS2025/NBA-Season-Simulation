from __future__ import annotations

import random
from typing import Any

from .prospect_generator import (
    OFFENSIVE_RATINGS,
    DEFENSIVE_RATINGS,
    ATHLETIC_RATINGS,
    RATING_FIELDS,
)

# Uncertainty ranges by scout level
UNCERTAINTY_BY_LEVEL: dict[int, dict[str, int]] = {
    0: {"overall": 12, "individual": 15},
    1: {"overall": 8, "individual": 10},
    2: {"overall": 5, "individual": 7},
    3: {"overall": 3, "individual": 4},
}

# Play-style descriptors based on primary strengths
PLAYSTYLE_DESCRIPTORS: list[dict[str, Any]] = [
    {
        "check": lambda r: r.get("three_point", 0) >= 75 and r.get("ball_handling", 0) >= 70,
        "desc": "Scoring guard with elite shot creation",
    },
    {
        "check": lambda r: r.get("three_point", 0) >= 75 and r.get("off_ball_movement", 0) >= 70,
        "desc": "Lethal off-ball shooter who can light it up from deep",
    },
    {
        "check": lambda r: r.get("passing_vision", 0) >= 75 and r.get("ball_handling", 0) >= 70,
        "desc": "Crafty playmaker who makes everyone around him better",
    },
    {
        "check": lambda r: r.get("finishing", 0) >= 78 and r.get("speed", 0) >= 75,
        "desc": "Athletic slasher who attacks the rim relentlessly",
    },
    {
        "check": lambda r: r.get("interior_defense", 0) >= 75 and r.get("shot_blocking", 0) >= 75,
        "desc": "Rim-protecting anchor who alters shots at the basket",
    },
    {
        "check": lambda r: r.get("rebounding", 0) >= 75 and r.get("strength", 0) >= 75,
        "desc": "Physical big man who controls the glass on both ends",
    },
    {
        "check": lambda r: r.get("perimeter_defense", 0) >= 75 and r.get("stealing", 0) >= 70,
        "desc": "Lockdown perimeter defender with quick hands",
    },
    {
        "check": lambda r: r.get("post_game", 0) >= 72 and r.get("close_range", 0) >= 72,
        "desc": "Skilled post scorer with a polished inside game",
    },
    {
        "check": lambda r: r.get("speed", 0) >= 78 and r.get("vertical", 0) >= 78,
        "desc": "Electric athlete who plays above the rim",
    },
    {
        "check": lambda r: r.get("basketball_iq", 0) >= 75 and r.get("hustle", 0) >= 75,
        "desc": "High-IQ glue guy who does all the little things",
    },
]

DEFAULT_COMPARISON = "Versatile two-way player with a well-rounded game"


def _clamp(value: int, lo: int = 30, hi: int = 99) -> int:
    return max(lo, min(hi, value))


class ScoutingSystem:
    """Manages scouting of draft prospects.

    Each team can invest scouting resources into individual prospects to
    reduce the uncertainty in their evaluations.  At scout_level 0 the
    user sees noisy projections; at level 3 the picture is very clear.
    """

    def __init__(self, prospects: list[dict]) -> None:
        self.prospects: dict[str, dict] = {p["id"]: p for p in prospects}
        # team_id -> prospect_id -> scout_level
        self._scout_levels: dict[str, dict[str, int]] = {}

    # ------------------------------------------------------------------
    # Scouting reports
    # ------------------------------------------------------------------

    def get_scouting_report(
        self,
        prospect_id: str,
        scout_level: int = 0,
    ) -> dict:
        """Generate a scouting report for *prospect_id*.

        Parameters
        ----------
        prospect_id:
            The prospect to evaluate.
        scout_level:
            0 = no scouting (wide uncertainty),
            1 = light, 2 = moderate, 3 = heavy.

        Returns a dict with projected_overall (range), projected_ceiling,
        projected_floor, strengths, weaknesses, and comparison_player.
        """
        prospect = self.prospects.get(prospect_id)
        if prospect is None:
            return {"error": f"Unknown prospect {prospect_id}"}

        level = max(0, min(3, scout_level))
        uncertainty = UNCERTAINTY_BY_LEVEL[level]
        ovr_noise = uncertainty["overall"]
        ind_noise = uncertainty["individual"]

        true_overall = prospect["true_overall"]
        ratings = prospect.get("ratings", {})

        # Projected overall is a range
        scouted_center = true_overall + random.randint(-ovr_noise, ovr_noise)
        scouted_center = _clamp(scouted_center, 40, 99)
        projected_floor = max(40, scouted_center - ovr_noise)
        projected_ceiling = min(99, scouted_center + ovr_noise)

        # Scouted individual ratings
        scouted_ratings: dict[str, int] = {}
        for field in RATING_FIELDS:
            true_val = ratings.get(field, 50)
            noisy = true_val + random.randint(-ind_noise, ind_noise)
            scouted_ratings[field] = _clamp(noisy)

        # Strengths: top 3 scouted ratings
        sorted_ratings = sorted(
            scouted_ratings.items(), key=lambda x: x[1], reverse=True,
        )
        strengths = [
            {"attribute": attr, "rating": val}
            for attr, val in sorted_ratings[:3]
        ]

        # Weaknesses: bottom 3
        weaknesses = [
            {"attribute": attr, "rating": val}
            for attr, val in sorted_ratings[-3:]
        ]

        # Comparison player description
        comparison = self._generate_comparison(scouted_ratings)

        potential = prospect.get("potential", scouted_center + 5)
        scouted_potential = potential + random.randint(-ovr_noise, ovr_noise)
        scouted_potential = _clamp(scouted_potential, scouted_center, 99)

        return {
            "prospect_id": prospect_id,
            "name": prospect.get("name", "Unknown"),
            "position": prospect.get("position", ""),
            "age": prospect.get("age", 0),
            "college": prospect.get("college"),
            "country": prospect.get("country", ""),
            "projected_overall": {
                "center": scouted_center,
                "low": projected_floor,
                "high": projected_ceiling,
            },
            "projected_ceiling": scouted_potential,
            "projected_floor": projected_floor,
            "scouted_ratings": scouted_ratings,
            "strengths": strengths,
            "weaknesses": weaknesses,
            "comparison_player": comparison,
            "scout_level": level,
            "confidence": _scout_confidence(level),
        }

    # ------------------------------------------------------------------
    # Scout assignment
    # ------------------------------------------------------------------

    def assign_scout(self, team_id: str, prospect_id: str) -> None:
        """Increment the scout level for *prospect_id* by one for
        *team_id* (max 3)."""
        if team_id not in self._scout_levels:
            self._scout_levels[team_id] = {}
        current = self._scout_levels[team_id].get(prospect_id, 0)
        self._scout_levels[team_id][prospect_id] = min(3, current + 1)

    def get_scout_level(self, team_id: str, prospect_id: str) -> int:
        """Return the current scout level a team has on a prospect."""
        return self._scout_levels.get(team_id, {}).get(prospect_id, 0)

    # ------------------------------------------------------------------
    # Mock draft
    # ------------------------------------------------------------------

    def generate_mock_draft(
        self,
        prospects: list[dict],
        teams: list[dict],
    ) -> list[dict]:
        """Generate an AI mock draft order.

        This simulates a media mock draft that the user can view.
        Prospects are ordered by their *scouted* overall at level 1
        (light scouting — the way media scouts would see them).
        """
        scored: list[tuple[int, dict]] = []

        for prospect in prospects:
            pid = prospect["id"]
            report = self.get_scouting_report(pid, scout_level=1)
            proj = report["projected_overall"]["center"]
            scored.append((proj, prospect))

        scored.sort(key=lambda x: x[0], reverse=True)

        mock: list[dict] = []
        for pick_num, (proj_ovr, prospect) in enumerate(scored, start=1):
            team = teams[(pick_num - 1) % len(teams)] if teams else {}
            mock.append({
                "pick": pick_num,
                "prospect_id": prospect["id"],
                "prospect_name": prospect.get("name", "Unknown"),
                "position": prospect.get("position", ""),
                "projected_overall": proj_ovr,
                "team_id": team.get("team_id", ""),
                "team_name": team.get("name", ""),
            })

        return mock

    # ------------------------------------------------------------------
    # Comparison / play-style generation
    # ------------------------------------------------------------------

    def _generate_comparison(self, ratings: dict[str, int]) -> str:
        """Produce a text play-style description based on ratings."""
        for descriptor in PLAYSTYLE_DESCRIPTORS:
            if descriptor["check"](ratings):
                return descriptor["desc"]
        return DEFAULT_COMPARISON


def _scout_confidence(level: int) -> str:
    """Return a human-readable confidence label."""
    return {0: "very_low", 1: "low", 2: "moderate", 3: "high"}.get(
        level, "very_low"
    )
