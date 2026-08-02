"""Generate player ratings from NBA stats and produce a sample 50-player dataset.

This script contains two pieces:
  1. stats_to_ratings() / calculate_overall() -- the PIPELINE that converts real
     NBA stats (from nba_api) into our 1-99 rating system.
  2. A sample-data generator that creates 50 fictional players with realistic
     rating distributions and assigns them across the 30 teams.

Run:  python scrapers/generate_player_ratings.py
Output: frontend/public/data/players_2026_27.json
"""

from __future__ import annotations

import json
import math
import os
import random
import sys
import uuid

# Allow importing from project root for team IDs
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

# ---------------------------------------------------------------------------
# 1. PIPELINE: Real stats -> ratings  (used when nba_api data is available)
# ---------------------------------------------------------------------------


def _clamp(value: int | float, lo: int = 30, hi: int = 99) -> int:
    return max(lo, min(hi, int(round(value))))


def _scale(value: float, in_min: float, in_max: float, out_min: int = 40, out_max: int = 99) -> int:
    """Linearly scale *value* from [in_min, in_max] to [out_min, out_max]."""
    if in_max == in_min:
        return (out_min + out_max) // 2
    ratio = (value - in_min) / (in_max - in_min)
    return _clamp(out_min + ratio * (out_max - out_min), out_min, out_max)


def stats_to_ratings(stats: dict) -> dict:
    """Convert a dictionary of real NBA per-game / advanced stats into
    our 1-99 rating fields.

    Expected keys in *stats*:
        ppg, apg, rpg, spg, bpg, mpg,
        fg_pct, fg3_pct, ft_pct,
        fg3a_per_game, fta_per_game,
        ts_pct (true-shooting %),
        usg_pct (usage rate),
        paint_touches (optional),
        post_touches (optional),
    """
    ppg = stats.get("ppg", 0.0)
    apg = stats.get("apg", 0.0)
    rpg = stats.get("rpg", 0.0)
    spg = stats.get("spg", 0.0)
    bpg = stats.get("bpg", 0.0)
    mpg = stats.get("mpg", 0.0)
    fg_pct = stats.get("fg_pct", 0.0)
    fg3_pct = stats.get("fg3_pct", 0.0)
    ft_pct = stats.get("ft_pct", 0.0)
    fg3a = stats.get("fg3a_per_game", 0.0)
    fta = stats.get("fta_per_game", 0.0)
    ts_pct = stats.get("ts_pct", 0.0)
    usg = stats.get("usg_pct", 0.0)

    # Shooting ratings
    three_point = _scale(fg3_pct, 0.28, 0.43, 45, 99)
    if fg3a < 1.0:
        three_point = _clamp(three_point - 15, 30, 70)

    mid_range = _scale(fg_pct, 0.38, 0.55, 50, 95)
    finishing = _scale(ts_pct, 0.48, 0.66, 50, 97)
    close_range = _scale(fg_pct, 0.40, 0.58, 50, 95)
    free_throw = _scale(ft_pct, 0.60, 0.92, 45, 99)
    post_game = _scale(stats.get("post_touches", 2.0), 0.0, 10.0, 35, 90)
    draw_foul = _scale(fta, 1.0, 10.0, 40, 95)

    # Playmaking
    passing_vision = _scale(apg, 1.0, 10.0, 40, 97)
    passing_accuracy = _scale(apg, 1.5, 9.0, 45, 95)

    # Rebounding
    rebounding = _scale(rpg, 2.0, 12.0, 40, 97)
    offensive_rebounding = _scale(rpg * 0.25, 0.3, 3.5, 35, 92)

    # Defense
    stealing = _scale(spg, 0.3, 2.2, 40, 97)
    shot_blocking = _scale(bpg, 0.1, 2.5, 35, 97)
    perimeter_defense = _scale(spg, 0.3, 2.0, 45, 92)
    interior_defense = _scale(bpg, 0.2, 2.5, 40, 95)
    defensive_iq = _clamp((perimeter_defense + interior_defense) // 2 + random.randint(-3, 3))
    defensive_consistency = _clamp(defensive_iq + random.randint(-5, 5))

    # Physical (estimated from minutes + scoring volume)
    speed = _scale(ppg * 0.3 + apg * 0.5, 2.0, 12.0, 50, 95)
    acceleration = _clamp(speed + random.randint(-4, 4))
    lateral_quickness = _clamp(speed + random.randint(-5, 3))
    vertical = _scale(ppg * 0.2 + bpg * 3.0, 1.0, 10.0, 45, 95)
    strength = _scale(rpg * 0.5 + bpg * 2.0, 1.0, 8.0, 45, 92)
    stamina = _scale(mpg, 15.0, 38.0, 50, 97)

    # IQ / intangibles
    basketball_iq = _scale(apg + spg * 2, 2.0, 14.0, 45, 97)
    offensive_iq = _scale(apg + ppg * 0.3, 3.0, 14.0, 45, 96)
    off_ball_movement = _scale(ppg - usg * 0.15, 2.0, 12.0, 45, 92)
    ball_handling = _scale(apg * 0.6 + ppg * 0.2, 2.0, 10.0, 40, 97)
    hustle = _clamp(random.randint(55, 90))

    return {
        "finishing": finishing,
        "close_range": close_range,
        "mid_range": mid_range,
        "three_point": three_point,
        "free_throw": free_throw,
        "post_game": post_game,
        "draw_foul": draw_foul,
        "off_ball_movement": off_ball_movement,
        "ball_handling": ball_handling,
        "passing_vision": passing_vision,
        "passing_accuracy": passing_accuracy,
        "perimeter_defense": perimeter_defense,
        "interior_defense": interior_defense,
        "shot_blocking": shot_blocking,
        "stealing": stealing,
        "defensive_iq": defensive_iq,
        "defensive_consistency": defensive_consistency,
        "speed": speed,
        "acceleration": acceleration,
        "lateral_quickness": lateral_quickness,
        "vertical": vertical,
        "strength": strength,
        "stamina": stamina,
        "basketball_iq": basketball_iq,
        "offensive_iq": offensive_iq,
        "rebounding": rebounding,
        "offensive_rebounding": offensive_rebounding,
        "hustle": hustle,
    }


# ---------------------------------------------------------------------------
# Position-weighted overall calculation
# ---------------------------------------------------------------------------

POSITION_WEIGHTS: dict[str, dict[str, float]] = {
    "PG": {
        "ball_handling": 0.20, "passing_vision": 0.14, "passing_accuracy": 0.04,
        "speed": 0.10, "three_point": 0.12, "perimeter_defense": 0.10,
        "finishing": 0.06, "mid_range": 0.04, "stealing": 0.05,
        "basketball_iq": 0.05, "lateral_quickness": 0.04, "stamina": 0.03,
        "acceleration": 0.03,
    },
    "SG": {
        "three_point": 0.16, "mid_range": 0.10, "finishing": 0.10,
        "perimeter_defense": 0.10, "off_ball_movement": 0.08,
        "ball_handling": 0.08, "speed": 0.08, "stealing": 0.06,
        "lateral_quickness": 0.05, "free_throw": 0.04, "stamina": 0.03,
        "passing_vision": 0.06, "basketball_iq": 0.03, "vertical": 0.03,
    },
    "SF": {
        "finishing": 0.12, "three_point": 0.10, "perimeter_defense": 0.10,
        "mid_range": 0.08, "rebounding": 0.08, "ball_handling": 0.06,
        "passing_vision": 0.06, "speed": 0.06, "strength": 0.06,
        "stealing": 0.05, "vertical": 0.05, "hustle": 0.05,
        "defensive_iq": 0.04, "stamina": 0.04, "basketball_iq": 0.05,
    },
    "PF": {
        "rebounding": 0.16, "interior_defense": 0.12, "finishing": 0.12,
        "strength": 0.10, "shot_blocking": 0.08, "mid_range": 0.06,
        "three_point": 0.06, "offensive_rebounding": 0.06, "hustle": 0.05,
        "post_game": 0.05, "vertical": 0.04, "defensive_iq": 0.04,
        "stamina": 0.03, "basketball_iq": 0.03,
    },
    "C": {
        "interior_defense": 0.18, "rebounding": 0.16, "finishing": 0.12,
        "strength": 0.10, "shot_blocking": 0.10, "offensive_rebounding": 0.06,
        "post_game": 0.06, "defensive_iq": 0.05, "vertical": 0.04,
        "hustle": 0.04, "stamina": 0.03, "close_range": 0.03,
        "basketball_iq": 0.03,
    },
}


def calculate_overall(ratings: dict, position: str) -> int:
    """Calculate position-weighted overall rating (65-99 scale)."""
    weights = POSITION_WEIGHTS.get(position, POSITION_WEIGHTS["SF"])
    total = 0.0
    weight_sum = 0.0
    for attr, w in weights.items():
        if attr in ratings:
            total += ratings[attr] * w
            weight_sum += w
    if weight_sum == 0:
        return 70
    raw = total / weight_sum
    return _clamp(raw, 55, 99)


# ---------------------------------------------------------------------------
# 2. SAMPLE DATA GENERATOR: 50 fictional players with realistic ratings
# ---------------------------------------------------------------------------

FIRST_NAMES = [
    "Jaylen", "Marcus", "Devin", "Tre", "Cam", "Miles", "Zion", "Malik",
    "Isaiah", "Keegan", "Tyrese", "Brandon", "Corey", "Terrence", "Ayo",
    "Jalen", "Cade", "Josh", "Desmond", "Anfernee", "Darius", "Jabari",
    "Keldon", "Trey", "Immanuel", "Monte", "Onyeka", "Saddiq", "Ziaire",
    "Keon", "Alperen", "Dyson", "Collin", "Aaron", "Chris", "Andre",
    "Wendell", "Derrick", "Xavier", "Caleb", "Jordan", "Damian", "Jett",
    "Scottie", "RJ", "Davion", "Jamal", "DeAndre", "James", "Tyrell",
]

LAST_NAMES = [
    "Williams", "Johnson", "Davis", "Thompson", "Harris", "Jackson",
    "Robinson", "Mitchell", "Anderson", "Brown", "Jones", "Martin",
    "Walker", "Moore", "Taylor", "White", "Lewis", "Clark", "Allen",
    "Young", "Hill", "Scott", "Adams", "Green", "Baker", "Nelson",
    "Carter", "Turner", "Wright", "King", "Parker", "Campbell",
    "Edwards", "Collins", "Stewart", "Washington", "Morris", "Reed",
    "Barnes", "Ross", "Henderson", "Price", "Powell", "Brooks",
    "Russell", "Howard", "Butler", "Cooper", "Ward", "Gray",
]

COLLEGES = [
    "Duke", "Kentucky", "North Carolina", "Kansas", "Gonzaga", "UCLA",
    "Michigan", "Villanova", "Baylor", "Auburn", "Tennessee", "Arkansas",
    "Arizona", "Purdue", "UConn", "Alabama", "Texas", "Houston",
    "Indiana", "Michigan State", "Oregon", "Florida", "Memphis",
    "Virginia", "LSU", "Iowa State", "Creighton", "Stanford",
    "Georgetown", "Syracuse",
]

COUNTRIES = [
    "USA", "USA", "USA", "USA", "USA", "USA", "USA",  # weighted toward USA
    "Canada", "France", "Australia", "Serbia", "Greece",
    "Germany", "Spain", "Nigeria", "Cameroon",
]

POSITIONS = ["PG", "SG", "SF", "PF", "C"]
SECONDARY = {
    "PG": ["SG", None],
    "SG": ["PG", "SF", None],
    "SF": ["SG", "PF", None],
    "PF": ["SF", "C", None],
    "C": ["PF", None],
}
HEIGHT_RANGES = {"PG": (73, 77), "SG": (75, 79), "SF": (78, 81), "PF": (80, 83), "C": (82, 87)}
WEIGHT_RANGES = {"PG": (180, 205), "SG": (190, 220), "SF": (215, 240), "PF": (225, 255), "C": (240, 275)}

# Tier definitions: (count, overall_lo, overall_hi, potential_lo, potential_hi, label)
TIERS = [
    (3,  92, 97, 93, 99, "superstar"),
    (7,  85, 91, 87, 95, "all-star"),
    (10, 78, 84, 80, 90, "starter"),
    (15, 72, 77, 75, 85, "rotation"),
    (15, 65, 72, 68, 80, "bench"),
]

# Position-based biases for individual ratings (same concept as ProspectGenerator)
POSITION_BIASES = {
    "PG": {"ball_handling": 10, "passing_vision": 8, "speed": 6, "three_point": 3,
            "interior_defense": -8, "shot_blocking": -10, "rebounding": -6, "post_game": -8, "strength": -6},
    "SG": {"three_point": 6, "mid_range": 5, "finishing": 4, "speed": 4, "off_ball_movement": 4,
            "interior_defense": -6, "shot_blocking": -8, "rebounding": -4, "post_game": -6},
    "SF": {"finishing": 3, "mid_range": 2, "perimeter_defense": 2, "rebounding": 2,
            "shot_blocking": -3, "post_game": -2},
    "PF": {"rebounding": 6, "interior_defense": 4, "strength": 5, "finishing": 3, "post_game": 4, "close_range": 3,
            "ball_handling": -6, "passing_vision": -4, "three_point": -3, "speed": -3},
    "C":  {"rebounding": 10, "interior_defense": 8, "shot_blocking": 8, "strength": 8, "post_game": 6,
            "close_range": 4, "finishing": 3, "ball_handling": -10, "passing_vision": -5,
            "three_point": -6, "speed": -5, "perimeter_defense": -4},
}

RATING_FIELDS = [
    "finishing", "close_range", "mid_range", "three_point", "free_throw",
    "post_game", "draw_foul", "off_ball_movement", "ball_handling",
    "passing_vision", "passing_accuracy",
    "perimeter_defense", "interior_defense", "shot_blocking", "stealing",
    "defensive_iq", "defensive_consistency",
    "speed", "acceleration", "lateral_quickness", "vertical", "strength",
    "stamina",
    "basketball_iq", "offensive_iq", "rebounding", "offensive_rebounding",
    "hustle",
]


def _generate_individual_ratings(overall: int, position: str, rng: random.Random) -> dict:
    """Generate individual ratings centered around *overall* with position bias."""
    biases = POSITION_BIASES.get(position, {})
    ratings = {}
    for fld in RATING_FIELDS:
        base = overall + rng.randint(-8, 8)
        bias = biases.get(fld, 0)
        ratings[fld] = _clamp(base + bias)
    return ratings


def _generate_tendencies(ratings: dict, position: str, rng: random.Random) -> dict:
    three = ratings.get("three_point", 50)
    mid = ratings.get("mid_range", 50)
    fin = ratings.get("finishing", 50)
    bh = ratings.get("ball_handling", 50)
    post = ratings.get("post_game", 50)
    pv = ratings.get("passing_vision", 50)
    spd = ratings.get("speed", 50)
    stl = ratings.get("stealing", 50)
    diq = ratings.get("defensive_iq", 50)
    reb = ratings.get("rebounding", 50)
    ob = ratings.get("off_ball_movement", 50)

    def _t(base: int, noise: int = 10) -> int:
        return _clamp(base + rng.randint(-noise, noise), 20, 99)

    return {
        "pull_up_frequency": _t(mid),
        "catch_and_shoot_frequency": _t(three),
        "drive_frequency": _t(fin),
        "post_up_frequency": _t(post),
        "iso_frequency": _t(bh),
        "pick_and_roll_ball_handler": _t((bh + pv) // 2),
        "pick_and_roll_screener": _t((reb + post) // 2),
        "spot_up_frequency": _t(three),
        "transition_frequency": _t(spd),
        "cut_frequency": _t(ob),
        "pass_out_of_drive_rate": _t(pv),
        "skip_pass_rate": _t(pv - 5),
        "alley_oop_pass_rate": _t(pv - 10),
        "gamble_for_steals": _t(stl),
        "help_defense_rate": _t(diq),
        "closeout_aggression": _t((spd + diq) // 2),
        "box_out_rate": _t(reb),
        "usage_desire": _t((bh + fin) // 2),
        "pace_preference": _t(spd),
        "foul_proneness": _t(50),
        "shot_clock_tendency": _t(50),
        "contested_shot_willingness": _t((mid + three) // 2 - 5),
    }


def _generate_character(rng: random.Random) -> dict:
    return {
        "leadership": rng.randint(25, 95),
        "work_ethic": rng.randint(35, 99),
        "clutch": rng.randint(25, 95),
        "ego": rng.randint(20, 90),
        "coachability": rng.randint(30, 95),
        "temperament": rng.randint(30, 95),
        "fan_favorite": rng.randint(20, 90),
        "media_personality": rng.randint(20, 90),
        "loyalty": rng.randint(25, 95),
        "competitiveness": rng.randint(35, 99),
    }


def _generate_durability(rng: random.Random) -> dict:
    base = rng.randint(55, 95)
    return {
        "overall_durability": base,
        "ankle_health": _clamp(base + rng.randint(-10, 10), 40, 99),
        "knee_health": _clamp(base + rng.randint(-10, 10), 40, 99),
        "shoulder_health": _clamp(base + rng.randint(-10, 10), 40, 99),
        "back_health": _clamp(base + rng.randint(-10, 10), 40, 99),
        "wrist_hand_health": _clamp(base + rng.randint(-10, 10), 40, 99),
        "foot_health": _clamp(base + rng.randint(-10, 10), 40, 99),
        "concussion_risk": _clamp(100 - base + rng.randint(-5, 5), 5, 60),
        "soft_tissue_risk": _clamp(100 - base + rng.randint(-5, 5), 5, 60),
        "injury_history": [],
    }


def _generate_shot_chart(ratings: dict, rng: random.Random) -> dict:
    three = ratings.get("three_point", 50)
    mid = ratings.get("mid_range", 50)
    close = ratings.get("close_range", 50)
    fin = ratings.get("finishing", 50)
    post = ratings.get("post_game", 50)

    zones = [
        {"zone_id": "restricted_area",
         "tendency": round(fin / 100 * 0.35 + 0.10, 3),
         "make_rate": round(fin / 100 * 0.30 + 0.45, 3)},
        {"zone_id": "paint_non_ra",
         "tendency": round(close / 100 * 0.15 + 0.05, 3),
         "make_rate": round(close / 100 * 0.20 + 0.30, 3)},
        {"zone_id": "mid_range",
         "tendency": round(mid / 100 * 0.20 + 0.05, 3),
         "make_rate": round(mid / 100 * 0.15 + 0.30, 3)},
        {"zone_id": "corner_three",
         "tendency": round(three / 100 * 0.10 + 0.03, 3),
         "make_rate": round(three / 100 * 0.12 + 0.28, 3)},
        {"zone_id": "above_break_three",
         "tendency": round(three / 100 * 0.18 + 0.05, 3),
         "make_rate": round(three / 100 * 0.12 + 0.25, 3)},
        {"zone_id": "post",
         "tendency": round(post / 100 * 0.12 + 0.02, 3),
         "make_rate": round(post / 100 * 0.18 + 0.32, 3)},
    ]
    return {"zones": zones}


def _load_team_ids() -> list[str]:
    """Load team IDs from teams.json (must be generated first)."""
    teams_path = os.path.join(
        os.path.dirname(__file__), "..", "frontend", "public", "data", "teams.json"
    )
    if os.path.exists(teams_path):
        with open(teams_path) as f:
            teams = json.load(f)
        return [t["id"] for t in teams]
    # Fallback: generate deterministic IDs matching generate_teams.py
    abbrs = [
        "BOS", "NYT", "PHI", "TOR", "BKN",
        "CHI", "CLE", "MIL", "IND", "DET",
        "MIA", "ATL", "CHA", "WAS", "ORL",
        "DEN", "POR", "MIN", "OKC", "UTA",
        "LAV", "GSS", "SAC", "PHX", "LAW",
        "DAL", "HOU", "SAS", "MEM", "NOP",
    ]
    return [str(uuid.uuid5(uuid.NAMESPACE_DNS, a)) for a in abbrs]


def generate_sample_players() -> list[dict]:
    """Generate 50 fictional players distributed across tiers and teams."""
    rng = random.Random(2026)
    team_ids = _load_team_ids()
    players: list[dict] = []
    used_names: set[str] = set()

    for count, ovr_lo, ovr_hi, pot_lo, pot_hi, tier_label in TIERS:
        for _ in range(count):
            # Unique name
            while True:
                first = rng.choice(FIRST_NAMES)
                last = rng.choice(LAST_NAMES)
                full = f"{first} {last}"
                if full not in used_names:
                    used_names.add(full)
                    break

            position = rng.choice(POSITIONS)
            sec_pos = rng.choice(SECONDARY[position])
            country = rng.choice(COUNTRIES)
            college = rng.choice(COLLEGES) if country == "USA" else None
            h_lo, h_hi = HEIGHT_RANGES[position]
            w_lo, w_hi = WEIGHT_RANGES[position]
            height = rng.randint(h_lo, h_hi)
            weight = rng.randint(w_lo, w_hi)
            age = rng.randint(20, 35)
            years = max(0, age - 19 - rng.randint(0, 2))
            hand = rng.choices(["right", "left"], weights=[85, 15], k=1)[0]
            jersey = rng.randint(0, 55)

            overall_target = rng.randint(ovr_lo, ovr_hi)
            individual = _generate_individual_ratings(overall_target, position, rng)
            overall = calculate_overall(individual, position)
            potential = min(99, rng.randint(pot_lo, pot_hi))
            peak_age = rng.randint(25, 30)

            tendencies = _generate_tendencies(individual, position, rng)
            character = _generate_character(rng)
            durability = _generate_durability(rng)
            shot_chart = _generate_shot_chart(individual, rng)

            # Assign to a team (round-robin with some randomness)
            team_id = team_ids[len(players) % len(team_ids)]

            # Draft history
            draft_year = 2027 - years if years > 0 else 2026
            draft_round = 1 if overall_target >= 78 else 2
            draft_pick = rng.randint(1, 30)

            # Contract (simplified)
            base_salary = int(overall_target ** 2.5 * 15 + rng.randint(-500_000, 500_000))
            contract_years = rng.randint(1, 4)

            player = {
                "id": str(uuid.uuid4())[:12],
                "bio": {
                    "first_name": first,
                    "last_name": last,
                    "position": position,
                    "secondary_position": sec_pos,
                    "height": height,
                    "weight": weight,
                    "age": age,
                    "years_in_league": years,
                    "college": college,
                    "country": country,
                    "draft_year": draft_year,
                    "draft_round": draft_round,
                    "draft_pick": draft_pick,
                    "jersey_number": jersey,
                    "hand": hand,
                },
                "ratings": {
                    **individual,
                    "overall": overall,
                    "potential": potential,
                    "peak_age": peak_age,
                },
                "shot_chart": shot_chart,
                "tendencies": tendencies,
                "character": character,
                "durability": durability,
                "contract": {
                    "salary": base_salary,
                    "years_remaining": contract_years,
                    "year_signed": 2026 - rng.randint(0, contract_years - 1),
                    "is_player_option": rng.random() < 0.15,
                    "is_team_option": rng.random() < 0.10,
                    "no_trade_clause": overall_target >= 90 and rng.random() < 0.3,
                },
                "status": {
                    "health": "healthy",
                    "current_injury": None,
                    "fatigue": 0.0,
                    "morale": 1.0,
                    "is_rookie": years == 0,
                    "is_free_agent": False,
                    "is_restricted_fa": False,
                    "team_id": team_id,
                },
            }
            players.append(player)

    # Sort by overall descending
    players.sort(key=lambda p: p["ratings"]["overall"], reverse=True)
    return players


def main() -> None:
    players = generate_sample_players()

    out_dir = os.path.join(os.path.dirname(__file__), "..", "frontend", "public", "data")
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, "players_2026_27.json")

    with open(out_path, "w") as f:
        json.dump(players, f, indent=2)

    # Summary
    overalls = [p["ratings"]["overall"] for p in players]
    print(f"Wrote {len(players)} players to {os.path.abspath(out_path)}")
    print(f"  Overall range: {min(overalls)}-{max(overalls)}")
    print(f"  Positions: {dict(sorted({pos: sum(1 for p in players if p['bio']['position'] == pos) for pos in POSITIONS}.items()))}")

    tiers = {"superstar (92+)": 0, "all-star (85-91)": 0, "starter (78-84)": 0, "rotation (72-77)": 0, "bench (<72)": 0}
    for ovr in overalls:
        if ovr >= 92:
            tiers["superstar (92+)"] += 1
        elif ovr >= 85:
            tiers["all-star (85-91)"] += 1
        elif ovr >= 78:
            tiers["starter (78-84)"] += 1
        elif ovr >= 72:
            tiers["rotation (72-77)"] += 1
        else:
            tiers["bench (<72)"] += 1
    for label, count in tiers.items():
        print(f"  {label}: {count}")


if __name__ == "__main__":
    main()
