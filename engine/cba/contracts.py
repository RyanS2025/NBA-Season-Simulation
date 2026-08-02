from __future__ import annotations

from ..models.contract import ContractInfo, ContractYear, CBAConstants, ContractIncentive
from ..models.player import Player


class ContractEngine:
    def __init__(self, cba: CBAConstants):
        self.cba = cba

    def create_rookie_scale_contract(self, player: Player, pick_number: int, team_id: str) -> ContractInfo:
        return ContractInfo(id="", player_id="", team_id=team_id, contract_type="rookie_scale")

    def create_veteran_contract(self, player: Player, team_id: str, years: int, annual_salary: int, contract_type: str = "standard") -> ContractInfo:
        return ContractInfo(id="", player_id="", team_id=team_id, contract_type=contract_type)

    def create_max_contract(self, player: Player, team_id: str, years_in_league: int) -> ContractInfo:
        return ContractInfo(id="", player_id="", team_id=team_id, contract_type="max")

    def create_minimum_contract(self, player: Player, team_id: str, years_in_league: int) -> ContractInfo:
        return ContractInfo(id="", player_id="", team_id=team_id, contract_type="minimum")

    def create_mle_contract(self, player: Player, team_id: str, years: int, annual_salary: int, is_taxpayer: bool = False) -> ContractInfo:
        return ContractInfo(id="", player_id="", team_id=team_id, contract_type="mle")

    def create_two_way_contract(self, player: Player, team_id: str) -> ContractInfo:
        return ContractInfo(id="", player_id="", team_id=team_id, contract_type="two_way")

    def create_ten_day_contract(self, player: Player, team_id: str) -> ContractInfo:
        return ContractInfo(id="", player_id="", team_id=team_id, contract_type="ten_day")

    def calculate_max_salary(self, years_in_league: int) -> int:
        return 0

    def calculate_raises(self, base_salary: int, years: int, is_bird_rights: bool) -> list[int]:
        return []

    def get_qualifying_offer_amount(self, contract: ContractInfo) -> int:
        return 0

    def exercise_option(self, contract: ContractInfo, option_type: str) -> ContractInfo:
        return ContractInfo(id="", player_id="", team_id="", contract_type="")

    def decline_option(self, contract: ContractInfo, option_type: str) -> ContractInfo:
        return ContractInfo(id="", player_id="", team_id="", contract_type="")

    def extend_contract(self, contract: ContractInfo, additional_years: int, new_salary: int) -> ContractInfo:
        return ContractInfo(id="", player_id="", team_id="", contract_type="")

    def is_extension_eligible(self, contract: ContractInfo, current_date: str) -> bool:
        return False

    def get_veteran_minimum(self, years_in_league: int) -> int:
        return 0

    def buyout_contract(self, contract: ContractInfo, buyout_amount: int) -> ContractInfo:
        return ContractInfo(id="", player_id="", team_id="", contract_type="")

    def waive_player(self, contract: ContractInfo) -> dict:
        return {}
