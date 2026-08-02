"""
Generate real NBA player data for BBAL Sim.

Pulls from nba_api:
  - All active players (bio, position, measurements)
  - Career stats per season (per-game averages)
  - Player awards (MVP, All-NBA, All-Star, etc.)

Converts real stats → game ratings (65-99 scale) using
percentile-based formulas with position weighting.

Outputs: frontend/public/data/players_2026_27.json
"""

import json
import time
import uuid
import os
import sys
import traceback
from pathlib import Path

import pandas as pd
from nba_api.stats.endpoints import (
    commonallplayers,
    playercareerstats,
    playerawards,
    commonplayerinfo,
)
from nba_api.stats.static import players as static_players

# ── Paths ──────────────────────────────────────────────────────────────
ROOT = Path(__file__).resolve().parent.parent
TEAMS_JSON = ROOT / "frontend" / "public" / "data" / "teams.json"
OUTPUT_JSON = ROOT / "frontend" / "public" / "data" / "players_2026_27.json"

# ── NBA → Fictional team mapping ──────────────────────────────────────
# Real NBA team_id (from nba_api) → our fictional abbreviation
NBA_TEAM_ID_TO_ABBR = {
    1610612738: "BOS",  # Boston Celtics → Boston Minutemen
    1610612752: "NYT",  # New York Knicks → New York Titans
    1610612755: "PHI",  # Philadelphia 76ers → Philadelphia Ironworks
    1610612761: "TOR",  # Toronto Raptors → Toronto Raptides
    1610612751: "BKN",  # Brooklyn Nets → Brooklyn Specters
    1610612741: "CHI",  # Chicago Bulls → Chicago Forge
    1610612739: "CLE",  # Cleveland Cavaliers → Cleveland Ironclad
    1610612749: "MIL",  # Milwaukee Bucks → Milwaukee Stags
    1610612754: "IND",  # Indiana Pacers → Indiana Diesels
    1610612765: "DET",  # Detroit Pistons → Detroit Gears
    1610612748: "MIA",  # Miami Heat → Miami Tides
    1610612737: "ATL",  # Atlanta Hawks → Atlanta Phoenixes
    1610612766: "CHA",  # Charlotte Hornets → Charlotte Swarm
    1610612764: "WAS",  # Washington Wizards → Washington Monuments
    1610612753: "ORL",  # Orlando Magic → Orlando Spectrums
    1610612743: "DEN",  # Denver Nuggets → Denver Altitude
    1610612757: "POR",  # Portland Trail Blazers → Portland Lumberjacks
    1610612750: "MIN",  # Minnesota Timberwolves → Minnesota Blizzard
    1610612760: "OKC",  # Oklahoma City Thunder → OKC Cyclones
    1610612762: "UTA",  # Utah Jazz → Utah Prospectors
    1610612747: "LAV",  # LA Lakers → Los Angeles Vipers
    1610612744: "GSS",  # Golden State Warriors → Golden State Samurai
    1610612758: "SAC",  # Sacramento Kings → Sacramento Empire
    1610612756: "PHX",  # Phoenix Suns → Phoenix Scorchers
    1610612746: "LAW",  # LA Clippers → Los Angeles Waves
    1610612742: "DAL",  # Dallas Mavericks → Dallas Mustangs
    1610612745: "HOU",  # Houston Rockets → Houston Comets
    1610612759: "SAS",  # San Antonio Spurs → San Antonio Coyotes
    1610612763: "MEM",  # Memphis Grizzlies → Memphis Blues
    1610612740: "NOP",  # New Orleans Pelicans → New Orleans Krewe
}

# NBA team abbreviation (3-letter) → our abbreviation
NBA_ABBR_TO_OURS = {
    "BOS": "BOS", "NYK": "NYT", "PHI": "PHI", "TOR": "TOR", "BKN": "BKN",
    "CHI": "CHI", "CLE": "CLE", "MIL": "MIL", "IND": "IND", "DET": "DET",
    "MIA": "MIA", "ATL": "ATL", "CHA": "CHA", "WAS": "WAS", "ORL": "ORL",
    "DEN": "DEN", "POR": "POR", "MIN": "MIN", "OKC": "OKC", "UTA": "UTA",
    "LAL": "LAV", "GSW": "GSS", "SAC": "SAC", "PHX": "PHX", "LAC": "LAW",
    "DAL": "DAL", "HOU": "HOU", "SAS": "SAS", "MEM": "MEM", "NOP": "NOP",
    "PHO": "PHX", "GS": "GSS", "SA": "SAS", "NY": "NYT", "NO": "NOP",
    "UTAH": "UTA",
}

# ── Load our fictional team IDs ───────────────────────────────────────
def load_team_ids() -> dict[str, str]:
    """Returns {our_abbr: team_uuid}."""
    with open(TEAMS_JSON) as f:
        teams = json.load(f)
    return {t["info"]["abbreviation"]: t["id"] for t in teams}


# ── Headshot URL ──────────────────────────────────────────────────────
def headshot_url(nba_player_id: int) -> str:
    return f"https://cdn.nba.com/headshots/nba/latest/1040x760/{nba_player_id}.png"


# ── Position normalization ────────────────────────────────────────────
POSITION_MAP = {
    "Guard-Forward": "SG", "Forward-Guard": "SF",
    "Forward-Center": "PF", "Center": "C",
    "Center-Forward": "C",
    "G-F": "SG", "F-G": "SF", "F-C": "PF", "C-F": "C",
    "PG": "PG", "SG": "SG", "SF": "SF", "PF": "PF", "C": "C",
}

SECONDARY_POS = {
    "PG": "SG", "SG": "PG", "SF": "PF", "PF": "SF", "C": "PF",
}


def resolve_position(pos_raw: str, height_inches: int) -> str:
    """Resolve ambiguous positions using height as a tiebreaker."""
    if pos_raw in POSITION_MAP:
        return POSITION_MAP[pos_raw]
    if pos_raw in ("Guard", "G"):
        return "PG" if height_inches <= 75 else "SG"  # 6'3" cutoff
    if pos_raw in ("Forward", "F"):
        return "SF" if height_inches <= 80 else "PF"  # 6'8" cutoff
    return "SF"


# ── Stat → Rating conversion ─────────────────────────────────────────

def clamp(val: float, lo: float = 65.0, hi: float = 99.0) -> int:
    return int(max(lo, min(hi, round(val))))


def percentile_to_rating(value: float, values: list[float], floor: int = 65, ceil: int = 99) -> int:
    if not values or len(values) < 2:
        return (floor + ceil) // 2
    sorted_vals = sorted(values)
    n = len(sorted_vals)
    rank = sum(1 for v in sorted_vals if v <= value)
    pct = rank / n
    return clamp(floor + pct * (ceil - floor), floor, ceil)


def stats_to_ratings(stats: dict, all_stats: list[dict], position: str) -> dict:
    if not stats:
        return default_ratings(position)

    ppg = stats.get("ppg", 0)
    rpg = stats.get("rpg", 0)
    apg = stats.get("apg", 0)
    spg = stats.get("spg", 0)
    bpg = stats.get("bpg", 0)
    fg_pct = stats.get("fg_pct", 0)
    three_pct = stats.get("three_pct", 0)
    ft_pct = stats.get("ft_pct", 0)
    topg = stats.get("topg", 0)
    mpg = stats.get("mpg", 0)
    three_pa = stats.get("three_pa", 0)
    fta = stats.get("fta", 0)

    all_ppg = [s.get("ppg", 0) for s in all_stats]
    all_rpg = [s.get("rpg", 0) for s in all_stats]
    all_apg = [s.get("apg", 0) for s in all_stats]
    all_spg = [s.get("spg", 0) for s in all_stats]
    all_bpg = [s.get("bpg", 0) for s in all_stats]
    all_fg = [s.get("fg_pct", 0) for s in all_stats]
    all_mpg = [s.get("mpg", 0) for s in all_stats]
    all_fta = [s.get("fta", 0) for s in all_stats]

    three_volume = three_pa * (three_pct / 100) if three_pct > 0 else 0
    all_3vol = [s.get("three_pa", 0) * (s.get("three_pct", 0) / 100) for s in all_stats]

    ft_volume = fta * (ft_pct / 100) if ft_pct > 0 else 0
    all_ft_vol = [s.get("fta", 0) * (s.get("ft_pct", 0) / 100) for s in all_stats]

    scoring_composite = ppg * (fg_pct / 100) if fg_pct > 0 else 0
    all_scoring = [s.get("ppg", 0) * (s.get("fg_pct", 0) / 100) for s in all_stats]

    ast_to = apg / max(topg, 0.5)
    all_ast_to = [s.get("apg", 0) / max(s.get("topg", 0.5), 0.5) for s in all_stats]

    ratings = {}

    # Offensive
    ratings["finishing"] = percentile_to_rating(scoring_composite, all_scoring, 65, 99)
    ratings["close_range"] = percentile_to_rating(fg_pct, all_fg, 65, 97)
    ratings["mid_range"] = percentile_to_rating(ppg * 0.4 + fg_pct * 0.6, [s.get("ppg",0)*0.4+s.get("fg_pct",0)*0.6 for s in all_stats], 65, 96)
    ratings["three_point"] = percentile_to_rating(three_volume, all_3vol, 65, 99)
    ratings["free_throw"] = percentile_to_rating(ft_volume, all_ft_vol, 65, 97)
    ratings["post_game"] = percentile_to_rating(rpg * 0.3 + ppg * 0.2 + fg_pct * 0.5, [s.get("rpg",0)*0.3+s.get("ppg",0)*0.2+s.get("fg_pct",0)*0.5 for s in all_stats], 65, 95)
    ratings["draw_foul"] = percentile_to_rating(fta, all_fta, 65, 95)
    ratings["off_ball_movement"] = percentile_to_rating(ppg * 0.5 + fg_pct * 0.5, [s.get("ppg",0)*0.5+s.get("fg_pct",0)*0.5 for s in all_stats], 65, 95)
    ratings["ball_handling"] = percentile_to_rating(apg * 0.6 + ppg * 0.4, [s.get("apg",0)*0.6+s.get("ppg",0)*0.4 for s in all_stats], 65, 97)
    ratings["passing_vision"] = percentile_to_rating(apg, all_apg, 65, 98)
    ratings["passing_accuracy"] = percentile_to_rating(ast_to, all_ast_to, 65, 95)

    # Defensive
    ratings["perimeter_defense"] = percentile_to_rating(spg * 0.7 + mpg * 0.3, [s.get("spg",0)*0.7+s.get("mpg",0)*0.3 for s in all_stats], 65, 95)
    ratings["interior_defense"] = percentile_to_rating(bpg * 0.6 + rpg * 0.4, [s.get("bpg",0)*0.6+s.get("rpg",0)*0.4 for s in all_stats], 65, 97)
    ratings["shot_blocking"] = percentile_to_rating(bpg, all_bpg, 65, 99)
    ratings["stealing"] = percentile_to_rating(spg, all_spg, 65, 97)
    ratings["defensive_iq"] = percentile_to_rating(spg * 0.4 + bpg * 0.3 + rpg * 0.3, [s.get("spg",0)*0.4+s.get("bpg",0)*0.3+s.get("rpg",0)*0.3 for s in all_stats], 65, 95)
    ratings["defensive_consistency"] = percentile_to_rating(mpg * 0.5 + spg * 0.3 + bpg * 0.2, [s.get("mpg",0)*0.5+s.get("spg",0)*0.3+s.get("bpg",0)*0.2 for s in all_stats], 65, 93)

    # Physical
    pos_speed = {"PG": 10, "SG": 6, "SF": 3, "PF": -2, "C": -6}
    pos_strength = {"PG": -8, "SG": -4, "SF": 0, "PF": 5, "C": 10}
    pos_vertical = {"PG": 2, "SG": 4, "SF": 3, "PF": 0, "C": -3}

    base_physical = percentile_to_rating(mpg, all_mpg, 68, 90)
    ratings["speed"] = clamp(base_physical + pos_speed.get(position, 0))
    ratings["acceleration"] = clamp(base_physical + pos_speed.get(position, 0) - 2)
    ratings["lateral_quickness"] = clamp(base_physical + pos_speed.get(position, 0) - 1)
    ratings["vertical"] = clamp(base_physical + pos_vertical.get(position, 0))
    ratings["strength"] = clamp(base_physical + pos_strength.get(position, 0))
    ratings["stamina"] = percentile_to_rating(mpg, all_mpg, 70, 95)

    # Mental
    ratings["basketball_iq"] = percentile_to_rating(apg * 0.3 + ast_to * 0.3 + mpg * 0.2 + ppg * 0.2, [s.get("apg",0)*0.3+(s.get("apg",0)/max(s.get("topg",0.5),0.5))*0.3+s.get("mpg",0)*0.2+s.get("ppg",0)*0.2 for s in all_stats], 65, 97)
    ratings["offensive_iq"] = percentile_to_rating(ppg * 0.4 + apg * 0.3 + fg_pct * 0.3, [s.get("ppg",0)*0.4+s.get("apg",0)*0.3+s.get("fg_pct",0)*0.3 for s in all_stats], 65, 97)
    ratings["rebounding"] = percentile_to_rating(rpg, all_rpg, 65, 99)
    ratings["offensive_rebounding"] = clamp(ratings["rebounding"] - 10 + (5 if position in ("C", "PF") else 0), 65, 92)
    ratings["hustle"] = percentile_to_rating(spg * 0.3 + rpg * 0.3 + mpg * 0.2 + bpg * 0.2, [s.get("spg",0)*0.3+s.get("rpg",0)*0.3+s.get("mpg",0)*0.2+s.get("bpg",0)*0.2 for s in all_stats], 65, 95)

    # Overall placeholder — recalculated in apply_overrides with intangibles
    ratings["overall"] = 75
    ratings["intangibles"] = 75

    age = stats.get("age", 25)
    if age and age <= 22:
        ratings["potential"] = clamp(ratings["overall"] + 8, 70, 99)
        ratings["peak_age"] = 27
    elif age and age <= 25:
        ratings["potential"] = clamp(ratings["overall"] + 4, 70, 99)
        ratings["peak_age"] = 28
    elif age and age <= 28:
        ratings["potential"] = clamp(ratings["overall"] + 1, 70, 99)
        ratings["peak_age"] = 28
    else:
        ratings["potential"] = ratings["overall"]
        ratings["peak_age"] = max(25, (age or 30) - 1)

    return ratings


def default_ratings(position: str) -> dict:
    base = 70
    return {
        "finishing": base, "close_range": base, "mid_range": base,
        "three_point": base - 2, "free_throw": base, "post_game": base - 3,
        "draw_foul": base, "off_ball_movement": base, "ball_handling": base,
        "passing_vision": base, "passing_accuracy": base,
        "perimeter_defense": base, "interior_defense": base,
        "shot_blocking": base - 3, "stealing": base, "defensive_iq": base,
        "defensive_consistency": base,
        "speed": base, "acceleration": base, "lateral_quickness": base,
        "vertical": base, "strength": base, "stamina": base,
        "basketball_iq": base, "offensive_iq": base, "rebounding": base,
        "offensive_rebounding": base - 5, "hustle": base,
        "overall": base, "intangibles": 75, "potential": base + 5, "peak_age": 27,
    }


# ── Shot chart generation ─────────────────────────────────────────────

def generate_shot_chart(stats: dict, position: str) -> dict:
    three_pct = stats.get("three_pct", 35) / 100 if stats else 0.35
    fg_pct = stats.get("fg_pct", 45) / 100 if stats else 0.45
    three_pa = stats.get("three_pa", 3) if stats else 3
    rpg = stats.get("rpg", 4) if stats else 4

    if position == "C":
        tendencies = {
            "restricted_area": 0.35, "paint_non_ra": 0.15, "post_up": 0.12,
            "midrange_left_baseline": 0.03, "midrange_left_wing": 0.03,
            "midrange_center": 0.04, "midrange_right_wing": 0.03,
            "midrange_right_baseline": 0.03,
            "three_left_corner": 0.03, "three_left_wing": 0.05,
            "three_center": 0.06, "three_right_wing": 0.05,
            "three_right_corner": 0.03, "backcourt": 0.00,
        }
    elif position == "PF":
        tendencies = {
            "restricted_area": 0.25, "paint_non_ra": 0.12, "post_up": 0.06,
            "midrange_left_baseline": 0.04, "midrange_left_wing": 0.04,
            "midrange_center": 0.05, "midrange_right_wing": 0.04,
            "midrange_right_baseline": 0.04,
            "three_left_corner": 0.05, "three_left_wing": 0.08,
            "three_center": 0.09, "three_right_wing": 0.08,
            "three_right_corner": 0.05, "backcourt": 0.01,
        }
    elif position in ("PG", "SG"):
        tendencies = {
            "restricted_area": 0.18, "paint_non_ra": 0.08, "post_up": 0.02,
            "midrange_left_baseline": 0.04, "midrange_left_wing": 0.05,
            "midrange_center": 0.06, "midrange_right_wing": 0.05,
            "midrange_right_baseline": 0.04,
            "three_left_corner": 0.06, "three_left_wing": 0.10,
            "three_center": 0.13, "three_right_wing": 0.10,
            "three_right_corner": 0.06, "backcourt": 0.01,
        }
    else:
        tendencies = {
            "restricted_area": 0.20, "paint_non_ra": 0.09, "post_up": 0.04,
            "midrange_left_baseline": 0.04, "midrange_left_wing": 0.05,
            "midrange_center": 0.06, "midrange_right_wing": 0.05,
            "midrange_right_baseline": 0.04,
            "three_left_corner": 0.06, "three_left_wing": 0.09,
            "three_center": 0.11, "three_right_wing": 0.09,
            "three_right_corner": 0.06, "backcourt": 0.01,
        }

    if three_pa > 6:
        boost = min(0.08, (three_pa - 6) * 0.01)
        for zone in ["three_left_wing", "three_center", "three_right_wing"]:
            tendencies[zone] += boost / 3
        tendencies["restricted_area"] -= boost * 0.5
        tendencies["paint_non_ra"] -= boost * 0.3
        tendencies["post_up"] -= boost * 0.2

    total = sum(tendencies.values())
    if total > 0:
        tendencies = {k: round(v / total, 3) for k, v in tendencies.items()}

    zones = []
    for zone_id, tendency in tendencies.items():
        if zone_id == "restricted_area":
            make_rate = round(min(0.80, 0.55 + fg_pct * 0.25 + rpg * 0.005), 3)
        elif zone_id == "paint_non_ra":
            make_rate = round(min(0.55, 0.35 + fg_pct * 0.15), 3)
        elif zone_id.startswith("midrange_"):
            make_rate = round(min(0.55, 0.35 + fg_pct * 0.12), 3)
        elif zone_id.startswith("three_"):
            make_rate = round(min(0.48, max(0.28, three_pct * 0.95 + 0.02)), 3)
        elif zone_id == "post_up":
            make_rate = round(min(0.55, 0.38 + fg_pct * 0.12), 3)
        elif zone_id == "backcourt":
            make_rate = 0.02
        else:
            make_rate = round(fg_pct * 0.8, 3)
        zones.append({"zone_id": zone_id, "tendency": tendency, "make_rate": make_rate})

    return {"zones": zones}


# ── Tendencies ────────────────────────────────────────────────────────

def generate_tendencies(stats: dict, position: str) -> dict:
    ppg = stats.get("ppg", 10) if stats else 10
    apg = stats.get("apg", 3) if stats else 3
    rpg = stats.get("rpg", 4) if stats else 4
    spg = stats.get("spg", 0.8) if stats else 0.8
    three_pa = stats.get("three_pa", 3) if stats else 3
    fta = stats.get("fta", 2) if stats else 2
    mpg = stats.get("mpg", 20) if stats else 20

    usage = min(95, int(50 + ppg * 1.5 + apg * 0.5))
    iso = min(90, int(30 + ppg * 1.2 - apg * 0.5))

    pm = {"PG": {"pnr_bh": 20, "pnr_sc": -15, "post": -20, "drive": 10, "spot": -5, "cut": -5},
          "SG": {"pnr_bh": 5, "pnr_sc": -10, "post": -15, "drive": 5, "spot": 10, "cut": 0},
          "SF": {"pnr_bh": -5, "pnr_sc": -5, "post": -5, "drive": 0, "spot": 5, "cut": 5},
          "PF": {"pnr_bh": -15, "pnr_sc": 15, "post": 10, "drive": -5, "spot": 0, "cut": 5},
          "C":  {"pnr_bh": -20, "pnr_sc": 25, "post": 25, "drive": -15, "spot": -10, "cut": 0},
          }.get(position, {"pnr_bh": 0, "pnr_sc": 0, "post": 0, "drive": 0, "spot": 0, "cut": 0})

    return {
        "pull_up_frequency": clamp(40 + ppg * 0.8 + pm["drive"], 10, 95),
        "catch_and_shoot_frequency": clamp(40 + three_pa * 2.5 + pm["spot"], 10, 95),
        "drive_frequency": clamp(35 + ppg * 0.6 + pm["drive"], 10, 95),
        "post_up_frequency": clamp(20 + rpg * 1.5 + pm["post"], 5, 95),
        "iso_frequency": clamp(iso, 10, 95),
        "pick_and_roll_ball_handler": clamp(40 + apg * 2 + pm["pnr_bh"], 5, 95),
        "pick_and_roll_screener": clamp(30 + rpg * 1.5 + pm["pnr_sc"], 5, 95),
        "spot_up_frequency": clamp(35 + three_pa * 2 + pm["spot"], 10, 95),
        "transition_frequency": clamp(40 + ppg * 0.5 + spg * 5, 15, 90),
        "cut_frequency": clamp(25 + ppg * 0.3 + pm["cut"], 10, 80),
        "pass_out_of_drive_rate": clamp(30 + apg * 3, 10, 85),
        "skip_pass_rate": clamp(25 + apg * 2, 10, 80),
        "alley_oop_pass_rate": clamp(15 + apg * 1.5, 5, 60),
        "gamble_for_steals": clamp(25 + spg * 15, 10, 85),
        "help_defense_rate": clamp(45 + rpg * 1.5 + spg * 3, 20, 90),
        "closeout_aggression": clamp(40 + spg * 10, 15, 85),
        "box_out_rate": clamp(30 + rpg * 3, 15, 90),
        "usage_desire": clamp(usage, 20, 95),
        "pace_preference": clamp(50 + ppg * 0.3 + apg * 0.5, 30, 85),
        "foul_proneness": clamp(35 + fta * 1.5, 15, 75),
        "shot_clock_tendency": clamp(45 + ppg * 0.3, 25, 80),
        "contested_shot_willingness": clamp(30 + ppg * 1.0, 15, 90),
    }


# ── Character traits ──────────────────────────────────────────────────

def generate_character(stats: dict, years: int) -> dict:
    import random
    mpg = stats.get("mpg", 20) if stats else 20
    ppg = stats.get("ppg", 10) if stats else 10
    apg = stats.get("apg", 3) if stats else 3
    return {
        "leadership": clamp(50 + years * 3 + apg * 1.5 + random.randint(-8, 8), 30, 95),
        "work_ethic": clamp(65 + mpg * 0.3 + random.randint(-10, 10), 40, 95),
        "clutch": clamp(55 + ppg * 0.5 + random.randint(-12, 12), 30, 95),
        "ego": clamp(40 + ppg * 0.8 + random.randint(-10, 10), 20, 90),
        "coachability": clamp(70 + random.randint(-15, 15), 35, 95),
        "temperament": clamp(65 + random.randint(-15, 15), 30, 95),
        "fan_favorite": clamp(45 + ppg * 0.8 + apg * 0.5 + random.randint(-10, 10), 20, 95),
        "media_personality": clamp(50 + ppg * 0.5 + random.randint(-12, 12), 20, 95),
        "loyalty": clamp(60 + random.randint(-15, 15), 25, 95),
        "competitiveness": clamp(65 + ppg * 0.3 + random.randint(-10, 10), 40, 99),
    }


# ── Durability ────────────────────────────────────────────────────────

def generate_durability(age: int, gp: int) -> dict:
    import random
    gp_factor = min(1.0, gp / 70)
    base = int(70 + gp_factor * 15 + random.randint(-5, 5))
    age_penalty = max(0, (age - 28) * 2) if age > 28 else 0
    base = max(40, base - age_penalty)
    return {
        "overall_durability": clamp(base, 40, 95),
        "ankle_health": clamp(base + random.randint(-8, 8), 40, 99),
        "knee_health": clamp(base + random.randint(-8, 8), 40, 99),
        "shoulder_health": clamp(base + random.randint(-5, 5), 45, 99),
        "back_health": clamp(base + random.randint(-5, 5), 45, 99),
        "wrist_hand_health": clamp(base + random.randint(-3, 3), 50, 99),
        "foot_health": clamp(base + random.randint(-5, 5), 45, 99),
        "concussion_risk": clamp(90 - random.randint(0, 15), 50, 99),
        "soft_tissue_risk": clamp(base + random.randint(-5, 5), 40, 99),
        "injury_history": [],
    }


# ── Contract ──────────────────────────────────────────────────────────

def generate_contract(overall: int, age: int, years_in_league: int) -> dict:
    if overall >= 93:
        salary = 45_000_000 + (overall - 93) * 3_000_000
        years = max(1, 5 - max(0, age - 28))
        ctype = "Designated Veteran Max" if years_in_league >= 8 else "Supermax"
    elif overall >= 88:
        salary = 30_000_000 + (overall - 88) * 3_000_000
        years = max(1, 4 - max(0, age - 30))
        ctype = "Max"
    elif overall >= 82:
        salary = 18_000_000 + (overall - 82) * 2_000_000
        years = max(1, 4 - max(0, age - 30))
        ctype = "Standard"
    elif overall >= 76:
        salary = 8_000_000 + (overall - 76) * 1_500_000
        years = max(1, 3 - max(0, age - 31))
        ctype = "Standard"
    elif overall >= 72:
        salary = 3_000_000 + (overall - 72) * 1_000_000
        years = max(1, 2)
        ctype = "MLE" if overall >= 74 else "Standard"
    else:
        salary = 1_800_000 + (overall - 65) * 200_000
        years = 1
        ctype = "Minimum"
    if years_in_league <= 4:
        ctype = "Rookie Scale"
        salary = min(salary, 12_000_000)
    return {
        "annual_salary": salary,
        "years_remaining": max(1, years),
        "total_years": years,
        "contract_type": ctype,
        "no_trade_clause": overall >= 93 and years_in_league >= 8,
        "player_option": overall >= 90 and age <= 30,
        "team_option": years_in_league <= 4,
        "guaranteed": True,
    }


# ── Award parsing ─────────────────────────────────────────────────────

def parse_awards(awards_data: list[dict]) -> list[str]:
    results = []
    for row in awards_data:
        desc = row.get("DESCRIPTION", "")
        season = row.get("SEASON", "")
        if not desc:
            continue
        if "All-NBA" in desc or "All-Defensive" in desc or "All-Rookie" in desc:
            results.append(f"{season} {desc}")
        elif "All Star" in desc or "All-Star" in desc:
            results.append(f"{season} All-Star")
        elif "MVP" in desc and "All-Star" not in desc:
            results.append(f"{season} {desc}")
        elif "Rookie of the Year" in desc:
            results.append(f"{season} Rookie of the Year")
        elif "Defensive Player" in desc:
            results.append(f"{season} Defensive Player of the Year")
        elif "Most Improved" in desc:
            results.append(f"{season} Most Improved Player")
        elif "Sixth Man" in desc:
            results.append(f"{season} Sixth Man of the Year")
        elif "Champion" in desc.lower():
            results.append(f"{season} NBA Champion")
        elif desc.strip():
            results.append(f"{season} {desc}")
    return sorted(set(results), reverse=True)


# ── Height parsing ───────────────────────────────────────────────────

def parse_height(height_str: str) -> int:
    if not height_str:
        return 78
    try:
        if "-" in str(height_str):
            parts = str(height_str).split("-")
            return int(parts[0]) * 12 + int(parts[1])
        return int(height_str)
    except (ValueError, IndexError):
        return 78


# ── Manual overrides ──────────────────────────────────────────────────

# Intangibles: adjusts displayed overall only — sim engine ignores this.
# Captures reputation, leadership, clutch factor, BBIQ beyond stats.
# Scale: 65 = below avg, 75 = avg, 85 = good, 90+ = elite, 99 = GOAT-tier
INTANGIBLES = {
    "Nikola Jokić": 99, "Shai Gilgeous-Alexander": 97,
    "Luka Dončić": 97, "Giannis Antetokounmpo": 98, "Jayson Tatum": 95,
    "Anthony Edwards": 94, "LeBron James": 97, "Kevin Durant": 95,
    "Joel Embiid": 94, "Stephen Curry": 97, "Jaylen Brown": 90,
    "Donovan Mitchell": 90, "Anthony Davis": 92, "Victor Wembanyama": 92,
    "Jalen Brunson": 90, "Tyrese Haliburton": 88, "De'Aaron Fox": 88,
    "Domantas Sabonis": 88, "Paolo Banchero": 87, "Ja Morant": 89,
    "Trae Young": 87, "Devin Booker": 90, "Tyrese Maxey": 87,
    "Evan Mobley": 87, "Franz Wagner": 86, "Chet Holmgren": 86,
    "Bam Adebayo": 88, "Karl-Anthony Towns": 86, "Scottie Barnes": 86,
    "LaMelo Ball": 85, "Zion Williamson": 86, "Kristaps Porziņģis": 85,
    "Lauri Markkanen": 84, "Darius Garland": 84, "James Harden": 88,
    "Cade Cunningham": 85, "Jalen Williams": 85,
    "Jrue Holiday": 90, "Jamal Murray": 86, "Derrick White": 87,
    "Alperen Sengun": 84, "Dejounte Murray": 83, "Pascal Siakam": 84,
    "Mikal Bridges": 83, "Desmond Bane": 82, "Brandon Ingram": 83,
    "Anfernee Simons": 80, "Jarrett Allen": 82, "CJ McCollum": 82,
    "Aaron Gordon": 82, "Jabari Smith Jr.": 80,
    "Jimmy Butler III": 90, "Kawhi Leonard": 93, "Kyrie Irving": 90,
    "Damian Lillard": 90, "Chris Paul": 88, "Fred VanVleet": 84,
    "Ben Simmons": 78, "Russell Westbrook": 82,
}

PHYSICAL_OVERRIDES = {
    "Giannis Antetokounmpo": {"speed": 92, "vertical": 93, "strength": 95, "acceleration": 91},
    "Anthony Edwards": {"speed": 93, "vertical": 94, "strength": 85, "acceleration": 93},
    "Ja Morant": {"speed": 95, "vertical": 96, "strength": 72, "acceleration": 95},
    "Zion Williamson": {"speed": 82, "vertical": 92, "strength": 96, "acceleration": 85},
    "LeBron James": {"speed": 82, "vertical": 80, "strength": 92, "acceleration": 80},
    "Victor Wembanyama": {"speed": 78, "vertical": 85, "strength": 72, "shot_blocking": 95, "interior_defense": 93},
    "Anthony Davis": {"speed": 80, "vertical": 85, "strength": 88, "shot_blocking": 93, "interior_defense": 92},
    "Stephen Curry": {"speed": 82, "vertical": 74, "strength": 65, "three_point": 99, "ball_handling": 95},
    "Nikola Jokić": {"speed": 68, "vertical": 68, "strength": 88, "passing_vision": 98, "basketball_iq": 99, "offensive_iq": 99},
    "Luka Dončić": {"speed": 75, "vertical": 74, "strength": 82, "passing_vision": 95, "ball_handling": 94},
    "Shai Gilgeous-Alexander": {"speed": 85, "vertical": 82, "strength": 78, "draw_foul": 95, "finishing": 96},
    "Joel Embiid": {"speed": 72, "vertical": 80, "strength": 93, "post_game": 96, "interior_defense": 90},
    "Chet Holmgren": {"speed": 78, "vertical": 83, "strength": 68, "shot_blocking": 92},
    "Bam Adebayo": {"speed": 80, "vertical": 82, "strength": 90, "perimeter_defense": 88, "interior_defense": 88},
    "Jrue Holiday": {"perimeter_defense": 92, "stealing": 88, "defensive_iq": 93, "defensive_consistency": 92},
    "Derrick White": {"perimeter_defense": 88, "shot_blocking": 80, "defensive_iq": 88},
}


def apply_overrides(name: str, ratings: dict) -> dict:
    ratings["intangibles"] = INTANGIBLES.get(name, 75)

    if name in PHYSICAL_OVERRIDES:
        for key, val in PHYSICAL_OVERRIDES[name].items():
            ratings[key] = val

    # Recalculate overall WITH intangibles (cosmetic only — sim ignores this)
    off_ratings = [ratings["finishing"], ratings["three_point"], ratings["mid_range"],
                   ratings["free_throw"], ratings["ball_handling"], ratings["passing_vision"]]
    def_ratings = [ratings["perimeter_defense"], ratings["interior_defense"],
                   ratings["shot_blocking"], ratings["stealing"], ratings["defensive_iq"]]
    phys_ratings = [ratings["speed"], ratings["vertical"], ratings["strength"], ratings["stamina"]]
    mental_ratings = [ratings["basketball_iq"], ratings["rebounding"], ratings["hustle"]]

    raw_overall = (
        sum(off_ratings) / len(off_ratings) * 0.35 +
        sum(def_ratings) / len(def_ratings) * 0.20 +
        sum(phys_ratings) / len(phys_ratings) * 0.10 +
        sum(mental_ratings) / len(mental_ratings) * 0.15 +
        ratings["intangibles"] * 0.20
    )
    ratings["overall"] = clamp(raw_overall, 65, 99)

    if ratings["potential"] < ratings["overall"]:
        ratings["potential"] = min(99, ratings["overall"] + 1)

    return ratings


# ── API fetchers ──────────────────────────────────────────────────────

SEASON = "2025-26"

def fetch_active_players() -> list[dict]:
    print(f"Fetching active player list for {SEASON}...")
    result = commonallplayers.CommonAllPlayers(is_only_current_season=0, season=SEASON)
    df = result.get_data_frames()[0]
    active = df[df["ROSTERSTATUS"] == 1].copy()
    on_team = active[active["TEAM_ID"] != 0]
    print(f"  Found {len(active)} active players, {len(on_team)} on NBA teams")
    return on_team.to_dict("records")


def fetch_player_stats(player_id: int) -> tuple[list[dict], dict]:
    try:
        career = playercareerstats.PlayerCareerStats(player_id=player_id, per_mode36="PerGame")
        df = career.get_data_frames()[0]
        if df.empty:
            return [], {}
        seasons = []
        for _, row in df.iterrows():
            season_abbr = NBA_ABBR_TO_OURS.get(row.get("TEAM_ABBREVIATION", ""), row.get("TEAM_ABBREVIATION", ""))
            seasons.append({
                "season": row.get("SEASON_ID", ""), "team": season_abbr,
                "gp": int(row.get("GP", 0)), "gs": int(row.get("GS", 0)),
                "mpg": round(row.get("MIN", 0), 1),
                "ppg": round(row.get("PTS", 0), 1), "rpg": round(row.get("REB", 0), 1),
                "apg": round(row.get("AST", 0), 1), "spg": round(row.get("STL", 0), 1),
                "bpg": round(row.get("BLK", 0), 1), "topg": round(row.get("TOV", 0), 1),
                "fgm": round(row.get("FGM", 0), 1), "fga": round(row.get("FGA", 0), 1),
                "fg_pct": round(row.get("FG_PCT", 0) * 100, 1) if row.get("FG_PCT") else 0,
                "three_pm": round(row.get("FG3M", 0), 1), "three_pa": round(row.get("FG3A", 0), 1),
                "three_pct": round(row.get("FG3_PCT", 0) * 100, 1) if row.get("FG3_PCT") else 0,
                "ftm": round(row.get("FTM", 0), 1), "fta": round(row.get("FTA", 0), 1),
                "ft_pct": round(row.get("FT_PCT", 0) * 100, 1) if row.get("FT_PCT") else 0,
                "orpg": round(row.get("OREB", 0), 1), "drpg": round(row.get("DREB", 0), 1),
                "pfpg": round(row.get("PF", 0), 1),
            })
        target_season = df[(df["SEASON_ID"] == SEASON) & (df["MIN"] > 5)]
        if not target_season.empty:
            recent = target_season
        else:
            recent = df[df["MIN"] > 5].sort_values("SEASON_ID", ascending=False)
        if not recent.empty:
            latest = recent.iloc[0]
            latest_stats = {
                "ppg": round(latest.get("PTS", 0), 1), "rpg": round(latest.get("REB", 0), 1),
                "apg": round(latest.get("AST", 0), 1), "spg": round(latest.get("STL", 0), 1),
                "bpg": round(latest.get("BLK", 0), 1), "topg": round(latest.get("TOV", 0), 1),
                "fg_pct": round(latest.get("FG_PCT", 0) * 100, 1) if latest.get("FG_PCT") else 0,
                "three_pct": round(latest.get("FG3_PCT", 0) * 100, 1) if latest.get("FG3_PCT") else 0,
                "ft_pct": round(latest.get("FT_PCT", 0) * 100, 1) if latest.get("FT_PCT") else 0,
                "three_pa": round(latest.get("FG3A", 0), 1), "fta": round(latest.get("FTA", 0), 1),
                "mpg": round(latest.get("MIN", 0), 1), "gp": int(latest.get("GP", 0)),
                "age": None,
            }
        else:
            latest_stats = {}
        return seasons, latest_stats
    except Exception as e:
        print(f"(stats error: {e})", end=" ")
        return [], {}


def fetch_player_awards_data(player_id: int) -> list[str]:
    try:
        awards = playerawards.PlayerAwards(player_id=player_id)
        df = awards.get_data_frames()[0]
        if df.empty:
            return []
        return parse_awards(df.to_dict("records"))
    except Exception:
        return []


def fetch_player_info(player_id: int) -> dict:
    try:
        info = commonplayerinfo.CommonPlayerInfo(player_id=player_id)
        df = info.get_data_frames()[0]
        if df.empty:
            return {}
        row = df.iloc[0]
        return {
            "height": row.get("HEIGHT", ""), "weight": row.get("WEIGHT", ""),
            "country": row.get("COUNTRY", "USA"), "college": row.get("SCHOOL", None),
            "draft_year": row.get("DRAFT_YEAR", None), "draft_round": row.get("DRAFT_ROUND", None),
            "draft_pick": row.get("DRAFT_NUMBER", None), "jersey": row.get("JERSEY", "0"),
            "position": row.get("POSITION", ""), "team_id": row.get("TEAM_ID", 0),
            "birthdate": row.get("BIRTHDATE", ""),
        }
    except Exception as e:
        print(f"(info error: {e})", end=" ")
        return {}


# ── Build player JSON ─────────────────────────────────────────────────

def build_player(nba_id, first_name, last_name, player_info, career_seasons,
                 latest_stats, awards_list, all_latest_stats, team_ids) -> dict | None:
    height = parse_height(player_info.get("height", "78"))

    pos_raw = player_info.get("position", "SF")
    position = resolve_position(pos_raw, height)
    secondary = SECONDARY_POS.get(position, None)
    try:
        weight = int(player_info.get("weight", 200))
    except (ValueError, TypeError):
        weight = 200

    birth = player_info.get("birthdate", "")
    if birth and len(str(birth)) >= 4:
        try:
            age = 2027 - int(str(birth)[:4])
        except ValueError:
            age = 25
    else:
        age = 25

    draft_year = player_info.get("draft_year")
    try:
        draft_year_int = int(draft_year) if draft_year and str(draft_year) != "Undrafted" else 2022
    except (ValueError, TypeError):
        draft_year_int = 2022
    years_in_league = max(1, 2027 - draft_year_int)

    try:
        draft_round = int(player_info.get("draft_round", 0)) if str(player_info.get("draft_round", "")) != "Undrafted" else 0
        draft_pick = int(player_info.get("draft_pick", 0)) if str(player_info.get("draft_pick", "")) != "Undrafted" else 0
    except (ValueError, TypeError):
        draft_round = 0
        draft_pick = 0

    try:
        jersey = int(player_info.get("jersey", 0))
    except (ValueError, TypeError):
        jersey = 0

    nba_team_id = player_info.get("team_id", 0)
    our_abbr = NBA_TEAM_ID_TO_ABBR.get(nba_team_id)
    if not our_abbr:
        return None
    our_team_id = team_ids.get(our_abbr)
    if not our_team_id:
        return None

    if latest_stats:
        latest_stats["age"] = age

    ratings = stats_to_ratings(latest_stats, all_latest_stats, position)
    full_name = f"{first_name} {last_name}"
    ratings = apply_overrides(full_name, ratings)

    college = player_info.get("college")
    if college in (None, "", "None", "null"):
        college = None
    country = player_info.get("country", "USA") or "USA"

    import random
    random.seed(nba_id)

    return {
        "id": str(uuid.uuid5(uuid.NAMESPACE_DNS, f"nba-{nba_id}")),
        "nba_id": nba_id,
        "headshot_url": headshot_url(nba_id),
        "team_id": our_team_id,
        "bio": {
            "first_name": first_name, "last_name": last_name,
            "position": position, "secondary_position": secondary,
            "height": height, "weight": weight, "age": age,
            "years_in_league": years_in_league, "college": college, "country": country,
            "draft_year": draft_year_int, "draft_round": draft_round,
            "draft_pick": draft_pick, "jersey_number": jersey, "hand": "right",
        },
        "ratings": ratings,
        "shot_chart": generate_shot_chart(latest_stats or {}, position),
        "tendencies": generate_tendencies(latest_stats or {}, position),
        "character": generate_character(latest_stats or {}, years_in_league),
        "durability": generate_durability(age, latest_stats.get("gp", 50) if latest_stats else 50),
        "contract": generate_contract(ratings["overall"], age, years_in_league),
        "status": {
            "health": "healthy", "current_injury": None, "fatigue": 0.0,
            "morale": 75, "is_rookie": years_in_league <= 1,
            "is_free_agent": False, "is_restricted_fa": False, "team_id": our_team_id,
        },
        "career_stats": career_seasons,
        "awards": awards_list,
    }


# ── Main ──────────────────────────────────────────────────────────────

def main():
    import random
    random.seed(42)

    team_ids = load_team_ids()
    print(f"Loaded {len(team_ids)} fictional teams\n")

    active = fetch_active_players()
    time.sleep(1)

    players_data = []
    all_latest_stats = []
    total = len(active)

    for i, p in enumerate(active):
        nba_id = p["PERSON_ID"]
        display = p.get("DISPLAY_FIRST_LAST", "Unknown")
        parts = display.split(" ", 1)
        first = parts[0]
        last = parts[1] if len(parts) > 1 else ""
        listing_team_id = p.get("TEAM_ID", 0)

        if listing_team_id not in NBA_TEAM_ID_TO_ABBR:
            continue

        print(f"[{i+1}/{total}] {display}...", end=" ", flush=True)

        info = fetch_player_info(nba_id)
        if not info.get("team_id"):
            info["team_id"] = listing_team_id
        time.sleep(0.5)

        seasons, latest = fetch_player_stats(nba_id)
        time.sleep(0.5)

        awards = fetch_player_awards_data(nba_id)
        time.sleep(0.3)

        if latest:
            all_latest_stats.append(latest)

        players_data.append({
            "nba_id": nba_id, "first_name": first, "last_name": last,
            "info": info, "seasons": seasons, "latest": latest, "awards": awards,
        })
        print(f"OK ({len(seasons)}s, {len(awards)}a)")

    print(f"\nFetched data for {len(players_data)} players")

    print("\nGenerating ratings...")
    results = []
    for pd_entry in players_data:
        player = build_player(
            pd_entry["nba_id"], pd_entry["first_name"], pd_entry["last_name"],
            pd_entry["info"], pd_entry["seasons"], pd_entry["latest"],
            pd_entry["awards"], all_latest_stats, team_ids,
        )
        if player:
            results.append(player)

    teams_count: dict[str, int] = {}
    for p in results:
        for a, tid in team_ids.items():
            if tid == p["team_id"]:
                teams_count[a] = teams_count.get(a, 0) + 1
                break

    print(f"\n{'='*50}")
    print(f"Total players: {len(results)}")
    print(f"Teams: {len(teams_count)}")
    if teams_count:
        print(f"Per team: {min(teams_count.values())}-{max(teams_count.values())}")
        for abbr in sorted(teams_count):
            print(f"  {abbr}: {teams_count[abbr]}")

    top = sorted(results, key=lambda p: p["ratings"]["overall"], reverse=True)[:25]
    print(f"\nTop 25:")
    for p in top:
        print(f"  {p['ratings']['overall']} — {p['bio']['first_name']} {p['bio']['last_name']} ({p['bio']['position']})")

    print(f"\nElite (90+): {sum(1 for p in results if p['ratings']['overall'] >= 90)}")
    print(f"All-Star (85+): {sum(1 for p in results if p['ratings']['overall'] >= 85)}")
    print(f"With career stats: {sum(1 for p in results if p['career_stats'])}")
    print(f"With awards: {sum(1 for p in results if p['awards'])}")
    print(f"With headshots: {sum(1 for p in results if p['headshot_url'])}")

    print(f"\nWriting to {OUTPUT_JSON}...")
    with open(OUTPUT_JSON, "w") as f:
        json.dump(results, f, indent=2)
    size_mb = os.path.getsize(OUTPUT_JSON) / 1_000_000
    print(f"Done! {size_mb:.1f} MB")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        traceback.print_exc()
        sys.exit(1)
