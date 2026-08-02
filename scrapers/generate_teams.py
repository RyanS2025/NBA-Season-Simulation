"""Generate 30 fictional NBA-style teams and write to teams.json."""

from __future__ import annotations

import json
import os
import random
import uuid

# ---------------------------------------------------------------------------
# Team definitions: (city, name, abbreviation, conference, division)
# ---------------------------------------------------------------------------

TEAMS: list[dict] = [
    # Eastern Conference - Atlantic
    {"city": "Boston", "name": "Minutemen", "abbr": "BOS", "conference": "Eastern", "division": "Atlantic"},
    {"city": "New York", "name": "Titans", "abbr": "NYT", "conference": "Eastern", "division": "Atlantic"},
    {"city": "Philadelphia", "name": "Ironworks", "abbr": "PHI", "conference": "Eastern", "division": "Atlantic"},
    {"city": "Toronto", "name": "Raptides", "abbr": "TOR", "conference": "Eastern", "division": "Atlantic"},
    {"city": "Brooklyn", "name": "Specters", "abbr": "BKN", "conference": "Eastern", "division": "Atlantic"},
    # Eastern Conference - Central
    {"city": "Chicago", "name": "Forge", "abbr": "CHI", "conference": "Eastern", "division": "Central"},
    {"city": "Cleveland", "name": "Ironclad", "abbr": "CLE", "conference": "Eastern", "division": "Central"},
    {"city": "Milwaukee", "name": "Stags", "abbr": "MIL", "conference": "Eastern", "division": "Central"},
    {"city": "Indiana", "name": "Diesels", "abbr": "IND", "conference": "Eastern", "division": "Central"},
    {"city": "Detroit", "name": "Gears", "abbr": "DET", "conference": "Eastern", "division": "Central"},
    # Eastern Conference - Southeast
    {"city": "Miami", "name": "Tides", "abbr": "MIA", "conference": "Eastern", "division": "Southeast"},
    {"city": "Atlanta", "name": "Phoenixes", "abbr": "ATL", "conference": "Eastern", "division": "Southeast"},
    {"city": "Charlotte", "name": "Swarm", "abbr": "CHA", "conference": "Eastern", "division": "Southeast"},
    {"city": "Washington", "name": "Monuments", "abbr": "WAS", "conference": "Eastern", "division": "Southeast"},
    {"city": "Orlando", "name": "Spectrums", "abbr": "ORL", "conference": "Eastern", "division": "Southeast"},
    # Western Conference - Northwest
    {"city": "Denver", "name": "Altitude", "abbr": "DEN", "conference": "Western", "division": "Northwest"},
    {"city": "Portland", "name": "Lumberjacks", "abbr": "POR", "conference": "Western", "division": "Northwest"},
    {"city": "Minnesota", "name": "Blizzard", "abbr": "MIN", "conference": "Western", "division": "Northwest"},
    {"city": "Oklahoma City", "name": "Cyclones", "abbr": "OKC", "conference": "Western", "division": "Northwest"},
    {"city": "Utah", "name": "Prospectors", "abbr": "UTA", "conference": "Western", "division": "Northwest"},
    # Western Conference - Pacific
    {"city": "Los Angeles", "name": "Vipers", "abbr": "LAV", "conference": "Western", "division": "Pacific"},
    {"city": "Golden State", "name": "Samurai", "abbr": "GSS", "conference": "Western", "division": "Pacific"},
    {"city": "Sacramento", "name": "Empire", "abbr": "SAC", "conference": "Western", "division": "Pacific"},
    {"city": "Phoenix", "name": "Scorchers", "abbr": "PHX", "conference": "Western", "division": "Pacific"},
    {"city": "Los Angeles", "name": "Waves", "abbr": "LAW", "conference": "Western", "division": "Pacific"},
    # Western Conference - Southwest
    {"city": "Dallas", "name": "Mustangs", "abbr": "DAL", "conference": "Western", "division": "Southwest"},
    {"city": "Houston", "name": "Comets", "abbr": "HOU", "conference": "Western", "division": "Southwest"},
    {"city": "San Antonio", "name": "Coyotes", "abbr": "SAS", "conference": "Western", "division": "Southwest"},
    {"city": "Memphis", "name": "Blues", "abbr": "MEM", "conference": "Western", "division": "Southwest"},
    {"city": "New Orleans", "name": "Krewe", "abbr": "NOP", "conference": "Western", "division": "Southwest"},
]

# Color palettes per team (primary, secondary)
TEAM_COLORS: dict[str, tuple[str, str]] = {
    "BOS": ("#1B4D3E", "#C4A35A"),
    "NYT": ("#003366", "#FF6600"),
    "PHI": ("#8B4513", "#D4A574"),
    "TOR": ("#1E3A5F", "#00BCD4"),
    "BKN": ("#2C2C2C", "#9B59B6"),
    "CHI": ("#B22222", "#FFD700"),
    "CLE": ("#4A0E0E", "#C0C0C0"),
    "MIL": ("#2E4600", "#C4A35A"),
    "IND": ("#333399", "#FF8C00"),
    "DET": ("#1C1C1C", "#E74C3C"),
    "MIA": ("#FF4500", "#1C1C1C"),
    "ATL": ("#CC0000", "#FFD700"),
    "CHA": ("#2E8B57", "#FAFAD2"),
    "WAS": ("#191970", "#FFFFFF"),
    "ORL": ("#4B0082", "#00FF7F"),
    "DEN": ("#4169E1", "#DAA520"),
    "POR": ("#006400", "#8B4513"),
    "MIN": ("#4682B4", "#F0F8FF"),
    "OKC": ("#556B2F", "#FFD700"),
    "UTA": ("#8B6914", "#2F4F4F"),
    "LAV": ("#800080", "#39FF14"),
    "GSS": ("#C41E3A", "#1C1C1C"),
    "SAC": ("#4B0082", "#DAA520"),
    "PHX": ("#FF4500", "#1C1C1C"),
    "LAW": ("#006994", "#F0E68C"),
    "DAL": ("#003366", "#8B4513"),
    "HOU": ("#FF6347", "#1C1C1C"),
    "SAS": ("#708090", "#000000"),
    "MEM": ("#000080", "#87CEEB"),
    "NOP": ("#800020", "#DAA520"),
}

# Arena names per team
ARENA_NAMES: dict[str, str] = {
    "BOS": "Liberty Arena",
    "NYT": "Titan Center",
    "PHI": "Foundry Arena",
    "TOR": "Northern Arena",
    "BKN": "Phantom Pavilion",
    "CHI": "Forge Field House",
    "CLE": "Steel Arena",
    "MIL": "Antler Arena",
    "IND": "Motor Speedway Arena",
    "DET": "Gear Works Arena",
    "MIA": "Tidal Center",
    "ATL": "Phoenix Nest",
    "CHA": "Hive Center",
    "WAS": "Capitol Arena",
    "ORL": "Prism Center",
    "DEN": "Summit Arena",
    "POR": "Timber Arena",
    "MIN": "Frost Center",
    "OKC": "Storm Center",
    "UTA": "Prospector Arena",
    "LAV": "Venom Arena",
    "GSS": "Katana Center",
    "SAC": "Imperial Arena",
    "PHX": "Inferno Arena",
    "LAW": "Pacific Arena",
    "DAL": "Corral Arena",
    "HOU": "Launchpad Center",
    "SAS": "Desert Arena",
    "MEM": "Rhythm Arena",
    "NOP": "Bayou Center",
}

# Market size (1-10 scale)
MARKET_SIZES: dict[str, int] = {
    "BOS": 7, "NYT": 10, "PHI": 7, "TOR": 8, "BKN": 10,
    "CHI": 9, "CLE": 5, "MIL": 4, "IND": 4, "DET": 5,
    "MIA": 8, "ATL": 7, "CHA": 4, "WAS": 6, "ORL": 5,
    "DEN": 5, "POR": 4, "MIN": 4, "OKC": 3, "UTA": 3,
    "LAV": 10, "GSS": 9, "SAC": 4, "PHX": 6, "LAW": 10,
    "DAL": 7, "HOU": 8, "SAS": 5, "MEM": 3, "NOP": 4,
}

# Head coach name pools
COACH_FIRST_NAMES = [
    "Mike", "Steve", "Tom", "Rick", "James", "David", "Chris",
    "Mark", "Jason", "Eric", "Kevin", "Dan", "Jeff", "Greg",
    "Bill", "Tony", "Ray", "Scott", "Keith", "Frank",
    "Andre", "Phil", "Larry", "Sam", "Daryl", "Terry",
    "Marcus", "Devon", "Brian", "Paul",
]

COACH_LAST_NAMES = [
    "Sullivan", "Chambers", "Preston", "Hartwell", "Donovan",
    "Blackwood", "Mercer", "Callahan", "Whitfield", "Brennan",
    "Vasquez", "Thornton", "Westbrook", "Prescott", "Langford",
    "Hargrove", "Dalton", "Carmichael", "Abernathy", "Stratton",
    "Beaumont", "Kendrick", "Lockhart", "Fairbanks", "Sinclair",
    "Montgomery", "Rutledge", "Ashford", "Pemberton", "Holbrook",
]

OFFENSIVE_SCHEMES = [
    "motion", "princeton", "pick_and_roll_heavy", "iso_heavy",
    "pace_and_space", "triangle", "flex", "horns",
]

DEFENSIVE_SCHEMES = [
    "switch_everything", "drop_coverage", "hedge_and_recover",
    "zone_heavy", "aggressive_blitz", "conservative_shell",
]


def _generate_coaching_staff(rng: random.Random) -> dict:
    """Generate a coaching staff with ratings in the 60-90 range."""
    first = rng.choice(COACH_FIRST_NAMES)
    last = rng.choice(COACH_LAST_NAMES)

    def _rating() -> int:
        return rng.randint(60, 90)

    return {
        "head_coach": {
            "name": f"{first} {last}",
            "offense_rating": _rating(),
            "defense_rating": _rating(),
            "player_development": _rating(),
            "motivation": _rating(),
            "adaptability": _rating(),
            "experience": _rating(),
        },
        "offensive_scheme": rng.choice(OFFENSIVE_SCHEMES),
        "defensive_scheme": rng.choice(DEFENSIVE_SCHEMES),
        "pace_preference": rng.randint(40, 80),
        "three_point_emphasis": rng.randint(40, 80),
        "starter_minutes": [32.0, 32.0, 32.0, 32.0, 32.0],
    }


def generate_teams() -> list[dict]:
    """Generate all 30 teams."""
    rng = random.Random(42)  # deterministic seed for reproducibility
    teams: list[dict] = []

    for t in TEAMS:
        abbr = t["abbr"]
        primary, secondary = TEAM_COLORS[abbr]
        team = {
            "id": str(uuid.uuid5(uuid.NAMESPACE_DNS, abbr)),
            "info": {
                "city": t["city"],
                "name": t["name"],
                "abbreviation": abbr,
                "conference": t["conference"],
                "division": t["division"],
                "primary_color": primary,
                "secondary_color": secondary,
                "arena_name": ARENA_NAMES[abbr],
                "arena_capacity": rng.randint(17000, 21000),
                "market_size": MARKET_SIZES[abbr],
            },
            "coaching": _generate_coaching_staff(rng),
            "roster": [],
            "finances": {},
            "chemistry": 50,
            "home_court_advantage": 5,
            "season_record": {
                "wins": 0, "losses": 0,
                "conference_wins": 0, "conference_losses": 0,
                "division_wins": 0, "division_losses": 0,
                "home_wins": 0, "home_losses": 0,
                "away_wins": 0, "away_losses": 0,
                "streak": 0, "last_10_wins": 0, "last_10_losses": 0,
                "points_for": 0, "points_against": 0,
            },
            "history": [],
        }
        teams.append(team)

    return teams


def main() -> None:
    teams = generate_teams()

    out_dir = os.path.join(os.path.dirname(__file__), "..", "frontend", "public", "data")
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, "teams.json")

    with open(out_path, "w") as f:
        json.dump(teams, f, indent=2)

    print(f"Wrote {len(teams)} teams to {os.path.abspath(out_path)}")


if __name__ == "__main__":
    main()
