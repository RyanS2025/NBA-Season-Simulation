from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class InjuryRecord:
    injury_type: str
    severity: str
    body_part: str
    games_out: int
    season_year: int


@dataclass
class ActiveInjury:
    body_part: str
    injury_type: str
    severity: str
    games_remaining: int
    date_injured: str


@dataclass
class PlayerBio:
    first_name: str
    last_name: str
    position: str
    secondary_position: str | None
    height: int
    weight: int
    age: int
    years_in_league: int
    college: str | None
    country: str
    draft_year: int
    draft_round: int
    draft_pick: int
    jersey_number: int
    hand: str


@dataclass
class PlayerRatings:
    finishing: int
    close_range: int
    mid_range: int
    three_point: int
    free_throw: int
    post_game: int
    draw_foul: int
    off_ball_movement: int
    ball_handling: int
    passing_vision: int
    passing_accuracy: int

    perimeter_defense: int
    interior_defense: int
    shot_blocking: int
    stealing: int
    defensive_iq: int
    defensive_consistency: int

    speed: int
    acceleration: int
    lateral_quickness: int
    vertical: int
    strength: int
    stamina: int

    basketball_iq: int
    offensive_iq: int
    rebounding: int
    offensive_rebounding: int
    hustle: int

    overall: int
    potential: int
    peak_age: int


@dataclass
class ShotZone:
    zone_id: str
    tendency: float
    make_rate: float


@dataclass
class ShotChartProfile:
    zones: list[ShotZone]

    def get_zone(self, zone_id: str) -> ShotZone | None:
        for zone in self.zones:
            if zone.zone_id == zone_id:
                return zone
        return None


@dataclass
class PlayerTendencies:
    pull_up_frequency: int
    catch_and_shoot_frequency: int
    drive_frequency: int
    post_up_frequency: int
    iso_frequency: int
    pick_and_roll_ball_handler: int
    pick_and_roll_screener: int
    spot_up_frequency: int
    transition_frequency: int
    cut_frequency: int
    pass_out_of_drive_rate: int
    skip_pass_rate: int
    alley_oop_pass_rate: int
    gamble_for_steals: int
    help_defense_rate: int
    closeout_aggression: int
    box_out_rate: int
    usage_desire: int
    pace_preference: int
    foul_proneness: int
    shot_clock_tendency: int
    contested_shot_willingness: int


@dataclass
class CharacterTraits:
    leadership: int
    work_ethic: int
    clutch: int
    ego: int
    coachability: int
    temperament: int
    fan_favorite: int
    media_personality: int
    loyalty: int
    competitiveness: int


@dataclass
class DurabilityProfile:
    overall_durability: int
    ankle_health: int
    knee_health: int
    shoulder_health: int
    back_health: int
    wrist_hand_health: int
    foot_health: int
    concussion_risk: int
    soft_tissue_risk: int
    injury_history: list[InjuryRecord] = field(default_factory=list)


@dataclass
class PlayerStatus:
    health: str
    current_injury: ActiveInjury | None = None
    fatigue: float = 0.0
    morale: float = 1.0
    is_rookie: bool = False
    is_free_agent: bool = False
    is_restricted_fa: bool = False
    team_id: str | None = None


@dataclass
class Player:
    id: str
    bio: PlayerBio
    ratings: PlayerRatings
    shot_chart: ShotChartProfile
    tendencies: PlayerTendencies
    character: CharacterTraits
    durability: DurabilityProfile
    contract: Any = None
    status: PlayerStatus = field(default_factory=lambda: PlayerStatus(health="healthy"))
