from __future__ import annotations
from dataclasses import dataclass, field
from .contract import CBAConstants

@dataclass
class AutoStopConfig:
    extension_deadline: bool = True
    trade_deadline: bool = True
    all_star_break: bool = True
    playoffs_start: bool = True
    draft_lottery: bool = True
    draft_night: bool = True
    free_agency: bool = True

@dataclass
class LeagueSettings:
    injuries_enabled: bool = True
    fatigue_enabled: bool = True
    cba_rules_enabled: bool = True
    trade_deadline_enabled: bool = True
    storylines_enabled: bool = True
    player_development_enabled: bool = True
    morale_enabled: bool = True
    all_star_weekend_enabled: bool = True
    background_trades_enabled: bool = True
    draft_lottery_enabled: bool = True
    simulation_speed: str = "fast"
    difficulty: str = "normal"
    playoff_format: str = "play_in"
    injury_frequency: str = "normal"
    trade_frequency: str = "normal"
    games_per_season: int = 82
    salary_cap_multiplier: float = 1.0
    quarter_length_minutes: int = 12
    draft_rounds: int = 2
    auto_stop_points: AutoStopConfig = field(default_factory=AutoStopConfig)

@dataclass
class SeasonSummary:
    year: int
    champion_team_id: str
    finalist_team_id: str
    mvp_player_id: str
    roty_player_id: str | None = None
    top_scorer_player_id: str = ""
    top_scorer_ppg: float = 0.0

@dataclass
class SeasonAwards:
    mvp: str = ""
    dpoy: str = ""
    roty: str = ""
    sixth_man: str = ""
    mip: str = ""
    coty: str = ""
    eoty: str = ""
    clutch_poy: str = ""
    all_nba: dict = field(default_factory=lambda: {"first": [], "second": [], "third": []})
    all_defensive: dict = field(default_factory=lambda: {"first": [], "second": []})
    all_rookie: dict = field(default_factory=lambda: {"first": [], "second": []})
    finals_mvp: str | None = None
    all_star_mvp: str | None = None

@dataclass
class Transaction:
    id: str
    date: str
    transaction_type: str
    details: dict = field(default_factory=dict)
    description: str = ""
    season_year: int = 0

@dataclass
class LeagueMeta:
    id: str
    name: str
    created_at: str
    last_saved_at: str
    user_team_id: str
    user_team_name: str
    current_season: int
    current_phase: str

@dataclass
class League:
    id: str
    name: str
    created_at: str
    last_saved_at: str
    settings: LeagueSettings = field(default_factory=LeagueSettings)
    current_season: int = 2027
    user_team_id: str = ""
    cba_constants: CBAConstants | None = None
    season_history: list[SeasonSummary] = field(default_factory=list)
