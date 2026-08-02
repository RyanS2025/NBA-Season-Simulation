from __future__ import annotations

import random
from typing import Any

from ..models.player import Player, PlayerStatus
from ..models.team import Team, SeasonRecord
from ..models.league import League, LeagueSettings
from ..models.contract import CBAConstants
from ..cba.salary_cap import get_default_cba, SalaryCapEngine
from .free_agency import FreeAgencyEngine
from .player_development import PlayerDevelopment


# ---------------------------------------------------------------------------
# Offseason phase progression
# ---------------------------------------------------------------------------
PHASES: list[str] = [
    "end_of_season",
    "retirements",
    "draft_lottery",
    "draft",
    "free_agency",
    "player_development",
    "training_camp",
    "prepare_new_season",
]

# Retirement tuning
RETIREMENT_MIN_AGE = 36
RETIREMENT_BASE_CHANCE = 0.25        # 25 % base for age 36
RETIREMENT_AGE_INCREMENT = 0.15      # +15 % per year above 36
RETIREMENT_OVERALL_THRESHOLD = 68    # below this, more likely to retire
RETIREMENT_INJURY_BONUS = 0.10       # extra chance per career injury
RETIREMENT_MIN_PER_SEASON = 5
RETIREMENT_MAX_PER_SEASON = 10

# Hall-of-Fame thresholds
HOF_YEARS_RETIRED = 3
HOF_CAREER_OVERALL = 82             # peak overall needed
HOF_MIN_SEASONS = 10


class OffseasonEngine:
    """Orchestrates the full NBA offseason from end-of-season through to the
    start of the next season."""

    def __init__(
        self,
        league: League,
        teams: list[Team],
        players: list[Player],
        settings: LeagueSettings | None = None,
    ) -> None:
        self.league = league
        self.teams = teams
        self.players = players
        self.settings: LeagueSettings = settings or league.settings

        self._current_phase_index: int = 0
        self._phase_results: dict[str, Any] = {}
        self._retired_players: list[Player] = []
        self._hof_inductees: list[Player] = []

        self._cba: CBAConstants = league.cba_constants or get_default_cba()
        self._cap_engine = SalaryCapEngine(self._cba)
        self._dev = PlayerDevelopment()

    # ------------------------------------------------------------------
    # Phase navigation
    # ------------------------------------------------------------------

    def get_current_phase(self) -> str:
        """Return the name of the current offseason phase."""
        if self._current_phase_index >= len(PHASES):
            return "completed"
        return PHASES[self._current_phase_index]

    def advance_offseason_phase(self) -> dict:
        """Execute the current phase and advance to the next one.

        Returns a summary dict for the phase that was just executed.
        """
        phase = self.get_current_phase()
        if phase == "completed":
            return {"phase": "completed", "message": "Offseason already complete"}

        result = self._run_phase(phase)
        self._phase_results[phase] = result
        self._current_phase_index += 1
        next_phase = self.get_current_phase()

        return {
            "phase_completed": phase,
            "next_phase": next_phase,
            "result": result,
        }

    def run_full_offseason(self, user_team_id: str) -> dict:
        """Run every offseason phase automatically.

        Returns a dict keyed by phase name with each phase's result.
        """
        results: dict[str, Any] = {}
        while self.get_current_phase() != "completed":
            phase = self.get_current_phase()
            step = self.advance_offseason_phase()
            results[phase] = step.get("result", {})
        return results

    # ------------------------------------------------------------------
    # Phase dispatcher
    # ------------------------------------------------------------------

    def _run_phase(self, phase: str) -> dict:
        dispatch: dict[str, Any] = {
            "end_of_season": self._end_of_season,
            "retirements": self.run_retirements,
            "draft_lottery": self._draft_lottery,
            "draft": self._draft,
            "free_agency": self._free_agency,
            "player_development": self._player_development,
            "training_camp": self._training_camp,
            "prepare_new_season": self.prepare_new_season,
        }
        handler = dispatch.get(phase)
        if handler is None:
            return {"error": f"Unknown phase: {phase}"}
        return handler()

    # ------------------------------------------------------------------
    # End of season
    # ------------------------------------------------------------------

    def _end_of_season(self) -> dict:
        """Archive the current season results."""
        return {
            "season": self.league.current_season,
            "teams": len(self.teams),
            "players": len(self.players),
        }

    # ------------------------------------------------------------------
    # Retirements
    # ------------------------------------------------------------------

    def run_retirements(self) -> dict:
        """Process player retirements.

        Candidates: age >= 36, declining overall, injury history.
        Target 5-10 retirements per season.
        """
        candidates: list[tuple[float, Player]] = []

        for player in self.players:
            if player.bio.age < RETIREMENT_MIN_AGE:
                continue

            chance = RETIREMENT_BASE_CHANCE
            # Increase with age
            years_over = player.bio.age - RETIREMENT_MIN_AGE
            chance += years_over * RETIREMENT_AGE_INCREMENT

            # Low overall boosts retirement probability
            if player.ratings.overall < RETIREMENT_OVERALL_THRESHOLD:
                deficit = RETIREMENT_OVERALL_THRESHOLD - player.ratings.overall
                chance += deficit * 0.02

            # Injury history
            num_injuries = len(player.durability.injury_history)
            chance += min(num_injuries, 5) * RETIREMENT_INJURY_BONUS

            chance = min(chance, 0.95)
            candidates.append((chance, player))

        # Sort by retirement probability descending
        candidates.sort(key=lambda x: x[0], reverse=True)

        retired: list[dict] = []
        for chance, player in candidates:
            if len(retired) >= RETIREMENT_MAX_PER_SEASON:
                break
            if random.random() < chance or len(retired) < RETIREMENT_MIN_PER_SEASON:
                retired.append({
                    "player_id": player.id,
                    "player_name": f"{player.bio.first_name} {player.bio.last_name}",
                    "age": player.bio.age,
                    "overall": player.ratings.overall,
                    "years_in_league": player.bio.years_in_league,
                })
                self._retired_players.append(player)
                self._remove_player(player)

            if len(candidates) <= len(retired):
                break

        # Hall of Fame check for previously retired players
        hof = self._check_hall_of_fame()

        return {
            "retirements": retired,
            "retirement_count": len(retired),
            "hall_of_fame_inductees": hof,
        }

    def _remove_player(self, player: Player) -> None:
        """Remove a player from rosters and the active player list."""
        # Remove from team roster
        for team in self.teams:
            team.roster = [
                slot for slot in team.roster if slot.player_id != player.id
            ]

        # Remove from active players
        self.players = [p for p in self.players if p.id != player.id]

    def _check_hall_of_fame(self) -> list[dict]:
        """Check retired players for Hall of Fame eligibility.

        Eligible: retired 3+ years, high peak overall, long career.
        """
        inductees: list[dict] = []

        # In a full sim, we'd track retirement year. Here we simply
        # check the players retired in THIS run plus any stored retirees
        # with enough years elapsed.  For initial implementation we only
        # report eligibility based on career stats.
        for player in self._retired_players:
            years = player.bio.years_in_league
            peak = player.ratings.potential  # potential approximates career peak
            if years >= HOF_MIN_SEASONS and peak >= HOF_CAREER_OVERALL:
                inductees.append({
                    "player_id": player.id,
                    "player_name": f"{player.bio.first_name} {player.bio.last_name}",
                    "years_in_league": years,
                    "peak_overall": peak,
                })
                self._hof_inductees.append(player)

        return inductees

    # ------------------------------------------------------------------
    # Draft lottery (stub -- draft module handles full implementation)
    # ------------------------------------------------------------------

    def _draft_lottery(self) -> dict:
        """Run the draft lottery.

        This is a simplified placeholder; the full lottery lives in
        ``engine.draft``.
        """
        non_playoff: list[dict] = []
        for team in self.teams:
            record = team.season_record
            total = record.wins + record.losses
            if total == 0 or record.wins / total < 0.500:
                non_playoff.append({
                    "team_id": team.id,
                    "team_name": f"{team.info.city} {team.info.name}",
                    "record": f"{record.wins}-{record.losses}",
                })

        # Shuffle for lottery ordering (simplified)
        random.shuffle(non_playoff)
        for i, entry in enumerate(non_playoff):
            entry["lottery_position"] = i + 1

        return {
            "lottery_order": non_playoff,
        }

    # ------------------------------------------------------------------
    # Draft (stub)
    # ------------------------------------------------------------------

    def _draft(self) -> dict:
        """Placeholder for the draft phase.

        Full draft logic is in ``engine.draft``.
        """
        return {
            "message": "Draft phase -- handled by draft module",
            "draft_rounds": self.settings.draft_rounds,
        }

    # ------------------------------------------------------------------
    # Free agency
    # ------------------------------------------------------------------

    def _free_agency(self) -> dict:
        """Run the full free-agency period."""
        free_agents = [
            p for p in self.players if p.status.is_free_agent
        ]

        if not free_agents:
            return {"signings": [], "message": "No free agents"}

        engine = FreeAgencyEngine(
            free_agents=free_agents,
            teams=self.teams,
            settings={},
        )

        user_team_id = self.league.user_team_id
        events = engine.run_full_free_agency(user_team_id)

        return {
            "signings": events,
            "total_signings": len(events),
            "remaining_free_agents": len(engine.get_available_free_agents()),
        }

    # ------------------------------------------------------------------
    # Player development
    # ------------------------------------------------------------------

    def _player_development(self) -> dict:
        """Apply offseason development to every active player."""
        if not self.settings.player_development_enabled:
            return {"skipped": True, "reason": "player development disabled"}

        summaries: list[dict] = []
        for player in self.players:
            coaching = self._get_coaching_for_player(player)
            result = self._dev.apply_offseason_development(player, coaching)
            summaries.append(result)

        # Aggregate stats
        improved = sum(1 for s in summaries if s["overall_change"] > 0)
        declined = sum(1 for s in summaries if s["overall_change"] < 0)
        unchanged = sum(1 for s in summaries if s["overall_change"] == 0)

        return {
            "players_processed": len(summaries),
            "improved": improved,
            "declined": declined,
            "unchanged": unchanged,
            "details": summaries,
        }

    def _get_coaching_for_player(self, player: Player) -> CoachingStaff | None:
        """Find the coaching staff for the player's current team."""
        if player.status.team_id is None:
            return None
        for team in self.teams:
            if team.id == player.status.team_id:
                return team.coaching
        return None

    # ------------------------------------------------------------------
    # Training camp
    # ------------------------------------------------------------------

    def _training_camp(self) -> dict:
        """Apply training camp boosts."""
        summaries: list[dict] = []
        for player in self.players:
            # CPU players get a random focus; user players could choose
            focus_options = [
                "shooting", "defense", "playmaking",
                "athleticism", "post_game", "rebounding", None,
            ]
            focus = random.choice(focus_options)
            result = self._dev.apply_training_camp(player, focus)
            summaries.append(result)

        return {
            "players_processed": len(summaries),
            "details": summaries,
        }

    # ------------------------------------------------------------------
    # Prepare new season
    # ------------------------------------------------------------------

    def prepare_new_season(self) -> dict:
        """Reset stats, advance ages, update salary cap for the new season."""
        season = self.league.current_season

        # 1. Advance ages and years in league
        for player in self.players:
            player.bio.age += 1
            player.bio.years_in_league += 1
            # Reset per-season status
            player.status.fatigue = 0.0
            player.status.morale = 1.0
            player.status.is_rookie = False
            player.status.health = "healthy"
            player.status.current_injury = None

        # 2. Advance contracts (remove year 0, shift remaining down)
        expired_ids: list[str] = []
        for player in self.players:
            if player.contract is not None:
                contract = player.contract
                if hasattr(contract, "years") and contract.years:
                    contract.years = contract.years[1:]
                    if not contract.years:
                        # Contract expired -- player becomes a free agent
                        player.status.is_free_agent = True
                        player.contract = None
                        expired_ids.append(player.id)

        # 3. Reset team season records
        for team in self.teams:
            team.season_record = SeasonRecord()

        # 4. Update salary cap (~7 % annual growth, simplified)
        if self.league.cba_constants is not None:
            cba = self.league.cba_constants
            growth = 1.07
            cba.salary_cap = int(cba.salary_cap * growth)
            cba.luxury_tax_threshold = int(cba.luxury_tax_threshold * growth)
            cba.first_apron = int(cba.first_apron * growth)
            cba.second_apron = int(cba.second_apron * growth)
            cba.minimum_team_salary = int(cba.minimum_team_salary * growth)

        # 5. Update team finances
        for team in self.teams:
            contracts = [
                p.contract for p in self.players
                if p.status.team_id == team.id and p.contract is not None
            ]
            if contracts:
                self._cap_engine.update_team_finances(team, contracts)

        # 6. Advance league season counter
        self.league.current_season = season + 1

        return {
            "new_season": self.league.current_season,
            "expired_contracts": len(expired_ids),
            "active_players": len(self.players),
            "salary_cap": (
                self.league.cba_constants.salary_cap
                if self.league.cba_constants else None
            ),
        }


# Import needed at runtime after class definition to avoid circular import
from ..models.team import CoachingStaff as CoachingStaff  # noqa: E402
