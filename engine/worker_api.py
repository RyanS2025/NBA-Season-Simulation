from __future__ import annotations
import dataclasses
from .models.player import Player
from .models.team import Team
from .models.game import Game, GameResult
from .models.contract import ContractInfo, CBAConstants, TradePackage
from .models.league import League, LeagueSettings
from .simulation.game_engine import GameEngine, FastSimEngine
from .simulation.season_engine import SeasonEngine
from .cba.salary_cap import SalaryCapEngine
from .cba.trade_rules import TradeValidator
from .cba.free_agency import FreeAgencyEngine
from .cba.contracts import ContractEngine
from .ai.gm_ai import GMAI
from .awards_engine import AwardsEngine
from .allstar_engine import AllStarEngine
from .offseason_engine import OffseasonEngine
from .league_activity import LeagueActivityEngine
from .player_development import PlayerDevelopmentEngine
from .storyline_engine import StorylineEngine


def _serialize(obj):
    """Convert dataclass instances (and nested structures) to JSON-safe dicts."""
    if obj is None:
        return None
    if dataclasses.is_dataclass(obj) and not isinstance(obj, type):
        return dataclasses.asdict(obj)
    if isinstance(obj, list):
        return [_serialize(item) for item in obj]
    if isinstance(obj, dict):
        return {k: _serialize(v) for k, v in obj.items()}
    return obj


class WorkerAPI:
    def __init__(self) -> None:
        self.initialized = False
        self.league: League | None = None
        self.teams: list[Team] = []
        self.players: list[Player] = []
        self.settings: LeagueSettings | None = None
        self.cba: CBAConstants | None = None

    def handle_message(self, message: dict) -> dict:
        msg_type = message.get("type", "")
        payload = message.get("payload", {})

        handlers = {
            "INIT": self._handle_init,
            "SIMULATE_GAME": self._handle_simulate_game,
            "SIMULATE_GAMES_BATCH": self._handle_simulate_games_batch,
            "SIMULATE_TO_DATE": self._handle_simulate_to_date,
            "SIMULATE_DEADLINE_HOUR": self._handle_simulate_deadline_hour,
            "EVALUATE_TRADE": self._handle_evaluate_trade,
            "VALIDATE_TRADE": self._handle_validate_trade,
            "RUN_DRAFT": self._handle_run_draft,
            "RUN_DRAFT_LOTTERY": self._handle_run_draft_lottery,
            "RUN_FREE_AGENCY": self._handle_run_free_agency,
            "RUN_ALLSTAR_WEEKEND": self._handle_run_allstar_weekend,
            "ADVANCE_OFFSEASON": self._handle_advance_offseason,
            "COMPUTE_CAP_SHEET": self._handle_compute_cap_sheet,
            "COMPUTE_AWARDS": self._handle_compute_awards,
            "GENERATE_SCHEDULE": self._handle_generate_schedule,
            "PLAYER_DEVELOPMENT": self._handle_player_development,
            "GENERATE_LEAGUE_ACTIVITY": self._handle_generate_league_activity,
            "CHECK_RETIREMENTS": self._handle_check_retirements,
            "CHECK_HOF_ELIGIBILITY": self._handle_check_hof_eligibility,
        }

        handler = handlers.get(msg_type)
        if handler is None:
            return {"type": "ERROR", "payload": {"code": "UNKNOWN_TYPE", "message": f"Unknown message type: {msg_type}"}}

        try:
            return handler(payload)
        except Exception as e:
            return {"type": "ERROR", "payload": {"code": "ENGINE_ERROR", "message": str(e)}}

    # ------------------------------------------------------------------
    # INIT
    # ------------------------------------------------------------------

    def _handle_init(self, payload: dict) -> dict:
        self.league = payload.get("league")
        self.teams = payload.get("teams", [])
        self.players = payload.get("players", [])
        self.settings = payload.get("settings")
        self.cba = payload.get("cba")
        self.initialized = True
        return {
            "type": "INIT_COMPLETE",
            "payload": {
                "success": True,
                "team_count": len(self.teams),
                "player_count": len(self.players),
            },
        }

    # ------------------------------------------------------------------
    # SIMULATE_GAME
    # ------------------------------------------------------------------

    def _handle_simulate_game(self, payload: dict) -> dict:
        home_team = payload["home_team"]
        away_team = payload["away_team"]
        home_players = payload["home_players"]
        away_players = payload["away_players"]
        settings = payload.get("settings", self.settings)

        engine = GameEngine(home_team, away_team, home_players, away_players, settings)
        result = engine.simulate_full_game()
        return {"type": "GAME_RESULT", "payload": _serialize(result)}

    # ------------------------------------------------------------------
    # SIMULATE_GAMES_BATCH
    # ------------------------------------------------------------------

    def _handle_simulate_games_batch(self, payload: dict) -> dict:
        games = payload["games"]
        settings = payload.get("settings", self.settings)
        results = []
        for game in games:
            home_team = game["home_team"]
            away_team = game["away_team"]
            home_players = game["home_players"]
            away_players = game["away_players"]
            game_settings = game.get("settings", settings)

            engine = FastSimEngine(
                home_team, away_team, home_players, away_players, game_settings,
            )
            result = engine.simulate_game()
            results.append(_serialize(result))
        return {"type": "GAMES_BATCH_RESULT", "payload": results}

    # ------------------------------------------------------------------
    # SIMULATE_TO_DATE
    # ------------------------------------------------------------------

    def _handle_simulate_to_date(self, payload: dict) -> dict:
        target_date = payload["target_date"]
        schedule = payload["schedule"]
        teams = payload.get("teams", self.teams)
        players = payload.get("players", self.players)
        league = payload.get("league", self.league)

        engine = SeasonEngine(league, teams, players)
        results = engine.simulate_to_date(target_date, schedule, teams, players)
        return {"type": "GAMES_BATCH_RESULT", "payload": _serialize(results)}

    # ------------------------------------------------------------------
    # SIMULATE_DEADLINE_HOUR
    # ------------------------------------------------------------------

    def _handle_simulate_deadline_hour(self, payload: dict) -> dict:
        hour = payload["hour"]
        teams = payload.get("teams", self.teams)
        players = payload.get("players", self.players)
        settings = payload.get("settings", self.settings)
        current_date = payload.get("current_date", "")
        cba = payload.get("cba", self.cba)
        user_team_id = payload.get("user_team_id")

        engine = LeagueActivityEngine(
            teams, players, settings, current_date, cba, user_team_id,
        )
        trades = engine.simulate_deadline_hour(hour)
        return {
            "type": "DEADLINE_HOUR_RESULTS",
            "payload": {
                "hour": hour,
                "trades": _serialize(trades),
                "newsItems": [],
            },
        }

    # ------------------------------------------------------------------
    # EVALUATE_TRADE
    # ------------------------------------------------------------------

    def _handle_evaluate_trade(self, payload: dict) -> dict:
        trade = payload["trade"]
        teams = payload.get("teams", self.teams)
        contracts = payload.get("contracts", [])
        settings = payload.get("settings", self.settings)
        cba = payload.get("cba", self.cba)
        all_players = payload.get("players", self.players)

        # Build lookup maps
        team_map: dict[str, object] = {}
        for t in teams:
            tid = t.id if hasattr(t, "id") else t.get("id", "")
            team_map[tid] = t

        player_team_map: dict[str, list] = {}
        for p in all_players:
            ptid = getattr(p, "team_id", None) or (p.get("team_id", "") if isinstance(p, dict) else "")
            player_team_map.setdefault(ptid, []).append(p)

        # Determine which teams are involved in the trade
        trade_team_ids: list[str] = []
        if hasattr(trade, "teams"):
            trade_team_ids = [tp.team_id for tp in trade.teams]
        elif isinstance(trade, dict) and "teams" in trade:
            trade_team_ids = [
                tp.get("team_id", tp.get("teamId", ""))
                for tp in trade["teams"]
            ]

        # Each team's GM evaluates the trade
        evaluations: dict[str, object] = {}
        for team_id in trade_team_ids:
            team = team_map.get(team_id)
            if team is None:
                continue
            team_players = player_team_map.get(team_id, [])
            gm = GMAI(team, team_players, cba, settings)
            evaluation = gm.evaluate_trade_offer(trade)
            evaluations[team_id] = _serialize(evaluation)

        # Run CBA validation
        validator = TradeValidator(cba)
        validation = validator.validate_trade(trade, teams, contracts)

        return {
            "type": "TRADE_EVALUATION",
            "payload": {
                "evaluations": evaluations,
                "validation": _serialize(validation),
            },
        }

    # ------------------------------------------------------------------
    # VALIDATE_TRADE
    # ------------------------------------------------------------------

    def _handle_validate_trade(self, payload: dict) -> dict:
        trade = payload["trade"]
        teams = payload.get("teams", self.teams)
        contracts = payload.get("contracts", [])
        cba = payload.get("cba", self.cba)

        validator = TradeValidator(cba)
        result = validator.validate_trade(trade, teams, contracts)
        return {"type": "TRADE_VALIDATION", "payload": _serialize(result)}

    # ------------------------------------------------------------------
    # RUN_DRAFT
    # ------------------------------------------------------------------

    def _handle_run_draft(self, payload: dict) -> dict:
        draft_class = payload["draft_class"]
        draft_order = payload["draft_order"]
        teams = payload.get("teams", self.teams)
        user_team_id = payload.get("user_team_id", "")
        settings = payload.get("settings", self.settings)
        cba = payload.get("cba", self.cba)

        engine = OffseasonEngine(settings, cba)
        result = engine.run_draft(draft_class, draft_order, teams, user_team_id)
        return {"type": "DRAFT_RESULTS", "payload": _serialize(result)}

    # ------------------------------------------------------------------
    # RUN_DRAFT_LOTTERY
    # ------------------------------------------------------------------

    def _handle_run_draft_lottery(self, payload: dict) -> dict:
        non_playoff_teams = payload["non_playoff_teams"]
        settings = payload.get("settings", self.settings)
        cba = payload.get("cba", self.cba)

        engine = OffseasonEngine(settings, cba)
        result = engine.run_draft_lottery(non_playoff_teams)
        return {
            "type": "DRAFT_LOTTERY_RESULTS",
            "payload": {"order": _serialize(result)},
        }

    # ------------------------------------------------------------------
    # RUN_FREE_AGENCY
    # ------------------------------------------------------------------

    def _handle_run_free_agency(self, payload: dict) -> dict:
        free_agents = payload["free_agents"]
        teams = payload.get("teams", self.teams)
        user_team_id = payload.get("user_team_id", "")
        cba = payload.get("cba", self.cba)
        settings = payload.get("settings", self.settings)

        engine = FreeAgencyEngine(cba, settings)
        result = engine.run_free_agency(free_agents, teams, user_team_id)
        return {"type": "FREE_AGENCY_RESULTS", "payload": _serialize(result)}

    # ------------------------------------------------------------------
    # RUN_ALLSTAR_WEEKEND
    # ------------------------------------------------------------------

    def _handle_run_allstar_weekend(self, payload: dict) -> dict:
        players = payload.get("players", [])
        teams = payload.get("teams", [])

        engine = AllStarEngine(players, teams)
        result = engine.run_allstar_weekend(players, teams)
        return {"type": "ALLSTAR_RESULTS", "payload": _serialize(result)}

    # ------------------------------------------------------------------
    # ADVANCE_OFFSEASON
    # ------------------------------------------------------------------

    def _handle_advance_offseason(self, payload: dict) -> dict:
        teams = payload.get("teams", self.teams)
        players = payload.get("players", self.players)
        settings = payload.get("settings", self.settings)
        cba = payload.get("cba", self.cba)

        engine = OffseasonEngine(settings, cba)
        result = engine.advance_offseason(teams, players)
        return {"type": "OFFSEASON_RESULT", "payload": _serialize(result)}

    # ------------------------------------------------------------------
    # COMPUTE_CAP_SHEET
    # ------------------------------------------------------------------

    def _handle_compute_cap_sheet(self, payload: dict) -> dict:
        team = payload["team"]
        contracts = payload.get("contracts", [])
        season_year = payload.get("season_year", 2025)
        cba = payload.get("cba", self.cba)

        engine = SalaryCapEngine(cba)
        total_payroll = engine.get_total_payroll(contracts)
        cap_space = engine.get_cap_space(team, contracts)
        luxury_tax = engine.calculate_luxury_tax(total_payroll)
        exceptions = engine.get_available_exceptions(team, contracts)
        hard_capped = engine.is_hard_capped(team)
        hard_cap_amount = engine.get_hard_cap_amount()
        next_year_salary = engine.project_next_year_salary(contracts, season_year)

        cap_sheet = {
            "total_payroll": total_payroll,
            "cap_space": cap_space,
            "luxury_tax": luxury_tax,
            "exceptions": _serialize(exceptions),
            "hard_capped": hard_capped,
            "hard_cap_amount": hard_cap_amount,
            "next_year_salary": next_year_salary,
        }
        return {"type": "CAP_SHEET", "payload": cap_sheet}

    # ------------------------------------------------------------------
    # COMPUTE_AWARDS
    # ------------------------------------------------------------------

    def _handle_compute_awards(self, payload: dict) -> dict:
        players = payload.get("players", [])
        teams = payload.get("teams", [])
        season_stats = payload.get("season_stats", [])
        preseason_projections = payload.get("preseason_projections")
        transactions = payload.get("transactions")
        finals_stats = payload.get("finals_stats")

        engine = AwardsEngine(players, teams, season_stats)
        result = engine.run_all_awards(
            preseason_projections=preseason_projections,
            transactions=transactions,
            finals_stats=finals_stats,
        )
        return {"type": "AWARDS", "payload": _serialize(result)}

    # ------------------------------------------------------------------
    # GENERATE_SCHEDULE
    # ------------------------------------------------------------------

    def _handle_generate_schedule(self, payload: dict) -> dict:
        teams = payload["teams"]
        games_per_season = payload.get("games_per_season", 82)
        start_date = payload.get("start_date", "")
        league = payload.get("league", self.league)
        league_teams = payload.get("league_teams", self.teams)
        league_players = payload.get("league_players", self.players)

        engine = SeasonEngine(league, league_teams, league_players)
        games = engine.generate_schedule(teams, games_per_season, start_date)
        return {"type": "SCHEDULE", "payload": _serialize(games)}

    # ------------------------------------------------------------------
    # PLAYER_DEVELOPMENT
    # ------------------------------------------------------------------

    def _handle_player_development(self, payload: dict) -> dict:
        players = payload.get("players", self.players)
        settings = payload.get("settings", self.settings)

        engine = PlayerDevelopmentEngine(settings)
        results = engine.develop_players(players)
        return {"type": "DEVELOPMENT_RESULTS", "payload": _serialize(results)}

    # ------------------------------------------------------------------
    # GENERATE_LEAGUE_ACTIVITY
    # ------------------------------------------------------------------

    def _handle_generate_league_activity(self, payload: dict) -> dict:
        teams = payload.get("teams", self.teams)
        players = payload.get("players", self.players)
        settings = payload.get("settings", self.settings)
        current_date = payload.get("current_date", "")
        season_phase = payload.get("season_phase", "regular_season")
        cba = payload.get("cba", self.cba)
        user_team_id = payload.get("user_team_id")

        engine = LeagueActivityEngine(
            teams, players, settings, current_date, cba, user_team_id,
        )
        result = engine.generate_daily_activity(current_date, season_phase)
        return {"type": "LEAGUE_ACTIVITY_RESULTS", "payload": _serialize(result)}

    # ------------------------------------------------------------------
    # CHECK_RETIREMENTS
    # ------------------------------------------------------------------

    def _handle_check_retirements(self, payload: dict) -> dict:
        players = payload.get("players", self.players)
        settings = payload.get("settings", self.settings)
        cba = payload.get("cba", self.cba)

        engine = OffseasonEngine(settings, cba)
        result = engine.check_retirements(players)

        retired_ids: list[str] = []
        narratives: dict[str, object] = {}
        if result:
            for entry in result:
                pid = entry.get("player_id", "")
                if pid:
                    retired_ids.append(pid)
                narrative = entry.get("narrative")
                if pid and narrative:
                    narratives[pid] = narrative

        return {
            "type": "RETIREMENT_RESULTS",
            "payload": {
                "retiredPlayerIds": retired_ids,
                "narratives": narratives,
            },
        }

    # ------------------------------------------------------------------
    # CHECK_HOF_ELIGIBILITY
    # ------------------------------------------------------------------

    def _handle_check_hof_eligibility(self, payload: dict) -> dict:
        retired_players = payload.get("retired_players", [])
        existing_hof_ids = payload.get("existing_hof_ids", [])
        settings = payload.get("settings", self.settings)
        cba = payload.get("cba", self.cba)

        engine = OffseasonEngine(settings, cba)
        result = engine.check_hof_eligibility(retired_players, existing_hof_ids)

        inductee_ids: list[str] = []
        narratives: dict[str, object] = {}
        if result:
            for entry in result:
                pid = entry.get("player_id", "")
                if pid:
                    inductee_ids.append(pid)
                narrative = entry.get("narrative")
                if pid and narrative:
                    narratives[pid] = narrative

        return {
            "type": "HOF_RESULTS",
            "payload": {
                "inducteeIds": inductee_ids,
                "narratives": narratives,
            },
        }


api = WorkerAPI()


def handle_message(message: dict) -> dict:
    return api.handle_message(message)
