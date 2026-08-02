from __future__ import annotations


class WorkerAPI:
    def __init__(self) -> None:
        self.initialized = False
        self.teams: list[dict] = []
        self.players: list[dict] = []
        self.settings: dict = {}
        self.schedule: list[dict] = []
        self.season_stats: list[dict] = []
        self.transactions: list[dict] = []

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

    def _handle_init(self, payload: dict) -> dict:
        self.teams = payload.get("teams", [])
        self.players = payload.get("players", [])
        self.settings = payload.get("settings", {})
        self.initialized = True
        return {"type": "INIT_COMPLETE", "payload": {"success": True, "team_count": len(self.teams), "player_count": len(self.players)}}

    def _handle_simulate_game(self, payload: dict) -> dict:
        from .simulation.game_engine import FastSimEngine
        home_id = payload["home_team_id"]
        away_id = payload["away_team_id"]
        engine = FastSimEngine()
        home_team = next((t for t in self.teams if t.get("id") == home_id), None)
        away_team = next((t for t in self.teams if t.get("id") == away_id), None)
        if not home_team or not away_team:
            return {"type": "ERROR", "payload": {"message": "Team not found"}}
        result = engine.simulate(home_team, away_team, self.players)
        return {"type": "GAME_RESULT", "payload": result}

    def _handle_simulate_games_batch(self, payload: dict) -> dict:
        from .simulation.game_engine import FastSimEngine
        games = payload.get("games", [])
        engine = FastSimEngine()
        results = []
        for game in games:
            home = next((t for t in self.teams if t.get("id") == game["home_team_id"]), None)
            away = next((t for t in self.teams if t.get("id") == game["away_team_id"]), None)
            if home and away:
                result = engine.simulate(home, away, self.players)
                result["game_id"] = game.get("id")
                results.append(result)
        return {"type": "BATCH_RESULT", "payload": {"results": results, "count": len(results)}}

    def _handle_simulate_to_date(self, payload: dict) -> dict:
        target_date = payload.get("target_date")
        games = payload.get("games", [])
        from .simulation.game_engine import FastSimEngine
        engine = FastSimEngine()
        results = []
        for game in games:
            if game.get("date", "") <= target_date and not game.get("completed"):
                home = next((t for t in self.teams if t.get("id") == game["home_team_id"]), None)
                away = next((t for t in self.teams if t.get("id") == game["away_team_id"]), None)
                if home and away:
                    result = engine.simulate(home, away, self.players)
                    result["game_id"] = game.get("id")
                    results.append(result)
        return {"type": "SIM_TO_DATE_RESULT", "payload": {"results": results, "games_simmed": len(results)}}

    def _handle_simulate_deadline_hour(self, payload: dict) -> dict:
        from .league_activity import LeagueActivityEngine
        hour = payload.get("hour", 9)
        activity = LeagueActivityEngine(self.teams, self.players, self.settings, payload.get("current_date", ""))
        trades = activity.simulate_deadline_hour(hour)
        return {"type": "DEADLINE_HOUR_RESULT", "payload": {"hour": hour, "trades": trades}}

    def _handle_evaluate_trade(self, payload: dict) -> dict:
        from .ai.gm_ai import GMAI
        team_id = payload.get("team_id")
        trade = payload.get("trade", {})
        team = next((t for t in self.teams if t.get("id") == team_id), None)
        if not team:
            return {"type": "ERROR", "payload": {"message": "Team not found"}}
        gm = GMAI(team, [p for p in self.players if p.get("team_id") == team_id])
        score = gm.evaluate_trade_offer(trade)
        return {"type": "TRADE_EVALUATION", "payload": {"score": score, "recommendation": "accept" if score > 0 else "reject"}}

    def _handle_validate_trade(self, payload: dict) -> dict:
        from .cba.trade_rules import TradeValidator
        trade = payload.get("trade", {})
        validator = TradeValidator(self.teams, self.players)
        result = validator.validate_trade(trade)
        return {"type": "TRADE_VALIDATION", "payload": result}

    def _handle_run_draft(self, payload: dict) -> dict:
        from .draft.draft_engine import DraftEngine
        prospects = payload.get("prospects", [])
        draft_order = payload.get("draft_order", [])
        user_team_id = payload.get("user_team_id")
        engine = DraftEngine(prospects, self.teams, draft_order)
        if payload.get("pick_number") is not None and payload.get("prospect_id"):
            result = engine.make_pick(payload["pick_number"], payload.get("team_id", user_team_id), payload["prospect_id"])
            return {"type": "DRAFT_PICK_RESULT", "payload": result}
        results = engine.simulate_full_draft(user_team_id)
        return {"type": "DRAFT_RESULT", "payload": {"picks": results}}

    def _handle_run_draft_lottery(self, payload: dict) -> dict:
        from .draft.draft_engine import DraftLottery
        non_playoff_teams = payload.get("non_playoff_teams", [])
        lottery = DraftLottery()
        order = lottery.run_lottery(non_playoff_teams)
        return {"type": "LOTTERY_RESULT", "payload": {"order": order}}

    def _handle_run_free_agency(self, payload: dict) -> dict:
        from .offseason.free_agency import FreeAgencyEngine
        free_agents = payload.get("free_agents", [])
        user_team_id = payload.get("user_team_id")
        engine = FreeAgencyEngine(free_agents, self.teams, self.settings)
        if payload.get("day") is not None:
            signings = engine.simulate_day(payload["day"], user_team_id)
            return {"type": "FA_DAY_RESULT", "payload": {"day": payload["day"], "signings": signings}}
        if payload.get("offer"):
            offer = payload["offer"]
            result = engine.make_offer(offer["team_id"], offer["player_id"], offer["years"], offer["annual_salary"])
            return {"type": "FA_OFFER_RESULT", "payload": result}
        results = engine.run_full_free_agency(user_team_id)
        return {"type": "FA_RESULT", "payload": {"signings": results}}

    def _handle_run_allstar_weekend(self, payload: dict) -> dict:
        from .allstar_engine import AllStarEngine
        engine = AllStarEngine()
        results = engine.run_allstar_weekend(self.players, self.teams)
        return {"type": "ALLSTAR_RESULT", "payload": results}

    def _handle_advance_offseason(self, payload: dict) -> dict:
        from .offseason.offseason_engine import OffseasonEngine
        engine = OffseasonEngine(payload.get("league_state", {}), self.teams, self.players, self.settings)
        result = engine.advance_offseason_phase()
        return {"type": "OFFSEASON_PHASE_RESULT", "payload": result}

    def _handle_compute_cap_sheet(self, payload: dict) -> dict:
        from .cba.salary_cap import SalaryCapEngine
        team_id = payload.get("team_id")
        team = next((t for t in self.teams if t.get("id") == team_id), None)
        if not team:
            return {"type": "ERROR", "payload": {"message": "Team not found"}}
        team_players = [p for p in self.players if p.get("team_id") == team_id]
        engine = SalaryCapEngine()
        sheet = engine.compute_cap_sheet(team, team_players)
        return {"type": "CAP_SHEET_RESULT", "payload": sheet}

    def _handle_compute_awards(self, payload: dict) -> dict:
        from .awards_engine import AwardsEngine
        stats = payload.get("season_stats", self.season_stats)
        engine = AwardsEngine(self.players, self.teams, stats)
        results = engine.run_all_awards()
        return {"type": "AWARDS_RESULT", "payload": results}

    def _handle_generate_schedule(self, payload: dict) -> dict:
        from .simulation.season_engine import SeasonEngine
        engine = SeasonEngine(self.settings)
        games_per_season = payload.get("games_per_season", 82)
        start_date = payload.get("start_date", "2026-10-22")
        schedule = engine.generate_schedule(self.teams, games_per_season, start_date)
        self.schedule = schedule
        return {"type": "SCHEDULE_RESULT", "payload": {"games": schedule, "total": len(schedule)}}

    def _handle_player_development(self, payload: dict) -> dict:
        from .offseason.player_development import PlayerDevelopment
        dev = PlayerDevelopment()
        coaching = payload.get("coaching_staff")
        results = []
        for player in self.players:
            changes = dev.apply_offseason_development(player, coaching)
            results.append({"player_id": player.get("id"), "changes": changes})
        return {"type": "DEVELOPMENT_RESULT", "payload": {"results": results}}

    def _handle_generate_league_activity(self, payload: dict) -> dict:
        from .league_activity import LeagueActivityEngine
        current_date = payload.get("current_date", "")
        season_phase = payload.get("season_phase", "regular_season")
        engine = LeagueActivityEngine(self.teams, self.players, self.settings, current_date)
        activity = engine.generate_daily_activity(current_date, season_phase)
        return {"type": "LEAGUE_ACTIVITY_RESULT", "payload": {"transactions": activity}}

    def _handle_check_retirements(self, payload: dict) -> dict:
        from .offseason.offseason_engine import OffseasonEngine
        engine = OffseasonEngine(payload.get("league_state", {}), self.teams, self.players, self.settings)
        retirements = engine.run_retirements()
        return {"type": "RETIREMENTS_RESULT", "payload": retirements}

    def _handle_check_hof_eligibility(self, payload: dict) -> dict:
        retired_players = payload.get("retired_players", [])
        inductees = []
        for p in retired_players:
            years_retired = p.get("years_retired", 0)
            if years_retired < 3:
                continue
            mvps = p.get("mvp_count", 0)
            all_nba = p.get("all_nba_count", 0)
            championships = p.get("championships", 0)
            career_points = p.get("career_points", 0)
            score = mvps * 30 + all_nba * 10 + championships * 15 + (career_points / 1000)
            if score >= 40:
                inductees.append({"player_id": p.get("id"), "name": p.get("name"), "score": score})
        return {"type": "HOF_RESULT", "payload": {"inductees": inductees}}


api = WorkerAPI()


def handle_message(message: dict) -> dict:
    return api.handle_message(message)
