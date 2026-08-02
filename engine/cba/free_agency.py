from __future__ import annotations

from ..models.player import Player
from ..models.team import Team
from ..models.contract import ContractInfo, CBAConstants
from ..models.league import LeagueSettings


class FreeAgencyEngine:
    def __init__(self, cba: CBAConstants, settings: LeagueSettings):
        self.cba = cba
        self.settings = settings

    def run_free_agency(self, free_agents: list[Player], teams: list[Team], user_team_id: str) -> dict:
        return {}

    def evaluate_market_value(self, player: Player) -> dict:
        return {}

    def generate_cpu_offers(self, player: Player, teams: list[Team]) -> list[dict]:
        return []

    def player_decision(self, player: Player, offers: list[dict]) -> dict | None:
        return None

    def get_free_agent_wave(self, free_agents: list[Player], wave_number: int) -> list[Player]:
        return []

    def process_restricted_free_agent(self, player: Player, offer: dict, current_team: Team) -> dict:
        return {}

    def can_team_sign(self, team: Team, salary: int, exception_type: str | None = None) -> bool:
        return False

    def get_available_cap_space(self, team: Team) -> int:
        return 0

    def sign_player(self, player: Player, team: Team, contract: ContractInfo) -> dict:
        return {}

    def process_sign_and_trade(self, player: Player, origin_team: Team, destination_team: Team, contract: ContractInfo) -> dict:
        return {}

    def generate_qualifying_offers(self, restricted_fas: list[Player], teams: list[Team]) -> list[dict]:
        return []

    def run_moratorium(self, agreements: list[dict]) -> list[dict]:
        return []
