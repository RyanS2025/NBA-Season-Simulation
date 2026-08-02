from __future__ import annotations

import random
from typing import Any

# ---------------------------------------------------------------------------
# 2019+ NBA Draft Lottery odds (14 non-playoff teams)
# These are the percentage chances of winning the #1 overall pick.
# The bottom three records each share 14% odds.
# ---------------------------------------------------------------------------
LOTTERY_ODDS: list[float] = [
    14.0,   # worst record
    14.0,   # 2nd worst
    14.0,   # 3rd worst
    12.5,   # 4th worst
    10.5,   # 5th worst
    9.0,    # 6th worst
    7.5,    # 7th worst
    6.0,    # 8th worst
    4.5,    # 9th worst
    3.0,    # 10th worst
    2.0,    # 11th worst
    1.5,    # 12th worst
    1.0,    # 13th worst
    0.5,    # 14th worst (best non-playoff record)
]


class DraftLottery:
    """Simulates the NBA draft lottery using 2019+ rules.

    Only the top 4 picks are determined by lottery drawing.  Picks 5-14
    fall to non-playoff teams in reverse-record order among those not
    already moved into the top 4.
    """

    def run_lottery(
        self,
        non_playoff_teams: list[dict],
    ) -> list[dict]:
        """Run the draft lottery and return the full first-round order.

        Parameters
        ----------
        non_playoff_teams:
            A list of up to 14 dicts, each with ``team_id``, ``wins``,
            and ``losses``.  The list should be sorted by record
            (worst-to-best) or unsorted — the method sorts internally.

        Returns
        -------
        list[dict]
            Ordered list with keys ``pick`` (1-30) and ``team_id``.
            Positions 15-30 are filled with placeholder team ids
            (``"playoff_team_15"`` ... ``"playoff_team_30"``) unless
            the caller extends the result.
        """
        # Sort non-playoff teams by record (worst first)
        sorted_teams = sorted(
            non_playoff_teams,
            key=lambda t: (t.get("wins", 0), -t.get("losses", 0)),
        )

        # Pad or trim to exactly 14
        while len(sorted_teams) < 14:
            sorted_teams.append({
                "team_id": f"filler_{len(sorted_teams)}",
                "wins": 41,
                "losses": 41,
            })
        sorted_teams = sorted_teams[:14]

        # Assign lottery odds
        team_odds: list[tuple[str, float]] = []
        for i, team in enumerate(sorted_teams):
            odds = LOTTERY_ODDS[i] if i < len(LOTTERY_ODDS) else 0.5
            team_odds.append((team["team_id"], odds))

        # Draw top 4 picks
        remaining = list(team_odds)
        top4: list[str] = []

        for _ in range(4):
            if not remaining:
                break
            ids = [r[0] for r in remaining]
            weights = [r[1] for r in remaining]
            winner = random.choices(ids, weights=weights, k=1)[0]
            top4.append(winner)
            remaining = [(tid, w) for tid, w in remaining if tid != winner]

        # Picks 5-14: remaining lottery teams in reverse-record order
        top4_set = set(top4)
        remaining_teams = [
            t for t in sorted_teams if t["team_id"] not in top4_set
        ]

        # Build full lottery order
        lottery_order: list[dict] = []
        pick = 1
        for tid in top4:
            lottery_order.append({"pick": pick, "team_id": tid})
            pick += 1

        for team in remaining_teams:
            lottery_order.append({"pick": pick, "team_id": team["team_id"]})
            pick += 1

        # Positions 15-30 are playoff teams (placeholders)
        while pick <= 30:
            lottery_order.append({
                "pick": pick,
                "team_id": f"playoff_team_{pick}",
            })
            pick += 1

        return lottery_order


class DraftEngine:
    """Manages the two-round (60-pick) NBA draft.

    The engine tracks which prospects are available, processes picks
    (human or CPU), and can simulate the full draft.
    """

    def __init__(
        self,
        prospects: list[dict],
        teams: list[dict],
        draft_order: list[dict],
    ) -> None:
        """
        Parameters
        ----------
        prospects:
            List of prospect dicts (from ``ProspectGenerator``).
        teams:
            List of team dicts with at least ``team_id`` and ``needs``.
        draft_order:
            First-round order (picks 1-30).  Round 2 mirrors round 1.
        """
        self.prospects: dict[str, dict] = {p["id"]: p for p in prospects}
        self.teams: dict[str, dict] = {t["team_id"]: t for t in teams}
        self.draft_order: list[dict] = list(draft_order)

        # Build the full 60-pick order (round 2 mirrors round 1)
        self._full_order: list[dict] = []
        for entry in self.draft_order[:30]:
            self._full_order.append({
                "pick": entry["pick"],
                "team_id": entry["team_id"],
            })
        for entry in self.draft_order[:30]:
            self._full_order.append({
                "pick": entry["pick"] + 30,
                "team_id": entry["team_id"],
            })

        # State
        self._drafted: list[dict] = []
        self._drafted_ids: set[str] = set()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def make_pick(
        self,
        pick_number: int,
        team_id: str,
        prospect_id: str | None = None,
    ) -> dict:
        """Execute a single draft pick.

        If *prospect_id* is ``None`` the CPU auto-selects using simple
        value-based logic (best available + team needs).

        Returns a dict describing the pick.
        """
        if prospect_id is None:
            prospect_id = self._cpu_auto_pick(team_id)

        prospect = self.prospects.get(prospect_id)
        if prospect is None:
            # Fallback: pick best available
            available = self.get_available_prospects()
            if not available:
                return {"error": "No prospects available"}
            prospect = available[0]
            prospect_id = prospect["id"]

        if prospect_id in self._drafted_ids:
            # Already drafted — pick best available instead
            available = self.get_available_prospects()
            if not available:
                return {"error": "No prospects available"}
            prospect = available[0]
            prospect_id = prospect["id"]

        # Mark as drafted
        self._drafted_ids.add(prospect_id)

        draft_round = 1 if pick_number <= 30 else 2
        pick_in_round = pick_number if pick_number <= 30 else pick_number - 30

        result = {
            "pick_number": pick_number,
            "round": draft_round,
            "pick_in_round": pick_in_round,
            "team_id": team_id,
            "prospect_id": prospect_id,
            "prospect_name": prospect.get("name", "Unknown"),
            "position": prospect.get("position", ""),
            "true_overall": prospect.get("true_overall", 0),
            "potential": prospect.get("potential", 0),
            "age": prospect.get("age", 0),
            "college": prospect.get("college"),
            "country": prospect.get("country", ""),
        }

        self._drafted.append(result)
        return result

    def get_available_prospects(self) -> list[dict]:
        """Return undrafted prospects sorted by projected overall
        (descending)."""
        available = [
            p for pid, p in self.prospects.items()
            if pid not in self._drafted_ids
        ]
        available.sort(
            key=lambda p: p.get("true_overall", 0), reverse=True,
        )
        return available

    def get_team_pick(self, pick_number: int) -> str:
        """Return the team_id that owns *pick_number*."""
        idx = pick_number - 1
        if 0 <= idx < len(self._full_order):
            return self._full_order[idx]["team_id"]
        return ""

    def get_draft_results(self) -> list[dict]:
        """Return all picks made so far."""
        return list(self._drafted)

    def simulate_full_draft(
        self,
        user_team_id: str | None = None,
    ) -> list[dict]:
        """Auto-simulate all 60 picks.

        If *user_team_id* is provided, that team's picks are returned
        with ``status="pending"`` instead of being auto-filled — this
        lets the frontend pause for user input.

        Returns the full list of 60 pick results.
        """
        results: list[dict] = []

        for entry in self._full_order:
            pick_num = entry["pick"]
            tid = entry["team_id"]

            # Skip already-made picks
            already = [d for d in self._drafted if d["pick_number"] == pick_num]
            if already:
                results.append(already[0])
                continue

            if user_team_id is not None and tid == user_team_id:
                # User pick — mark pending
                results.append({
                    "pick_number": pick_num,
                    "round": 1 if pick_num <= 30 else 2,
                    "pick_in_round": pick_num if pick_num <= 30 else pick_num - 30,
                    "team_id": tid,
                    "status": "pending",
                })
                continue

            # CPU pick
            result = self.make_pick(pick_num, tid)
            results.append(result)

        return results

    # ------------------------------------------------------------------
    # CPU draft logic
    # ------------------------------------------------------------------

    def _cpu_auto_pick(self, team_id: str) -> str:
        """Simple CPU pick logic: best available weighted by team needs."""
        available = self.get_available_prospects()
        if not available:
            return ""

        team = self.teams.get(team_id, {})
        needs = team.get("needs", [])

        scored: list[tuple[float, dict]] = []
        for prospect in available:
            base_value = float(prospect.get("true_overall", 0))

            # Potential bonus (younger + higher ceiling = better)
            pot = prospect.get("potential", base_value)
            age = prospect.get("age", 21)
            base_value += (pot - base_value) * 0.25
            if age <= 20:
                base_value += 2.0

            # Need fit bonus
            pos = prospect.get("position", "")
            for need in needs:
                if pos in str(need):
                    base_value += 5.0
                    break

            # Small random noise for variety
            base_value += random.uniform(-2.0, 2.0)
            scored.append((base_value, prospect))

        scored.sort(key=lambda x: x[0], reverse=True)
        return scored[0][1]["id"]
