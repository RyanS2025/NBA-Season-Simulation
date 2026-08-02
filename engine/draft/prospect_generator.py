from __future__ import annotations

import random
import uuid
from typing import Any

# ---------------------------------------------------------------------------
# Name pools (~50 each)
# ---------------------------------------------------------------------------
FIRST_NAMES: list[str] = [
    "James", "Marcus", "DeAndre", "Jaylen", "Tyrese", "Cam", "Jalen",
    "Malik", "Tre", "Isaiah", "Zion", "Keegan", "Brandon", "Davion",
    "Corey", "Terrence", "Ayo", "Jamal", "Scottie", "Cade", "Josh",
    "Desmond", "RJ", "Anfernee", "Darius", "Jabari", "Keldon", "Trey",
    "Immanuel", "Miles", "Devin", "Monte", "Onyeka", "Saddiq", "Ziaire",
    "Keon", "Alperen", "Dyson", "Collin", "Aaron", "Chris", "Andre",
    "Wendell", "Derrick", "Xavier", "Caleb", "Jordan", "Tyrell",
    "Damian", "Jett",
]

LAST_NAMES: list[str] = [
    "Williams", "Johnson", "Davis", "Thompson", "Harris", "Jackson",
    "Robinson", "Mitchell", "Anderson", "Brown", "Jones", "Martin",
    "Walker", "Moore", "Taylor", "White", "Lewis", "Clark", "Allen",
    "Young", "Hill", "Scott", "Adams", "Green", "Baker", "Nelson",
    "Carter", "Turner", "Wright", "King", "Parker", "Campbell",
    "Edwards", "Collins", "Stewart", "Washington", "Morris", "Reed",
    "Barnes", "Ross", "Henderson", "Price", "Powell", "Brooks",
    "Russell", "Howard", "Butler", "Cooper", "Ward", "Gray",
]

COLLEGES: list[str] = [
    "Duke", "Kentucky", "North Carolina", "Kansas", "Gonzaga", "UCLA",
    "Michigan", "Villanova", "Baylor", "Auburn", "Tennessee", "Arkansas",
    "Arizona", "Purdue", "UConn", "Alabama", "Texas", "Houston",
    "Indiana", "Michigan State", "Oregon", "Florida", "Memphis",
    "Virginia", "LSU", "Iowa State", "Creighton", "Stanford",
    "Georgetown", "Syracuse",
]

INTERNATIONAL_ORIGINS: list[dict[str, str]] = [
    {"country": "France", "college": None},
    {"country": "Australia", "college": None},
    {"country": "Canada", "college": None},
    {"country": "Spain", "college": None},
    {"country": "Serbia", "college": None},
    {"country": "Greece", "college": None},
    {"country": "Nigeria", "college": None},
    {"country": "Germany", "college": None},
    {"country": "Turkey", "college": None},
    {"country": "Croatia", "college": None},
    {"country": "Brazil", "college": None},
    {"country": "Japan", "college": None},
    {"country": "Cameroon", "college": None},
    {"country": "Israel", "college": None},
    {"country": "Slovenia", "college": None},
]

POSITIONS: list[str] = ["PG", "SG", "SF", "PF", "C"]

# Secondary position mapping
SECONDARY_POSITIONS: dict[str, list[str | None]] = {
    "PG": ["SG", None],
    "SG": ["PG", "SF", None],
    "SF": ["SG", "PF", None],
    "PF": ["SF", "C", None],
    "C": ["PF", None],
}

# Height ranges by position (inches)
HEIGHT_RANGES: dict[str, tuple[int, int]] = {
    "PG": (72, 77),
    "SG": (75, 79),
    "SF": (77, 82),
    "PF": (79, 83),
    "C": (82, 87),
}

# Weight ranges by position (lbs)
WEIGHT_RANGES: dict[str, tuple[int, int]] = {
    "PG": (175, 205),
    "SG": (190, 220),
    "SF": (210, 240),
    "PF": (225, 255),
    "C": (240, 275),
}

# Position-based rating biases: keys are rating fields, values are bonuses
# for that position (applied on top of the base generated around overall)
POSITION_BIASES: dict[str, dict[str, int]] = {
    "PG": {
        "ball_handling": 10, "passing_vision": 8, "passing_accuracy": 6,
        "speed": 6, "acceleration": 5, "lateral_quickness": 4,
        "three_point": 3, "perimeter_defense": 2,
        "interior_defense": -8, "shot_blocking": -10, "rebounding": -6,
        "offensive_rebounding": -8, "strength": -6, "post_game": -8,
    },
    "SG": {
        "three_point": 6, "mid_range": 5, "catch_and_shoot_frequency": 5,
        "finishing": 4, "ball_handling": 3, "speed": 4,
        "perimeter_defense": 3, "off_ball_movement": 4,
        "interior_defense": -6, "shot_blocking": -8, "rebounding": -4,
        "offensive_rebounding": -5, "post_game": -6, "strength": -3,
    },
    "SF": {
        "finishing": 3, "mid_range": 2, "perimeter_defense": 2,
        "rebounding": 2, "hustle": 2, "versatility": 0,
        "shot_blocking": -3, "post_game": -2,
    },
    "PF": {
        "rebounding": 6, "offensive_rebounding": 4, "interior_defense": 4,
        "strength": 5, "finishing": 3, "post_game": 4, "close_range": 3,
        "shot_blocking": 2, "vertical": 2,
        "ball_handling": -6, "passing_vision": -4, "three_point": -3,
        "speed": -3, "lateral_quickness": -2,
    },
    "C": {
        "rebounding": 10, "offensive_rebounding": 8, "interior_defense": 8,
        "shot_blocking": 8, "strength": 8, "post_game": 6,
        "close_range": 4, "finishing": 3, "vertical": 2,
        "ball_handling": -10, "passing_vision": -5, "three_point": -6,
        "speed": -5, "acceleration": -4, "lateral_quickness": -4,
        "perimeter_defense": -4,
    },
}

# Storyline seeds
STORYLINE_TYPES: list[dict[str, str]] = [
    {"type": "hometown_hero", "description": "Local kid returning to play near where they grew up"},
    {"type": "legacy_pick", "description": "Son of a former NBA player, carrying the family name"},
    {"type": "late_bloomer", "description": "Barely recruited out of high school, emerged as a college star"},
    {"type": "one_and_done", "description": "Dominant freshman who declared after one electric season"},
    {"type": "international_mystery", "description": "Highly touted international prospect with limited film"},
    {"type": "comeback_kid", "description": "Overcame a major injury in college to return stronger"},
    {"type": "polarizing_talent", "description": "Elite tools but questions about motor and effort"},
    {"type": "undersized_dynamo", "description": "Smaller than ideal but plays much bigger than listed size"},
]

# All rating fields on PlayerRatings (excluding overall, potential, peak_age)
RATING_FIELDS: list[str] = [
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

# Offensive / defensive / athletic groupings for scouting reports
OFFENSIVE_RATINGS: list[str] = [
    "finishing", "close_range", "mid_range", "three_point", "free_throw",
    "post_game", "draw_foul", "off_ball_movement", "ball_handling",
    "passing_vision", "passing_accuracy",
]

DEFENSIVE_RATINGS: list[str] = [
    "perimeter_defense", "interior_defense", "shot_blocking", "stealing",
    "defensive_iq", "defensive_consistency",
]

ATHLETIC_RATINGS: list[str] = [
    "speed", "acceleration", "lateral_quickness", "vertical", "strength",
    "stamina",
]


def _clamp(value: int, lo: int = 30, hi: int = 99) -> int:
    return max(lo, min(hi, value))


def _new_id() -> str:
    return str(uuid.uuid4())[:12]


class ProspectGenerator:
    """Generates a realistic NBA draft class of prospects."""

    def generate_draft_class(
        self,
        year: int,
        num_prospects: int = 60,
    ) -> list[dict]:
        """Generate a full draft class of *num_prospects* prospects.

        Prospects are returned sorted by ``true_overall`` descending (i.e.
        the best prospect is first).  Each prospect dict mirrors the
        ``Player`` model structure.
        """
        prospects: list[dict] = []
        used_names: set[str] = set()

        for rank in range(1, num_prospects + 1):
            overall = self._overall_for_rank(rank)
            prospect = self._generate_prospect(
                year=year,
                overall=overall,
                rank=rank,
                used_names=used_names,
            )
            prospects.append(prospect)

        # Sort by true_overall descending
        prospects.sort(key=lambda p: p["true_overall"], reverse=True)
        return prospects

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _overall_for_rank(self, rank: int) -> int:
        """Determine true overall based on projected draft slot tier."""
        if rank <= 3:
            return random.randint(78, 88)
        if rank <= 14:
            return random.randint(72, 82)
        if rank <= 30:
            return random.randint(68, 76)
        # Second round
        return random.randint(62, 72)

    def _generate_prospect(
        self,
        year: int,
        overall: int,
        rank: int,
        used_names: set[str],
    ) -> dict:
        # Name (avoid duplicates)
        first = random.choice(FIRST_NAMES)
        last = random.choice(LAST_NAMES)
        while f"{first} {last}" in used_names:
            first = random.choice(FIRST_NAMES)
            last = random.choice(LAST_NAMES)
        used_names.add(f"{first} {last}")

        # Position
        position = random.choice(POSITIONS)
        sec_pos = random.choice(SECONDARY_POSITIONS[position])

        # Age (weighted 19-21)
        age = random.choices(
            population=[19, 20, 21, 22, 23],
            weights=[30, 30, 20, 12, 8],
            k=1,
        )[0]

        # Origin
        is_international = random.random() < 0.20
        if is_international:
            origin = random.choice(INTERNATIONAL_ORIGINS)
            college = origin["college"]
            country = origin["country"]
        else:
            college = random.choice(COLLEGES)
            country = "USA"

        # Physical attributes
        h_lo, h_hi = HEIGHT_RANGES[position]
        height = random.randint(h_lo, h_hi)
        w_lo, w_hi = WEIGHT_RANGES[position]
        weight = random.randint(w_lo, w_hi)

        hand = random.choices(["right", "left"], weights=[85, 15], k=1)[0]
        jersey_number = random.randint(0, 55)

        # Ratings
        ratings = self._generate_ratings(overall, position)

        # Potential & peak age
        potential = min(99, overall + random.randint(5, 20))
        peak_age = random.randint(25, 30)

        # Tendencies
        tendencies = self._generate_tendencies(ratings, position)

        # Character traits
        character = self._generate_character()

        # Durability profile
        durability = self._generate_durability()

        # Shot chart placeholder
        shot_chart = self._generate_shot_chart(ratings, position)

        # Storyline seed (5-10% chance)
        storyline = None
        if random.random() < 0.075:
            storyline = random.choice(STORYLINE_TYPES).copy()

        prospect_id = _new_id()

        return {
            "id": prospect_id,
            "name": f"{first} {last}",
            "true_overall": overall,
            "bio": {
                "first_name": first,
                "last_name": last,
                "position": position,
                "secondary_position": sec_pos,
                "height": height,
                "weight": weight,
                "age": age,
                "years_in_league": 0,
                "college": college,
                "country": country,
                "draft_year": year,
                "draft_round": 0,
                "draft_pick": 0,
                "jersey_number": jersey_number,
                "hand": hand,
            },
            "ratings": {
                **ratings,
                "overall": overall,
                "potential": potential,
                "peak_age": peak_age,
            },
            "tendencies": tendencies,
            "character": character,
            "durability": durability,
            "shot_chart": shot_chart,
            "position": position,
            "potential": potential,
            "peak_age": peak_age,
            "college": college,
            "country": country,
            "age": age,
            "storyline": storyline,
        }

    def _generate_ratings(
        self,
        overall: int,
        position: str,
    ) -> dict[str, int]:
        """Generate individual ratings centered around *overall* with
        position-appropriate biases."""
        biases = POSITION_BIASES.get(position, {})
        ratings: dict[str, int] = {}

        for field in RATING_FIELDS:
            base = overall + random.randint(-8, 8)
            bias = biases.get(field, 0)
            ratings[field] = _clamp(base + bias)

        return ratings

    def _generate_tendencies(
        self,
        ratings: dict[str, int],
        position: str,
    ) -> dict[str, int]:
        """Derive tendencies from ratings and position."""
        three = ratings.get("three_point", 50)
        mid = ratings.get("mid_range", 50)
        finishing = ratings.get("finishing", 50)
        ball_handling = ratings.get("ball_handling", 50)
        post = ratings.get("post_game", 50)
        passing = ratings.get("passing_vision", 50)
        speed = ratings.get("speed", 50)
        steal = ratings.get("stealing", 50)
        def_iq = ratings.get("defensive_iq", 50)
        reb = ratings.get("rebounding", 50)
        hustle_r = ratings.get("hustle", 50)
        off_ball = ratings.get("off_ball_movement", 50)

        def _tend(base: int, noise: int = 10) -> int:
            return _clamp(base + random.randint(-noise, noise), 20, 99)

        return {
            "pull_up_frequency": _tend(mid),
            "catch_and_shoot_frequency": _tend(three),
            "drive_frequency": _tend(finishing),
            "post_up_frequency": _tend(post),
            "iso_frequency": _tend(ball_handling),
            "pick_and_roll_ball_handler": _tend(
                (ball_handling + passing) // 2
            ),
            "pick_and_roll_screener": _tend(
                (reb + post) // 2
            ),
            "spot_up_frequency": _tend(three),
            "transition_frequency": _tend(speed),
            "cut_frequency": _tend(off_ball),
            "pass_out_of_drive_rate": _tend(passing),
            "skip_pass_rate": _tend(passing - 5),
            "alley_oop_pass_rate": _tend(passing - 10),
            "gamble_for_steals": _tend(steal),
            "help_defense_rate": _tend(def_iq),
            "closeout_aggression": _tend(
                (speed + def_iq) // 2
            ),
            "box_out_rate": _tend(reb),
            "usage_desire": _tend(
                (ball_handling + finishing) // 2
            ),
            "pace_preference": _tend(speed),
            "foul_proneness": _tend(50),
            "shot_clock_tendency": _tend(50),
            "contested_shot_willingness": _tend(
                (mid + three) // 2 - 5
            ),
        }

    def _generate_character(self) -> dict[str, int]:
        """Randomise character traits (25-95 range)."""
        return {
            "leadership": random.randint(25, 95),
            "work_ethic": random.randint(35, 99),
            "clutch": random.randint(25, 95),
            "ego": random.randint(20, 90),
            "coachability": random.randint(30, 95),
            "temperament": random.randint(30, 95),
            "fan_favorite": random.randint(20, 90),
            "media_personality": random.randint(20, 90),
            "loyalty": random.randint(25, 95),
            "competitiveness": random.randint(35, 99),
        }

    def _generate_durability(self) -> dict[str, Any]:
        """Generate a durability profile."""
        base = random.randint(55, 95)
        return {
            "overall_durability": base,
            "ankle_health": _clamp(base + random.randint(-10, 10), 40, 99),
            "knee_health": _clamp(base + random.randint(-10, 10), 40, 99),
            "shoulder_health": _clamp(base + random.randint(-10, 10), 40, 99),
            "back_health": _clamp(base + random.randint(-10, 10), 40, 99),
            "wrist_hand_health": _clamp(base + random.randint(-10, 10), 40, 99),
            "foot_health": _clamp(base + random.randint(-10, 10), 40, 99),
            "concussion_risk": _clamp(100 - base + random.randint(-5, 5), 5, 60),
            "soft_tissue_risk": _clamp(100 - base + random.randint(-5, 5), 5, 60),
            "injury_history": [],
        }

    def _generate_shot_chart(
        self,
        ratings: dict[str, int],
        position: str,
    ) -> dict[str, Any]:
        """Generate a simplified shot-chart profile from ratings."""
        three = ratings.get("three_point", 50)
        mid = ratings.get("mid_range", 50)
        close = ratings.get("close_range", 50)
        finishing = ratings.get("finishing", 50)
        post = ratings.get("post_game", 50)

        zones = [
            {
                "zone_id": "restricted_area",
                "tendency": round(finishing / 100 * 0.35 + 0.10, 3),
                "make_rate": round(finishing / 100 * 0.30 + 0.45, 3),
            },
            {
                "zone_id": "paint_non_ra",
                "tendency": round(close / 100 * 0.15 + 0.05, 3),
                "make_rate": round(close / 100 * 0.20 + 0.30, 3),
            },
            {
                "zone_id": "mid_range",
                "tendency": round(mid / 100 * 0.20 + 0.05, 3),
                "make_rate": round(mid / 100 * 0.15 + 0.30, 3),
            },
            {
                "zone_id": "corner_three",
                "tendency": round(three / 100 * 0.10 + 0.03, 3),
                "make_rate": round(three / 100 * 0.12 + 0.28, 3),
            },
            {
                "zone_id": "above_break_three",
                "tendency": round(three / 100 * 0.18 + 0.05, 3),
                "make_rate": round(three / 100 * 0.12 + 0.25, 3),
            },
            {
                "zone_id": "post",
                "tendency": round(post / 100 * 0.12 + 0.02, 3),
                "make_rate": round(post / 100 * 0.18 + 0.32, 3),
            },
        ]

        return {"zones": zones}
