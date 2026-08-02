from __future__ import annotations

from ..models.contract import ContractInfo, CBAConstants, TradePackage, TradeTeamPackage
from ..models.team import Team, DraftPickAsset


class TradeValidator:
    def __init__(self, cba: CBAConstants):
        self.cba = cba

    def validate_trade(self, trade: TradePackage, teams: list[Team], contracts: list[ContractInfo]) -> dict:
        return {}

    def check_salary_matching(self, team_package: TradeTeamPackage, team: Team, contracts: list[ContractInfo]) -> dict:
        return {}

    def check_roster_limits(self, team: Team, players_in: int, players_out: int) -> bool:
        return True

    def check_stepien_rule(self, team: Team, picks_out: list[DraftPickAsset]) -> bool:
        return True

    def check_trade_restrictions(self, contracts: list[ContractInfo]) -> list[str]:
        return []

    def check_no_trade_clause(self, contracts: list[ContractInfo]) -> list[str]:
        return []

    def check_apron_restrictions(self, team: Team, trade_result_payroll: int) -> list[str]:
        return []

    def calculate_salary_breakdown(self, trade: TradePackage, teams: list[Team], contracts: list[ContractInfo]) -> dict:
        return {}

    def generate_trade_exception(self, salary_out: int, salary_in: int) -> int:
        return 0

    def can_use_trade_exception(self, team: Team, incoming_salary: int, exception_amount: int) -> bool:
        return False

    def check_sign_and_trade_rules(self, player_contract: ContractInfo, receiving_team: Team) -> dict:
        return {}
