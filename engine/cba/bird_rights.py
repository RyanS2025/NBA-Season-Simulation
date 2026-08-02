from __future__ import annotations

from ..models.player import Player
from ..models.contract import ContractInfo, CBAConstants
from ..models.team import Team


class BirdRightsEngine:
    def __init__(self, cba: CBAConstants):
        self.cba = cba

    def get_bird_rights_status(self, player: Player, team: Team, contract: ContractInfo | None) -> str:
        return ""

    def calculate_max_with_bird_rights(self, player: Player, bird_status: str) -> int:
        return 0

    def can_exceed_cap_to_sign(self, team: Team, player: Player, bird_status: str) -> bool:
        return False

    def get_cap_hold_amount(self, player: Player, bird_status: str) -> int:
        return 0

    def renounce_bird_rights(self, player_id: str, team: Team) -> None:
        pass

    def update_bird_rights_after_trade(self, player: Player, new_team: Team) -> str:
        return ""

    def get_early_bird_max(self, player: Player) -> int:
        return 0

    def get_non_bird_max(self, player: Player) -> int:
        return 0
