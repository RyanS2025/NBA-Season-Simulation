from __future__ import annotations
from .models.player import Player
from .models.team import Team
from .models.contract import CBAConstants
from .models.league import LeagueSettings


class OffseasonEngine:
    def __init__(self, settings: LeagueSettings, cba: CBAConstants):
        self.settings = settings
        self.cba = cba

    def advance_offseason(self, teams: list[Team], players: list[Player]) -> dict:
        pass

    def check_retirements(self, players: list[Player]) -> list[dict]:
        pass

    def check_hof_eligibility(self, retired_players: list[Player], existing_hof_ids: list[str]) -> list[dict]:
        pass

    def run_draft_lottery(self, non_playoff_teams: list[dict]) -> list[dict]:
        pass

    def run_summer_league(self, rookies: list[Player], young_players: list[Player]) -> list[dict]:
        pass

    def run_training_camp(self, teams: list[Team], players: list[Player]) -> list[dict]:
        pass

    def process_contract_decisions(self, teams: list[Team], players: list[Player], contracts: list) -> list[dict]:
        pass

    def generate_league_meetings(self, season_year: int) -> list[dict]:
        pass

    def simulate_scouting(self, team: Team, draft_class: list[Player], scouting_rounds: int) -> list[dict]:
        pass

    def run_draft(self, draft_class: list[Player], draft_order: list[dict], teams: list[Team], user_team_id: str) -> dict:
        pass

    def process_undrafted_free_agents(self, undrafted: list[Player], teams: list[Team]) -> list[dict]:
        pass

    def calculate_retirement_probability(self, player: Player) -> float:
        pass

    def calculate_hof_score(self, player: Player) -> float:
        pass
