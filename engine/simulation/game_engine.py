from __future__ import annotations

from ..models.player import Player
from ..models.team import Team
from ..models.game import Game, GameResult, GameState, TeamBoxScore
from ..models.league import LeagueSettings


class GameEngine:
    """Full game simulation orchestrator using possession-by-possession logic."""

    def __init__(
        self,
        home_team: Team,
        away_team: Team,
        home_players: list[Player],
        away_players: list[Player],
        settings: LeagueSettings | None = None,
    ):
        self.home_team = home_team
        self.away_team = away_team
        self.home_players = home_players
        self.away_players = away_players
        self.settings = settings

    def simulate_full_game(self) -> GameResult:
        """Run the complete game simulation and return the final result."""
        return GameResult()

    def simulate_quarter(self, state: GameState, quarter: int) -> GameState:
        """Simulate a single quarter of play."""
        return state

    def simulate_overtime(self, state: GameState) -> GameState:
        """Simulate an overtime period."""
        return state

    def get_starting_lineup(
        self, team: Team, players: list[Player]
    ) -> list[Player]:
        """Return the five starting players for a team."""
        return players[:5]

    def handle_substitutions(
        self,
        on_court: list[Player],
        bench: list[Player],
        quarter: int,
        game_clock: float,
        score_diff: int,
    ) -> tuple[list[Player], list[Player]]:
        """Determine and execute substitutions based on game context."""
        return on_court, bench

    def compile_box_score(
        self, team_id: str, player_stats: dict[str, dict]
    ) -> TeamBoxScore:
        """Aggregate individual player stats into a team box score."""
        return TeamBoxScore(team_id=team_id)

    def check_end_of_quarter(self, state: GameState) -> bool:
        """Return True if the current quarter should end."""
        return False

    def determine_winner(self, home_score: int, away_score: int) -> str:
        """Return 'home' or 'away' based on the final scores."""
        return "home"


class FastSimEngine:
    """Lightweight game simulation using statistical distributions."""

    def __init__(
        self,
        home_team: Team,
        away_team: Team,
        home_players: list[Player],
        away_players: list[Player],
        settings: LeagueSettings | None = None,
    ):
        self.home_team = home_team
        self.away_team = away_team
        self.home_players = home_players
        self.away_players = away_players
        self.settings = settings

    def simulate_game(self) -> GameResult:
        """Run a fast statistical simulation and return the result."""
        return GameResult()

    def calculate_team_strength(
        self, team: Team, players: list[Player]
    ) -> float:
        """Compute an aggregate team strength rating."""
        return 0.0

    def generate_box_score(
        self,
        team: Team,
        players: list[Player],
        team_score: int,
        opponent_score: int,
    ) -> TeamBoxScore:
        """Generate a plausible box score from the final score."""
        return TeamBoxScore(team_id=team.id)

    def distribute_stats(
        self, players: list[Player], team_score: int
    ) -> list[dict]:
        """Distribute points, rebounds, assists, etc. among players."""
        return []
