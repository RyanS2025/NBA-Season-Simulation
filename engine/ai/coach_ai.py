from __future__ import annotations
from ..models.player import Player
from ..models.team import Team, CoachingStaff
from ..models.game import GameState


class CoachAI:
    def __init__(self, team: Team, players: list[Player]):
        self.team = team
        self.players = players

    def set_starting_lineup(self) -> list[str]:
        pass

    def set_rotation(self, minutes_target: dict[str, float] | None = None) -> dict[str, float]:
        pass

    def decide_substitution(self, state: GameState, on_court: list[Player], bench: list[Player]) -> list[tuple[str, str]] | None:
        pass

    def call_timeout(self, state: GameState, momentum: float) -> bool:
        pass

    def adjust_strategy(self, score_diff: int, quarter: int, game_clock: float) -> dict:
        pass

    def get_defensive_assignment(self, defender: Player, opponents: list[Player]) -> str:
        pass

    def set_offensive_scheme(self, opponent: Team) -> str:
        pass

    def set_defensive_scheme(self, opponent: Team) -> str:
        pass

    def manage_foul_trouble(self, player: Player, fouls: int, quarter: int) -> bool:
        pass

    def playoff_rotation_adjustment(self, series_game: int) -> dict[str, float]:
        pass

    def garbage_time_check(self, score_diff: int, quarter: int, game_clock: float) -> bool:
        pass
