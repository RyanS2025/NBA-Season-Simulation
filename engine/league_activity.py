from __future__ import annotations
import random
from .models.player import Player
from .models.team import Team
from .models.contract import CBAConstants, TradePackage, ContractInfo
from .models.league import LeagueSettings, Transaction


class LeagueActivityEngine:
    MONTHLY_TRADE_RATES: dict[str, tuple[int, int]] = {
        "october": (1, 2),
        "november": (1, 2),
        "december": (2, 3),
        "january": (3, 5),
        "february_pre_deadline": (5, 10),
        "post_deadline": (0, 0),
    }

    def __init__(self, cba: CBAConstants, settings: LeagueSettings):
        self.cba = cba
        self.settings = settings

    def generate_activity(self, teams: list[Team], players: list[Player], current_date: str, phase: str) -> dict:
        pass

    def generate_cpu_trades(self, teams: list[Team], players: list[Player], month: str) -> list[TradePackage]:
        pass

    def generate_waivings(self, teams: list[Team], players: list[Player]) -> list[dict]:
        pass

    def generate_ten_day_signings(self, teams: list[Team], free_agents: list[Player]) -> list[dict]:
        pass

    def generate_two_way_conversions(self, teams: list[Team], players: list[Player]) -> list[dict]:
        pass

    def generate_injury_moves(self, teams: list[Team], players: list[Player]) -> list[dict]:
        pass

    def process_buyout_market(self, teams: list[Team], players: list[Player]) -> list[dict]:
        pass

    def simulate_deadline_hour(self, hour: int, teams: list[Team], players: list[Player]) -> dict:
        pass

    def get_trade_probability_for_hour(self, hour: int) -> float:
        pass

    def create_transaction(self, transaction_type: str, details: dict, date: str, season_year: int) -> Transaction:
        pass

    def get_month_from_date(self, date: str) -> str:
        pass
