from __future__ import annotations

from ..models.team import Team
from ..models.player import Player
from ..models.game import Game, GameResult
from ..models.league import League, LeagueSettings, SeasonAwards


class SeasonEngine:
    """Season state machine: schedule generation, day simulation, standings."""

    def __init__(
        self, league: League, teams: list[Team], players: list[Player]
    ):
        self.league = league
        self.teams = teams
        self.players = players

    def generate_schedule(
        self,
        teams: list[dict],
        games_per_season: int,
        start_date: str,
    ) -> list[Game]:
        """Generate a full regular-season schedule."""
        return []

    def simulate_day(
        self,
        date: str,
        games: list[Game],
        teams: list[Team],
        players: list[Player],
    ) -> list[GameResult]:
        """Simulate all games scheduled for a given date."""
        return []

    def simulate_to_date(
        self,
        target_date: str,
        schedule: list[Game],
        teams: list[Team],
        players: list[Player],
    ) -> list[GameResult]:
        """Simulate all games from the current date up to the target date."""
        return []

    def get_standings(self, teams: list[Team]) -> dict[str, list[Team]]:
        """Return teams grouped by conference, sorted by record."""
        return {}

    def get_playoff_seedings(
        self, teams: list[Team]
    ) -> dict[str, list[Team]]:
        """Determine playoff seedings per conference."""
        return {}

    def check_auto_stop(
        self, current_date: str, settings: LeagueSettings
    ) -> str | None:
        """Check if simulation should pause at a key date. Returns phase name or None."""
        return None

    def advance_phase(self, current_phase: str) -> str:
        """Transition to the next season phase."""
        return ""

    def get_games_on_date(
        self, schedule: list[Game], date: str
    ) -> list[Game]:
        """Filter schedule to games on a specific date."""
        return []

    def update_standings(
        self, teams: list[Team], result: GameResult
    ) -> None:
        """Update team season records based on a game result."""
        pass


class PlayoffEngine:
    """Playoff bracket management and series simulation."""

    def __init__(self, settings: LeagueSettings):
        self.settings = settings

    def generate_bracket(
        self,
        east_seeds: list[Team],
        west_seeds: list[Team],
    ) -> list[dict]:
        """Create the full playoff bracket from conference seedings."""
        return []

    def simulate_series(
        self,
        home_team: Team,
        away_team: Team,
        home_players: list[Player],
        away_players: list[Player],
    ) -> dict:
        """Simulate a best-of-seven playoff series."""
        return {}

    def advance_bracket(
        self, bracket: list[dict], completed_series: dict
    ) -> list[dict]:
        """Advance winners into the next round of the bracket."""
        return []

    def generate_play_in(
        self, seeds_7_to_10: list[Team], players: list[Player]
    ) -> list[Team]:
        """Run the play-in tournament and return the qualifying teams."""
        return []
