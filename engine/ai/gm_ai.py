from __future__ import annotations
from ..models.player import Player
from ..models.team import Team, DraftPickAsset
from ..models.contract import ContractInfo, CBAConstants, TradePackage
from ..models.league import LeagueSettings


class GMAI:
    def __init__(self, team: Team, players: list[Player], cba: CBAConstants, settings: LeagueSettings):
        self.team = team
        self.players = players
        self.cba = cba
        self.settings = settings

    def evaluate_roster(self) -> dict:
        pass

    def get_team_strategy(self) -> str:
        pass

    def identify_needs(self) -> list[str]:
        pass

    def propose_trade(self, all_teams: list[Team], all_players: list[Player]) -> TradePackage | None:
        pass

    def evaluate_trade_offer(self, trade: TradePackage) -> dict:
        pass

    def should_accept_trade(self, trade: TradePackage, all_players: list[Player]) -> bool:
        pass

    def evaluate_free_agent(self, player: Player) -> dict:
        pass

    def make_free_agent_offer(self, player: Player) -> dict | None:
        pass

    def scout_draft_prospect(self, prospect: Player, scouting_level: int) -> dict:
        pass

    def make_draft_pick(self, available_prospects: list[Player], team_needs: list[str]) -> str:
        pass

    def should_waive_player(self, player: Player) -> bool:
        pass

    def should_exercise_option(self, contract: ContractInfo, player: Player) -> bool:
        pass

    def deadline_strategy(self, standings: dict, games_remaining: int) -> str:
        pass

    def buyout_market_strategy(self, available_players: list[Player]) -> list[str]:
        pass

    def extension_decisions(self, eligible_contracts: list[ContractInfo], players: list[Player]) -> list[dict]:
        pass

    def calculate_player_value(self, player: Player) -> float:
        pass

    def calculate_pick_value(self, pick: DraftPickAsset, projected_position: int) -> float:
        pass
