from __future__ import annotations
from dataclasses import dataclass, field

@dataclass
class Coach:
    name: str
    offense_rating: int
    defense_rating: int
    player_development: int
    motivation: int
    adaptability: int
    experience: int

@dataclass
class CoachingStaff:
    head_coach: Coach
    offensive_scheme: str
    defensive_scheme: str
    pace_preference: int
    three_point_emphasis: int
    starter_minutes: list[float] = field(default_factory=lambda: [32.0, 32.0, 32.0, 32.0, 32.0])

@dataclass
class TeamInfo:
    city: str
    name: str
    abbreviation: str
    conference: str
    division: str
    primary_color: str
    secondary_color: str
    arena_name: str
    arena_capacity: int
    market_size: int

@dataclass
class RosterSlot:
    player_id: str
    roster_status: str
    lineup_position: int

@dataclass
class SeasonRecord:
    wins: int = 0
    losses: int = 0
    conference_wins: int = 0
    conference_losses: int = 0
    division_wins: int = 0
    division_losses: int = 0
    home_wins: int = 0
    home_losses: int = 0
    away_wins: int = 0
    away_losses: int = 0
    streak: int = 0
    last_10_wins: int = 0
    last_10_losses: int = 0
    points_for: int = 0
    points_against: int = 0

@dataclass
class DraftPickAsset:
    year: int
    round: int
    original_team_id: str
    current_owner_team_id: str
    protections: list[str] = field(default_factory=list)
    is_swap_right: bool = False

@dataclass
class TradeException:
    amount: int
    expiration_date: str
    source_trade_id: str

@dataclass
class CapHold:
    player_id: str
    player_name: str
    amount: int
    hold_type: str

@dataclass
class TeamFinances:
    salary_cap: int = 0
    total_payroll: int = 0
    luxury_tax_threshold: int = 0
    first_apron_threshold: int = 0
    second_apron_threshold: int = 0
    is_over_cap: bool = False
    is_in_luxury_tax: bool = False
    is_above_first_apron: bool = False
    is_above_second_apron: bool = False
    tax_bill: int = 0
    trade_exceptions: list[TradeException] = field(default_factory=list)
    cap_holds: list[CapHold] = field(default_factory=list)
    draft_picks: list[DraftPickAsset] = field(default_factory=list)

@dataclass
class PlayoffResult:
    season_year: int
    round_reached: str
    series_wins: int
    series_losses: int
    opponent_team_id: str

@dataclass
class TeamSeasonHistory:
    season_year: int
    wins: int
    losses: int
    playoff_result: PlayoffResult | None = None

@dataclass
class Team:
    id: str
    info: TeamInfo
    roster: list[RosterSlot] = field(default_factory=list)
    coaching: CoachingStaff | None = None
    finances: TeamFinances = field(default_factory=TeamFinances)
    chemistry: int = 50
    home_court_advantage: int = 5
    season_record: SeasonRecord = field(default_factory=SeasonRecord)
    history: list[TeamSeasonHistory] = field(default_factory=list)
