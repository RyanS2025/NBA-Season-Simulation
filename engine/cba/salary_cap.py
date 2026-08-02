from __future__ import annotations

from ..models.contract import ContractInfo, CBAConstants
from ..models.team import Team, TeamFinances


class SalaryCapEngine:
    def __init__(self, cba: CBAConstants):
        self.cba = cba

    def compute_cap_sheet(self, team: Team, contracts: list[ContractInfo]) -> dict:
        return {}

    def get_total_payroll(self, contracts: list[ContractInfo]) -> int:
        return 0

    def get_cap_space(self, team: Team, contracts: list[ContractInfo]) -> int:
        return 0

    def calculate_luxury_tax(self, total_payroll: int) -> int:
        return 0

    def get_tax_apron_status(self, total_payroll: int) -> dict:
        return {}

    def get_available_exceptions(self, team: Team, contracts: list[ContractInfo]) -> dict:
        return {}

    def is_hard_capped(self, team: Team) -> bool:
        return False

    def get_hard_cap_amount(self) -> int:
        return 0

    def project_next_year_salary(self, contracts: list[ContractInfo], season_year: int) -> int:
        return 0

    def compute_cap_holds(self, team: Team, free_agents: list, draft_picks: list) -> int:
        return 0

    def get_minimum_team_salary(self) -> int:
        return 0

    def update_team_finances(self, team: Team, contracts: list[ContractInfo]) -> TeamFinances:
        return TeamFinances()
