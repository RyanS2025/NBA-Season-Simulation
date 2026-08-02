from __future__ import annotations
from dataclasses import dataclass, field

@dataclass
class ShotAttempt:
    zone_id: str
    shot_type: str
    made: bool
    assisted: bool
    is_contested: bool
    assisted_by_player_id: str | None = None
    quarter: int = 1

@dataclass
class PlayerGameStats:
    player_id: str
    minutes: float = 0.0
    points: int = 0
    field_goals_made: int = 0
    field_goals_attempted: int = 0
    three_pointers_made: int = 0
    three_pointers_attempted: int = 0
    free_throws_made: int = 0
    free_throws_attempted: int = 0
    offensive_rebounds: int = 0
    defensive_rebounds: int = 0
    total_rebounds: int = 0
    assists: int = 0
    steals: int = 0
    blocks: int = 0
    turnovers: int = 0
    personal_fouls: int = 0
    plus_minus: int = 0
    shot_chart: list[ShotAttempt] = field(default_factory=list)

@dataclass
class TeamGameStats:
    fast_break_points: int = 0
    points_in_paint: int = 0
    second_chance_points: int = 0
    bench_points: int = 0
    turnovers: int = 0
    team_rebounds: int = 0
    biggest_lead: int = 0
    pace: float = 0.0

@dataclass
class TeamBoxScore:
    team_id: str
    player_stats: list[PlayerGameStats] = field(default_factory=list)
    team_stats: TeamGameStats = field(default_factory=TeamGameStats)

@dataclass
class GameResult:
    home_score: int = 0
    away_score: int = 0
    overtime: int = 0
    winning_team_id: str = ""
    home_box_score: TeamBoxScore | None = None
    away_box_score: TeamBoxScore | None = None
    quarter_scores: dict = field(default_factory=lambda: {"home": [], "away": []})

@dataclass
class GameState:
    quarter: int = 1
    game_clock: float = 720.0
    shot_clock: float = 24.0
    home_score: int = 0
    away_score: int = 0
    possession_team: str = "home"
    possession_count: int = 0
    home_lineup: list[str] = field(default_factory=list)
    away_lineup: list[str] = field(default_factory=list)

@dataclass
class PlayoffSeriesRef:
    series_id: str
    round: int
    home_team_id: str
    away_team_id: str
    home_wins: int = 0
    away_wins: int = 0
    is_complete: bool = False
    winner_team_id: str | None = None

@dataclass
class Game:
    id: str
    home_team_id: str
    away_team_id: str
    date: str
    is_playoff: bool = False
    neutral_site: bool = False
    result: GameResult | None = None
    playoff_series: PlayoffSeriesRef | None = None
