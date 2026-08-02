from __future__ import annotations

import random
from typing import Any

from ..models.player import Player
from ..models.team import Team, RosterSlot
from ..models.contract import ContractInfo
from ..ai.gm_ai import GMAI
from ..cba.salary_cap import get_default_cba, SalaryCapEngine


# ---------------------------------------------------------------------------
# Wave thresholds
# ---------------------------------------------------------------------------
WAVE_1_THRESHOLD = 85   # Day 1-2
WAVE_2_THRESHOLD = 78   # Day 3-7
WAVE_3_THRESHOLD = 70   # Day 8-21
# Wave 4: everyone below 70 (ongoing)

MAX_ROSTER_SIZE = 15


class FreeAgencyEngine:
    """Simulates the NBA free-agency period wave by wave."""

    def __init__(
        self,
        free_agents: list[Player],
        teams: list[Team],
        settings: dict[str, Any] | None = None,
    ) -> None:
        self.free_agents: list[Player] = list(free_agents)
        self.teams: list[Team] = list(teams)
        self.settings: dict[str, Any] = settings or {}

        self.signed: list[dict] = []
        self._pending_offers: dict[str, list[dict]] = {}  # player_id -> offers
        self._signed_ids: set[str] = set()

        cba = get_default_cba()
        self._cap_engine = SalaryCapEngine(cba)
        self._cba = cba

    # ------------------------------------------------------------------
    # Wave helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _wave_for_player(player: Player) -> int:
        ovr = player.ratings.overall
        if ovr >= WAVE_1_THRESHOLD:
            return 1
        if ovr >= WAVE_2_THRESHOLD:
            return 2
        if ovr >= WAVE_3_THRESHOLD:
            return 3
        return 4

    @staticmethod
    def _wave_active_on_day(day: int) -> list[int]:
        """Return which waves are active on a given simulation day."""
        active: list[int] = []
        if day <= 2:
            active.append(1)
        if 3 <= day <= 7:
            active.append(2)
        if 8 <= day <= 21:
            active.append(3)
        if day >= 8:
            active.append(4)
        # Earlier waves can still sign on later days if players remain
        if day > 2:
            active.append(1)
        if day > 7:
            active.append(2)
        # Deduplicate while preserving order
        seen: set[int] = set()
        result: list[int] = []
        for w in active:
            if w not in seen:
                seen.add(w)
                result.append(w)
        return result

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def get_available_free_agents(self, wave: int | None = None) -> list[Player]:
        """Return free agents that have not yet signed.

        If *wave* is given, filter to only that wave's tier.
        """
        available = [
            p for p in self.free_agents if p.id not in self._signed_ids
        ]
        if wave is not None:
            available = [p for p in available if self._wave_for_player(p) == wave]
        return available

    def make_offer(
        self,
        team_id: str,
        player_id: str,
        years: int,
        annual_salary: float,
    ) -> dict:
        """Submit an offer from *team_id* to *player_id*."""
        team = self._find_team(team_id)
        player = self._find_free_agent(player_id)
        if team is None or player is None:
            return {"success": False, "reason": "team or player not found"}

        if player_id in self._signed_ids:
            return {"success": False, "reason": "player already signed"}

        if len(team.roster) >= MAX_ROSTER_SIZE:
            return {"success": False, "reason": "roster full"}

        offer: dict = {
            "team_id": team_id,
            "player_id": player_id,
            "years": years,
            "annual_salary": int(annual_salary),
            "team_name": f"{team.info.city} {team.info.name}",
        }

        self._pending_offers.setdefault(player_id, []).append(offer)
        return {"success": True, "offer": offer}

    def evaluate_offer(self, player: Player, offer: dict, team: Team) -> float:
        """Player evaluates an offer.  Higher score = more attractive.

        Considers money, team quality, market size, winning chance, role.
        """
        score = 0.0

        # --- Money (0-35 pts) ---
        cap = self._cba.salary_cap or 140_588_000
        salary_pct = offer["annual_salary"] / cap
        money_score = min(35.0, salary_pct * 120)
        score += money_score

        # --- Winning / team quality (0-25 pts) ---
        record = team.season_record
        total_games = record.wins + record.losses
        win_pct = record.wins / total_games if total_games > 0 else 0.5
        score += win_pct * 25

        # --- Market size (0-10 pts) ---
        market = team.info.market_size
        score += min(10.0, market / 10)

        # --- Role / playing time (0-15 pts) ---
        roster_at_position = sum(
            1 for slot in team.roster
            if self._roster_player_at_pos(slot, player.bio.position)
        )
        if roster_at_position == 0:
            score += 15  # clear starting role
        elif roster_at_position == 1:
            score += 10
        else:
            score += 5

        # --- Years / security (0-10 pts) ---
        score += min(10.0, offer["years"] * 2.5)

        # --- Loyalty bias (0-5 pts) ---
        if player.status.team_id == team.id:
            loyalty_bonus = player.character.loyalty / 100.0 * 5
            score += loyalty_bonus

        return round(score, 2)

    def process_restricted_fa(
        self,
        player_id: str,
        offer_sheet: dict,
    ) -> dict:
        """Handle a restricted free agent offer sheet.

        The original team has 48 hours (2 days) to match.
        """
        player = self._find_free_agent(player_id)
        if player is None or not player.status.is_restricted_fa:
            return {"matched": False, "signed": False, "reason": "not an RFA"}

        original_team_id = player.status.team_id
        original_team = self._find_team(original_team_id) if original_team_id else None

        if original_team is None:
            # No team to match -- sign with offering team
            return self._sign_player(player, offer_sheet)

        # Decide whether original team matches (CPU logic)
        ovr = player.ratings.overall
        should_match = ovr >= 75 or (ovr >= 68 and player.bio.age <= 25)

        if should_match:
            matched_offer = dict(offer_sheet)
            matched_offer["team_id"] = original_team.id
            matched_offer["team_name"] = f"{original_team.info.city} {original_team.info.name}"
            result = self._sign_player(player, matched_offer)
            result["matched"] = True
            return result

        return self._sign_player(player, offer_sheet)

    def simulate_day(self, day: int, user_team_id: str) -> list[dict]:
        """Process one day of free agency.

        CPU teams generate and submit offers for players in active waves.
        Players evaluate offers at end of day and accept the best one.
        Returns a list of signing event dicts.
        """
        active_waves = self._wave_active_on_day(day)
        events: list[dict] = []

        # 1. CPU teams make offers
        for team in self.teams:
            if team.id == user_team_id:
                continue  # user team makes offers via make_offer()
            if len(team.roster) >= MAX_ROSTER_SIZE:
                continue

            gm = self._build_gm(team)
            available = self.get_available_free_agents()
            available = [
                p for p in available
                if self._wave_for_player(p) in active_waves
            ]

            for player in available:
                offer_data = gm.make_free_agent_offer(player)
                if offer_data is not None:
                    self.make_offer(
                        team_id=team.id,
                        player_id=player.id,
                        years=offer_data["years"],
                        annual_salary=offer_data["annual_salary"],
                    )

        # 2. Resolve pending offers -- players in active waves decide
        resolved_ids: list[str] = []
        for player_id, offers in list(self._pending_offers.items()):
            if player_id in self._signed_ids:
                continue

            player = self._find_free_agent(player_id)
            if player is None:
                continue

            pw = self._wave_for_player(player)
            if pw not in active_waves:
                continue

            # Wave 1 players wait until day 2 to decide
            if pw == 1 and day < 2:
                continue
            # Wave 2 players wait until day 5
            if pw == 2 and day < 5:
                continue

            best_offer = self._pick_best_offer(player, offers)
            if best_offer is not None:
                result = self._sign_player(player, best_offer)
                events.append(result)
                resolved_ids.append(player_id)

        for pid in resolved_ids:
            self._pending_offers.pop(pid, None)

        return events

    def run_full_free_agency(self, user_team_id: str) -> list[dict]:
        """Run the entire free agency period (up to 30 simulated days).

        The user team's signings should already have been submitted via
        ``make_offer`` before calling this, or can be interleaved day by day.
        """
        all_events: list[dict] = []
        for day in range(1, 31):
            day_events = self.simulate_day(day, user_team_id)
            all_events.extend(day_events)

            # Stop early if everyone is signed
            if not self.get_available_free_agents():
                break

        return all_events

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _find_team(self, team_id: str) -> Team | None:
        for t in self.teams:
            if t.id == team_id:
                return t
        return None

    def _find_free_agent(self, player_id: str) -> Player | None:
        for p in self.free_agents:
            if p.id == player_id:
                return p
        return None

    def _build_gm(self, team: Team) -> GMAI:
        """Construct a lightweight GMAI for a CPU team."""
        from ..models.league import LeagueSettings
        roster_players: list[Player] = []
        player_ids = {slot.player_id for slot in team.roster}
        # We only have free agents in hand; roster players may not be
        # available here, so pass an empty list -- GMAI still works for
        # free-agent evaluation.
        return GMAI(
            team=team,
            players=roster_players,
            cba=self._cba,
            settings=LeagueSettings(),
        )

    def _pick_best_offer(self, player: Player, offers: list[dict]) -> dict | None:
        if not offers:
            return None

        scored: list[tuple[float, dict]] = []
        for offer in offers:
            team = self._find_team(offer["team_id"])
            if team is None:
                continue
            score = self.evaluate_offer(player, offer, team)
            scored.append((score, offer))

        if not scored:
            return None

        scored.sort(key=lambda x: x[0], reverse=True)
        return scored[0][1]

    def _sign_player(self, player: Player, offer: dict) -> dict:
        """Record a signing and update state."""
        team = self._find_team(offer["team_id"])
        self._signed_ids.add(player.id)

        # Update player status
        player.status.is_free_agent = False
        player.status.is_restricted_fa = False
        player.status.team_id = offer["team_id"]

        # Add to team roster
        if team is not None:
            team.roster.append(
                RosterSlot(
                    player_id=player.id,
                    roster_status="active",
                    lineup_position=len(team.roster) + 1,
                )
            )

        event: dict = {
            "event": "signing",
            "player_id": player.id,
            "player_name": f"{player.bio.first_name} {player.bio.last_name}",
            "team_id": offer["team_id"],
            "team_name": offer.get("team_name", ""),
            "years": offer["years"],
            "annual_salary": offer["annual_salary"],
            "total_value": offer["annual_salary"] * offer["years"],
            "matched": offer.get("matched", False),
        }
        self.signed.append(event)
        return event

    def _roster_player_at_pos(self, slot: RosterSlot, position: str) -> bool:
        """Check if a roster slot's player plays the given position.

        Since we only have player IDs on roster slots and may not have the
        full player objects, we use a simple heuristic -- this method always
        returns False to be safe, giving a slight starter-role bonus
        everywhere. Callers can override when full rosters are available.
        """
        # Without a full player lookup table attached we cannot check
        # position, so conservatively return False.
        return False
