"""
Re-rate all players in players_2026_27.json with improved formulas.

Fixes:
  - Rating floors lowered (shooting can go to 25, handles/defense to 30)
  - FT rating based on FT% directly, not volume-weighted
  - 3PT rating based on 3P% + volume, with proper floor
  - Defensive ratings use real defensive data + 50+ overrides
  - Ball handling correlated with actual ball-handler role
  - Shot charts generated from real stats (3PA/FGA ratio, etc.)
  - Character traits with 100+ player-specific overrides
  - Durability overrides for injury-prone and ironman players
  - Tendency overrides for 80+ players

Reads and writes: frontend/public/data/players_2026_27.json
"""

import json
import random
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PLAYERS_JSON = ROOT / "frontend" / "public" / "data" / "players_2026_27.json"

# ── Helper ────────────────────────────────────────────────────────────

def clamp(val: float, lo: float = 65.0, hi: float = 99.0) -> int:
    return int(max(lo, min(hi, round(val))))


def percentile_rank(value: float, values: list[float]) -> float:
    """Return 0.0-1.0 percentile rank of value within values."""
    if not values or len(values) < 2:
        return 0.5
    n = len(values)
    rank = sum(1 for v in values if v <= value)
    return rank / n


# ── INTANGIBLES (preserved from original) ────────────────────────────

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
    # Additional intangibles
    "Tyler Herro": 82, "Austin Reaves": 83, "Zach LaVine": 82,
    "Julius Randle": 82, "Paul George": 85, "Draymond Green": 86,
    "Rudy Gobert": 84, "Brook Lopez": 80, "Alex Caruso": 83,
    "Herbert Jones": 80, "Luguentz Dort": 80, "OG Anunoby": 83,
    "Myles Turner": 80, "Jaren Jackson Jr.": 84, "Christian Braun": 78,
    "Andrew Wiggins": 80, "Jordan Poole": 76, "Bradley Beal": 82,
    "Klay Thompson": 84, "DeMar DeRozan": 85, "Norman Powell": 80,
    "Coby White": 78, "Jalen Green": 80, "Brandon Miller": 82,
    "Scoot Henderson": 78, "Cooper Flagg": 85, "Dylan Harper": 82,
    "Ace Bailey": 82, "Tre Johnson": 80,
    "Walker Kessler": 78, "Nic Claxton": 79, "Ivica Zubac": 80,
    "Robert Williams III": 80, "Jonathan Kuminga": 79, "Shaedon Sharpe": 78,
    "Marcus Smart": 84, "Dennis Schröder": 80, "Mike Conley": 83,
    "Kyle Lowry": 82, "Al Horford": 83, "Bogdan Bogdanović": 80,
    "Buddy Hield": 78, "Grayson Allen": 78, "Payton Pritchard": 80,
    "Cam Whitmore": 78, "Reed Sheppard": 80,
    "Donovan Clingan": 80, "Zaccharie Risacher": 78,
    "Rob Dillingham": 78, "Stephon Castle": 79,
}

# ── PHYSICAL OVERRIDES (preserved + expanded) ────────────────────────

PHYSICAL_OVERRIDES = {
    "Giannis Antetokounmpo": {"speed": 92, "vertical": 93, "strength": 95, "acceleration": 91, "lateral_quickness": 85},
    "Anthony Edwards": {"speed": 93, "vertical": 94, "strength": 85, "acceleration": 93, "lateral_quickness": 88},
    "Ja Morant": {"speed": 95, "vertical": 96, "strength": 72, "acceleration": 95, "lateral_quickness": 90},
    "Zion Williamson": {"speed": 82, "vertical": 92, "strength": 96, "acceleration": 85, "lateral_quickness": 75},
    "LeBron James": {"speed": 82, "vertical": 80, "strength": 92, "acceleration": 80, "lateral_quickness": 75},
    "Victor Wembanyama": {"speed": 78, "vertical": 85, "strength": 72, "lateral_quickness": 80},
    "Anthony Davis": {"speed": 80, "vertical": 85, "strength": 88, "lateral_quickness": 82},
    "Stephen Curry": {"speed": 82, "vertical": 74, "strength": 65, "lateral_quickness": 82},
    "Nikola Jokić": {"speed": 62, "vertical": 62, "strength": 88, "acceleration": 58, "lateral_quickness": 55},
    "Luka Dončić": {"speed": 72, "vertical": 70, "strength": 82, "acceleration": 70, "lateral_quickness": 68},
    "Shai Gilgeous-Alexander": {"speed": 85, "vertical": 82, "strength": 78, "acceleration": 86, "lateral_quickness": 84},
    "Joel Embiid": {"speed": 72, "vertical": 80, "strength": 93, "acceleration": 70, "lateral_quickness": 72},
    "Chet Holmgren": {"speed": 78, "vertical": 83, "strength": 62, "lateral_quickness": 78},
    "Bam Adebayo": {"speed": 80, "vertical": 82, "strength": 90, "acceleration": 82, "lateral_quickness": 85},
    "Kevin Durant": {"speed": 78, "vertical": 78, "strength": 72, "acceleration": 76, "lateral_quickness": 76},
    "Jayson Tatum": {"speed": 82, "vertical": 82, "strength": 80, "acceleration": 82},
    "Jaylen Brown": {"speed": 85, "vertical": 88, "strength": 82, "acceleration": 86},
    "Donovan Mitchell": {"speed": 88, "vertical": 88, "strength": 72, "acceleration": 89},
    "De'Aaron Fox": {"speed": 95, "vertical": 85, "strength": 72, "acceleration": 96},
    "Tyrese Maxey": {"speed": 93, "vertical": 82, "strength": 68, "acceleration": 94},
    "Rudy Gobert": {"speed": 62, "vertical": 75, "strength": 92, "acceleration": 58, "lateral_quickness": 60},
    "Russell Westbrook": {"speed": 85, "vertical": 85, "strength": 80, "acceleration": 86},
    "Kyrie Irving": {"speed": 82, "vertical": 78, "strength": 65, "acceleration": 85, "lateral_quickness": 88},
    "Damian Lillard": {"speed": 82, "vertical": 76, "strength": 68, "acceleration": 84},
    "James Harden": {"speed": 72, "vertical": 68, "strength": 78, "acceleration": 70, "lateral_quickness": 65},
    "Trae Young": {"speed": 80, "vertical": 68, "strength": 55, "acceleration": 82, "lateral_quickness": 72},
    "Devin Booker": {"speed": 80, "vertical": 76, "strength": 72, "acceleration": 80},
    "Karl-Anthony Towns": {"speed": 72, "vertical": 78, "strength": 82, "acceleration": 70},
    "Paolo Banchero": {"speed": 78, "vertical": 80, "strength": 82, "acceleration": 78},
    "Franz Wagner": {"speed": 80, "vertical": 80, "strength": 78, "acceleration": 80},
    "Scottie Barnes": {"speed": 82, "vertical": 82, "strength": 82, "acceleration": 82, "lateral_quickness": 82},
    "Evan Mobley": {"speed": 80, "vertical": 82, "strength": 78, "acceleration": 80, "lateral_quickness": 82},
    "Draymond Green": {"speed": 72, "vertical": 70, "strength": 85, "acceleration": 70, "lateral_quickness": 75},
    "Miles Bridges": {"speed": 82, "vertical": 90, "strength": 82, "acceleration": 84},
    "Jalen Green": {"speed": 90, "vertical": 92, "strength": 65, "acceleration": 91},
    "Brandon Miller": {"speed": 82, "vertical": 82, "strength": 72, "acceleration": 82},
    "Alex Caruso": {"speed": 82, "vertical": 82, "strength": 72, "acceleration": 82, "lateral_quickness": 88},
    "Derrick White": {"speed": 80, "vertical": 80, "strength": 75, "acceleration": 80, "lateral_quickness": 82},
    "Luguentz Dort": {"speed": 80, "vertical": 82, "strength": 82, "acceleration": 82, "lateral_quickness": 85},
    "OG Anunoby": {"speed": 78, "vertical": 80, "strength": 82, "acceleration": 78, "lateral_quickness": 82},
    "Herbert Jones": {"speed": 82, "vertical": 82, "strength": 78, "acceleration": 82, "lateral_quickness": 85},
    "Mikal Bridges": {"speed": 80, "vertical": 78, "strength": 72, "acceleration": 80, "lateral_quickness": 82},
    "Marcus Smart": {"speed": 78, "vertical": 75, "strength": 82, "acceleration": 78, "lateral_quickness": 82},
    "Jonathan Kuminga": {"speed": 85, "vertical": 88, "strength": 80, "acceleration": 86},
    "Shaedon Sharpe": {"speed": 88, "vertical": 92, "strength": 70, "acceleration": 88},
    "Cooper Flagg": {"speed": 82, "vertical": 84, "strength": 78, "acceleration": 82, "lateral_quickness": 80},
    "Dyson Daniels": {"speed": 82, "vertical": 80, "strength": 75, "acceleration": 82, "lateral_quickness": 85},
    "Jalen Suggs": {"speed": 85, "vertical": 85, "strength": 75, "acceleration": 86, "lateral_quickness": 84},
    "Andrew Wiggins": {"speed": 82, "vertical": 85, "strength": 78, "acceleration": 82},
    "Amen Thompson": {"speed": 90, "vertical": 90, "strength": 75, "acceleration": 91, "lateral_quickness": 85},
    "Ben Simmons": {"speed": 82, "vertical": 80, "strength": 85, "acceleration": 82, "lateral_quickness": 80},
    "Brook Lopez": {"speed": 55, "vertical": 65, "strength": 85, "acceleration": 52, "lateral_quickness": 52},
    "Al Horford": {"speed": 58, "vertical": 60, "strength": 78, "acceleration": 55, "lateral_quickness": 60},
    "Ivica Zubac": {"speed": 55, "vertical": 65, "strength": 88, "acceleration": 52, "lateral_quickness": 52},
    "Steven Adams": {"speed": 52, "vertical": 62, "strength": 95, "acceleration": 50, "lateral_quickness": 48},
    "Andre Drummond": {"speed": 60, "vertical": 72, "strength": 90, "acceleration": 58},
    "Myles Turner": {"speed": 72, "vertical": 80, "strength": 80, "acceleration": 72},
    "Jarrett Allen": {"speed": 72, "vertical": 82, "strength": 82, "acceleration": 72},
    "Walker Kessler": {"speed": 65, "vertical": 78, "strength": 78, "acceleration": 62, "lateral_quickness": 60},
    "Donovan Clingan": {"speed": 60, "vertical": 72, "strength": 85, "acceleration": 58, "lateral_quickness": 58},
}

# ── DEFENSIVE OVERRIDES ──────────────────────────────────────────────

DEFENSIVE_OVERRIDES = {
    # Elite perimeter defenders
    "Jrue Holiday": {"perimeter_defense": 95, "interior_defense": 72, "stealing": 88, "defensive_iq": 95, "defensive_consistency": 94},
    "Alex Caruso": {"perimeter_defense": 93, "interior_defense": 65, "stealing": 90, "defensive_iq": 92, "defensive_consistency": 92},
    "Derrick White": {"perimeter_defense": 90, "interior_defense": 70, "stealing": 85, "shot_blocking": 80, "defensive_iq": 90, "defensive_consistency": 90},
    "Herbert Jones": {"perimeter_defense": 92, "interior_defense": 78, "stealing": 85, "defensive_iq": 88, "defensive_consistency": 90},
    "Luguentz Dort": {"perimeter_defense": 90, "interior_defense": 68, "stealing": 82, "defensive_iq": 82, "defensive_consistency": 88},
    "OG Anunoby": {"perimeter_defense": 92, "interior_defense": 75, "stealing": 85, "shot_blocking": 72, "defensive_iq": 88, "defensive_consistency": 90},
    "Mikal Bridges": {"perimeter_defense": 88, "interior_defense": 68, "stealing": 80, "defensive_iq": 86, "defensive_consistency": 90},
    "Marcus Smart": {"perimeter_defense": 90, "interior_defense": 68, "stealing": 85, "defensive_iq": 90, "defensive_consistency": 86},
    "Matisse Thybulle": {"perimeter_defense": 90, "interior_defense": 70, "stealing": 88, "shot_blocking": 82, "defensive_iq": 85, "defensive_consistency": 82},
    "Dyson Daniels": {"perimeter_defense": 90, "interior_defense": 68, "stealing": 92, "defensive_iq": 85, "defensive_consistency": 88},
    "Davion Mitchell": {"perimeter_defense": 88, "interior_defense": 60, "stealing": 82, "defensive_iq": 82, "defensive_consistency": 85},
    "Jose Alvarado": {"perimeter_defense": 85, "interior_defense": 55, "stealing": 88, "defensive_iq": 82, "defensive_consistency": 82},
    "Cason Wallace": {"perimeter_defense": 85, "interior_defense": 65, "stealing": 82, "defensive_iq": 80, "defensive_consistency": 82},
    "Gary Payton II": {"perimeter_defense": 92, "interior_defense": 65, "stealing": 88, "defensive_iq": 90, "defensive_consistency": 88},
    "Fred VanVleet": {"perimeter_defense": 82, "interior_defense": 55, "stealing": 82, "defensive_iq": 85, "defensive_consistency": 85},
    "Kentavious Caldwell-Pope": {"perimeter_defense": 85, "interior_defense": 62, "stealing": 80, "defensive_iq": 85, "defensive_consistency": 88},
    "Dorian Finney-Smith": {"perimeter_defense": 85, "interior_defense": 72, "stealing": 78, "defensive_iq": 82, "defensive_consistency": 86},
    "Royce O'Neale": {"perimeter_defense": 82, "interior_defense": 70, "stealing": 78, "defensive_iq": 80, "defensive_consistency": 84},
    "Dillon Brooks": {"perimeter_defense": 85, "interior_defense": 65, "stealing": 78, "defensive_iq": 78, "defensive_consistency": 82},
    "Patrick Williams": {"perimeter_defense": 82, "interior_defense": 75, "stealing": 72, "defensive_iq": 78, "defensive_consistency": 80},
    "Jalen Suggs": {"perimeter_defense": 85, "interior_defense": 65, "stealing": 82, "defensive_iq": 80, "defensive_consistency": 82},
    "Bilal Coulibaly": {"perimeter_defense": 85, "interior_defense": 72, "stealing": 80, "defensive_iq": 78, "defensive_consistency": 80},
    "Ayo Dosunmu": {"perimeter_defense": 82, "interior_defense": 60, "stealing": 78, "defensive_iq": 80, "defensive_consistency": 82},
    "Toumani Camara": {"perimeter_defense": 84, "interior_defense": 72, "stealing": 78, "defensive_iq": 76, "defensive_consistency": 78},
    "Caleb Martin": {"perimeter_defense": 82, "interior_defense": 72, "stealing": 78, "defensive_iq": 80, "defensive_consistency": 84},
    "Aaron Gordon": {"perimeter_defense": 82, "interior_defense": 80, "stealing": 75, "defensive_iq": 82, "defensive_consistency": 85},
    "Andrew Wiggins": {"perimeter_defense": 82, "interior_defense": 72, "stealing": 78, "defensive_iq": 75, "defensive_consistency": 78},
    "Jaden McDaniels": {"perimeter_defense": 88, "interior_defense": 75, "stealing": 78, "shot_blocking": 75, "defensive_iq": 82, "defensive_consistency": 85},
    "Keon Ellis": {"perimeter_defense": 82, "interior_defense": 62, "stealing": 80, "defensive_iq": 76, "defensive_consistency": 78},
    "Isaac Okoro": {"perimeter_defense": 85, "interior_defense": 70, "stealing": 78, "defensive_iq": 78, "defensive_consistency": 82},
    "Ryan Dunn": {"perimeter_defense": 82, "interior_defense": 72, "stealing": 75, "shot_blocking": 78, "defensive_iq": 75, "defensive_consistency": 78},
    "Ausar Thompson": {"perimeter_defense": 85, "interior_defense": 72, "stealing": 82, "defensive_iq": 78, "defensive_consistency": 78},
    "Stephon Castle": {"perimeter_defense": 82, "interior_defense": 65, "stealing": 78, "defensive_iq": 78, "defensive_consistency": 78},
    "Devin Carter": {"perimeter_defense": 82, "interior_defense": 62, "stealing": 80, "defensive_iq": 78, "defensive_consistency": 78},
    "Christian Braun": {"perimeter_defense": 82, "interior_defense": 68, "stealing": 78, "defensive_iq": 80, "defensive_consistency": 82},
    "Tari Eason": {"perimeter_defense": 82, "interior_defense": 72, "stealing": 85, "defensive_iq": 72, "defensive_consistency": 72},

    # Elite interior defenders
    "Rudy Gobert": {"perimeter_defense": 55, "interior_defense": 97, "shot_blocking": 95, "stealing": 55, "defensive_iq": 92, "defensive_consistency": 92},
    "Victor Wembanyama": {"perimeter_defense": 80, "interior_defense": 95, "shot_blocking": 97, "stealing": 78, "defensive_iq": 88, "defensive_consistency": 85},
    "Anthony Davis": {"perimeter_defense": 78, "interior_defense": 95, "shot_blocking": 95, "stealing": 78, "defensive_iq": 92, "defensive_consistency": 82},
    "Bam Adebayo": {"perimeter_defense": 88, "interior_defense": 92, "shot_blocking": 78, "stealing": 78, "defensive_iq": 92, "defensive_consistency": 92},
    "Evan Mobley": {"perimeter_defense": 82, "interior_defense": 90, "shot_blocking": 85, "stealing": 72, "defensive_iq": 88, "defensive_consistency": 88},
    "Jaren Jackson Jr.": {"perimeter_defense": 75, "interior_defense": 90, "shot_blocking": 92, "stealing": 72, "defensive_iq": 85, "defensive_consistency": 82},
    "Brook Lopez": {"perimeter_defense": 50, "interior_defense": 88, "shot_blocking": 88, "stealing": 45, "defensive_iq": 85, "defensive_consistency": 85},
    "Giannis Antetokounmpo": {"perimeter_defense": 82, "interior_defense": 90, "shot_blocking": 82, "stealing": 78, "defensive_iq": 85, "defensive_consistency": 85},
    "Robert Williams III": {"perimeter_defense": 68, "interior_defense": 90, "shot_blocking": 92, "stealing": 72, "defensive_iq": 85, "defensive_consistency": 70},
    "Draymond Green": {"perimeter_defense": 85, "interior_defense": 85, "shot_blocking": 68, "stealing": 78, "defensive_iq": 95, "defensive_consistency": 82},
    "Myles Turner": {"perimeter_defense": 62, "interior_defense": 88, "shot_blocking": 92, "stealing": 60, "defensive_iq": 82, "defensive_consistency": 82},
    "Chet Holmgren": {"perimeter_defense": 72, "interior_defense": 88, "shot_blocking": 92, "stealing": 68, "defensive_iq": 82, "defensive_consistency": 78},
    "Walker Kessler": {"perimeter_defense": 50, "interior_defense": 88, "shot_blocking": 92, "stealing": 50, "defensive_iq": 78, "defensive_consistency": 78},
    "Nic Claxton": {"perimeter_defense": 72, "interior_defense": 85, "shot_blocking": 85, "stealing": 65, "defensive_iq": 80, "defensive_consistency": 78},
    "Mitchell Robinson": {"perimeter_defense": 55, "interior_defense": 88, "shot_blocking": 90, "stealing": 50, "defensive_iq": 78, "defensive_consistency": 72},
    "Jarrett Allen": {"perimeter_defense": 60, "interior_defense": 85, "shot_blocking": 80, "stealing": 55, "defensive_iq": 80, "defensive_consistency": 85},
    "Jakob Poeltl": {"perimeter_defense": 58, "interior_defense": 85, "shot_blocking": 82, "stealing": 55, "defensive_iq": 78, "defensive_consistency": 82},
    "Donovan Clingan": {"perimeter_defense": 55, "interior_defense": 85, "shot_blocking": 88, "stealing": 55, "defensive_iq": 75, "defensive_consistency": 75},
    "Isaiah Hartenstein": {"perimeter_defense": 65, "interior_defense": 82, "shot_blocking": 78, "stealing": 62, "defensive_iq": 80, "defensive_consistency": 82},
    "Dereck Lively II": {"perimeter_defense": 62, "interior_defense": 85, "shot_blocking": 85, "stealing": 58, "defensive_iq": 78, "defensive_consistency": 78},
    "Ivica Zubac": {"perimeter_defense": 50, "interior_defense": 82, "shot_blocking": 78, "stealing": 50, "defensive_iq": 75, "defensive_consistency": 82},
    "Kel'el Ware": {"perimeter_defense": 60, "interior_defense": 82, "shot_blocking": 85, "stealing": 55, "defensive_iq": 72, "defensive_consistency": 72},
    "Jonathan Isaac": {"perimeter_defense": 88, "interior_defense": 88, "shot_blocking": 88, "stealing": 82, "defensive_iq": 85, "defensive_consistency": 55},
    "Pascal Siakam": {"perimeter_defense": 78, "interior_defense": 78, "stealing": 72, "defensive_iq": 80, "defensive_consistency": 82},
    "Al Horford": {"perimeter_defense": 68, "interior_defense": 82, "shot_blocking": 75, "stealing": 62, "defensive_iq": 90, "defensive_consistency": 88},
    "Scottie Barnes": {"perimeter_defense": 82, "interior_defense": 78, "stealing": 78, "defensive_iq": 82, "defensive_consistency": 82},
    "Joel Embiid": {"perimeter_defense": 68, "interior_defense": 90, "shot_blocking": 85, "stealing": 65, "defensive_iq": 85, "defensive_consistency": 72},
    "Kristaps Porziņģis": {"perimeter_defense": 62, "interior_defense": 85, "shot_blocking": 88, "stealing": 55, "defensive_iq": 78, "defensive_consistency": 75},

    # Bad/mediocre defenders
    "Trae Young": {"perimeter_defense": 38, "interior_defense": 30, "stealing": 60, "defensive_iq": 55, "defensive_consistency": 45},
    "James Harden": {"perimeter_defense": 45, "interior_defense": 40, "stealing": 65, "defensive_iq": 60, "defensive_consistency": 45},
    "Russell Westbrook": {"perimeter_defense": 52, "interior_defense": 48, "stealing": 68, "defensive_iq": 50, "defensive_consistency": 48},
    "Damian Lillard": {"perimeter_defense": 50, "interior_defense": 38, "stealing": 58, "defensive_iq": 55, "defensive_consistency": 52},
    "Kyrie Irving": {"perimeter_defense": 52, "interior_defense": 38, "stealing": 62, "defensive_iq": 60, "defensive_consistency": 50},
    "Luka Dončić": {"perimeter_defense": 50, "interior_defense": 48, "stealing": 60, "defensive_iq": 62, "defensive_consistency": 48},
    "Jordan Poole": {"perimeter_defense": 40, "interior_defense": 35, "stealing": 55, "defensive_iq": 42, "defensive_consistency": 40},
    "Zach LaVine": {"perimeter_defense": 48, "interior_defense": 42, "stealing": 55, "defensive_iq": 50, "defensive_consistency": 48},
    "Kevin Huerter": {"perimeter_defense": 48, "interior_defense": 40, "stealing": 55, "defensive_iq": 52, "defensive_consistency": 50},
    "Duncan Robinson": {"perimeter_defense": 45, "interior_defense": 38, "stealing": 48, "defensive_iq": 55, "defensive_consistency": 52},
    "Buddy Hield": {"perimeter_defense": 42, "interior_defense": 35, "stealing": 50, "defensive_iq": 48, "defensive_consistency": 45},
    "LaMelo Ball": {"perimeter_defense": 45, "interior_defense": 38, "stealing": 65, "defensive_iq": 52, "defensive_consistency": 45},
    "D'Angelo Russell": {"perimeter_defense": 42, "interior_defense": 35, "stealing": 55, "defensive_iq": 48, "defensive_consistency": 42},
    "Anfernee Simons": {"perimeter_defense": 45, "interior_defense": 35, "stealing": 52, "defensive_iq": 48, "defensive_consistency": 45},
    "Collin Sexton": {"perimeter_defense": 42, "interior_defense": 35, "stealing": 52, "defensive_iq": 45, "defensive_consistency": 42},
    "Bradley Beal": {"perimeter_defense": 48, "interior_defense": 40, "stealing": 55, "defensive_iq": 52, "defensive_consistency": 48},
    "Tyler Herro": {"perimeter_defense": 48, "interior_defense": 40, "stealing": 55, "defensive_iq": 55, "defensive_consistency": 50},
    "Jalen Green": {"perimeter_defense": 45, "interior_defense": 38, "stealing": 52, "defensive_iq": 48, "defensive_consistency": 45},
    "Ben Simmons": {"perimeter_defense": 78, "interior_defense": 72, "stealing": 78, "defensive_iq": 75, "defensive_consistency": 60},
    "Nikola Jokić": {"perimeter_defense": 52, "interior_defense": 65, "shot_blocking": 45, "stealing": 65, "defensive_iq": 78, "defensive_consistency": 72},
    "Karl-Anthony Towns": {"perimeter_defense": 50, "interior_defense": 68, "shot_blocking": 62, "stealing": 52, "defensive_iq": 58, "defensive_consistency": 60},
    "Julius Randle": {"perimeter_defense": 48, "interior_defense": 58, "stealing": 55, "defensive_iq": 55, "defensive_consistency": 55},
    "Domantas Sabonis": {"perimeter_defense": 48, "interior_defense": 62, "stealing": 55, "defensive_iq": 68, "defensive_consistency": 72},
    "Nikola Vučević": {"perimeter_defense": 42, "interior_defense": 60, "shot_blocking": 55, "stealing": 48, "defensive_iq": 62, "defensive_consistency": 65},
    "Marvin Bagley III": {"perimeter_defense": 38, "interior_defense": 45, "stealing": 42, "defensive_iq": 38, "defensive_consistency": 38},
    "Kevin Love": {"perimeter_defense": 35, "interior_defense": 45, "stealing": 42, "defensive_iq": 60, "defensive_consistency": 50},
}

# ── BALL HANDLING OVERRIDES ──────────────────────────────────────────

BALL_HANDLING_OVERRIDES = {
    # Elite ball handlers
    "Kyrie Irving": 99,
    "Stephen Curry": 95,
    "Luka Dončić": 94,
    "Shai Gilgeous-Alexander": 93,
    "Trae Young": 93,
    "Jalen Brunson": 92,
    "LaMelo Ball": 92,
    "Ja Morant": 93,
    "James Harden": 90,
    "Chris Paul": 90,
    "Damian Lillard": 90,
    "De'Aaron Fox": 90,
    "Tyrese Haliburton": 88,
    "Cade Cunningham": 88,
    "Darius Garland": 90,
    "LeBron James": 85,
    "Donovan Mitchell": 88,
    "Dennis Schröder": 88,
    "D'Angelo Russell": 86,
    "Russell Westbrook": 85,
    "Tyrese Maxey": 88,
    "Anfernee Simons": 85,
    "Devin Booker": 85,
    "Paolo Banchero": 82,
    "Anthony Edwards": 82,
    "Giannis Antetokounmpo": 78,
    "Kevin Durant": 82,
    "Franz Wagner": 82,
    "Scottie Barnes": 80,
    "Jalen Williams": 80,
    "Ben Simmons": 78,
    "Fred VanVleet": 85,
    "Jordan Poole": 82,
    "Jamal Murray": 88,
    "Collin Sexton": 82,
    "CJ McCollum": 82,
    "Tyler Herro": 80,
    "Coby White": 82,
    "Scoot Henderson": 85,
    "Rob Dillingham": 88,
    "Cooper Flagg": 78,
    "Dylan Harper": 85,
    "Zion Williamson": 72,
    "Jayson Tatum": 78,
    "Jaylen Brown": 75,
    "Mike Conley": 85,
    "Austin Reaves": 82,
    "Bones Hyland": 85,
    "Tre Jones": 80,
    "Mac McClung": 82,
    "Keyonte George": 82,
    "Nikola Jokić": 65,
    "DeMar DeRozan": 78,

    # Non-ball-handlers (low handles)
    "Rudy Gobert": 30,
    "Brook Lopez": 35,
    "Duncan Robinson": 42,
    "Buddy Hield": 45,
    "Mikal Bridges": 55,
    "OG Anunoby": 50,
    "Herbert Jones": 45,
    "Matisse Thybulle": 40,
    "Steven Adams": 30,
    "Clint Capela": 30,
    "Mitchell Robinson": 30,
    "Robert Williams III": 35,
    "Walker Kessler": 32,
    "Jarrett Allen": 38,
    "Ivica Zubac": 32,
    "Andre Drummond": 35,
    "DeAndre Jordan": 30,
    "Nic Claxton": 40,
    "Jakob Poeltl": 38,
    "Daniel Gafford": 32,
    "Al Horford": 50,
    "Myles Turner": 42,
    "Donovan Clingan": 30,
    "Isaiah Hartenstein": 42,
    "Dereck Lively II": 35,
    "Draymond Green": 65,
    "Aaron Gordon": 58,
    "Sam Hauser": 42,
    "Grayson Allen": 52,
    "Dorian Finney-Smith": 48,
    "Patrick Williams": 52,
    "Royce O'Neale": 50,
    "Kentavious Caldwell-Pope": 52,
    "P.J. Washington": 52,
    "Jaden McDaniels": 50,
    "Caleb Martin": 50,
    "Andrew Wiggins": 55,
    "Isaac Okoro": 48,
    "Harrison Barnes": 55,
    "Luguentz Dort": 50,
    "Klay Thompson": 55,
    "Tobias Harris": 55,
    "Dillon Brooks": 52,
    "Bam Adebayo": 55,
    "Jonas Valanciunas": 35,
    "Nick Richards": 30,
    "Bismack Biyombo": 30,
    "Mason Plumlee": 45,
    "Zach Edey": 35,
    "Precious Achiuwa": 42,
    "Jaren Jackson Jr.": 45,
    "Deandre Ayton": 42,
    "Evan Mobley": 52,
    "Chet Holmgren": 52,
    "Victor Wembanyama": 55,
    "Anthony Davis": 50,
    "Joel Embiid": 58,
    "Karl-Anthony Towns": 55,
    "Pascal Siakam": 68,
    "Julius Randle": 62,
    "Bobby Portis Jr.": 42,
    "Kristaps Porziņģis": 45,
    "Nikola Vučević": 48,
    "Alperen Sengun": 58,
    "Kelly Olynyk": 52,
    "Lauri Markkanen": 55,
    "Domantas Sabonis": 55,
    "John Collins": 42,
}

# ── RATING OVERRIDES (skill-specific, applied after formulas) ────────
# For players whose formula-based ratings don't match their reputation

RATING_OVERRIDES = {
    "Stephen Curry": {"three_point": 99, "off_ball_movement": 95, "mid_range": 90},
    "Nikola Jokić": {"passing_vision": 98, "passing_accuracy": 92, "basketball_iq": 99, "offensive_iq": 99, "post_game": 92},
    "Shai Gilgeous-Alexander": {"draw_foul": 95, "finishing": 96, "mid_range": 90},
    "Victor Wembanyama": {"shot_blocking": 97},
    "Anthony Davis": {"shot_blocking": 95, "finishing": 90},
    "Joel Embiid": {"post_game": 96, "finishing": 92},
    "Giannis Antetokounmpo": {"finishing": 97, "draw_foul": 92},
    "LeBron James": {"passing_vision": 90, "basketball_iq": 95, "finishing": 88},
    "Kevin Durant": {"mid_range": 95, "finishing": 95, "post_game": 82},
    "Luka Dončić": {"passing_vision": 95, "mid_range": 88, "finishing": 90, "post_game": 72},
    "Jayson Tatum": {"finishing": 88, "mid_range": 85},
    "Kawhi Leonard": {"mid_range": 92, "finishing": 90, "stealing": 85},
    "Jimmy Butler III": {"draw_foul": 90, "finishing": 88},
    "Kyrie Irving": {"finishing": 95, "mid_range": 90, "close_range": 92},
    "Devin Booker": {"mid_range": 90, "finishing": 88},
    "DeMar DeRozan": {"mid_range": 95, "finishing": 88, "draw_foul": 88, "post_game": 78},
    "Damian Lillard": {"three_point": 88, "finishing": 85, "mid_range": 82},
    "Klay Thompson": {"three_point": 88, "off_ball_movement": 90, "catch_and_shoot_frequency": 92},
    "Jalen Brunson": {"mid_range": 85, "finishing": 85},
    "Chris Paul": {"passing_vision": 95, "passing_accuracy": 92, "basketball_iq": 95, "offensive_iq": 95},
    "Trae Young": {"passing_vision": 92, "three_point": 78, "draw_foul": 88},
    "James Harden": {"passing_vision": 88, "draw_foul": 88, "three_point": 82},
    "Draymond Green": {"passing_vision": 85, "basketball_iq": 92},
    "Bam Adebayo": {"passing_vision": 78, "finishing": 85},
    "Ben Simmons": {"three_point": 25, "free_throw": 42, "passing_vision": 82},
    "Russell Westbrook": {"finishing": 78, "three_point": 52},
    "Alperen Sengun": {"passing_vision": 82, "post_game": 85},
    "Zion Williamson": {"finishing": 92, "close_range": 90, "draw_foul": 88},
    "Scottie Barnes": {"passing_vision": 80},
    "Cade Cunningham": {"passing_vision": 82, "mid_range": 80},
    "Paolo Banchero": {"finishing": 85, "mid_range": 80},
    "Franz Wagner": {"finishing": 85, "mid_range": 82},
    "Evan Mobley": {"finishing": 78, "shot_blocking": 85},
    "Karl-Anthony Towns": {"three_point": 82, "post_game": 82},
    "Kristaps Porziņģis": {"three_point": 82, "shot_blocking": 88},
    "Jaren Jackson Jr.": {"shot_blocking": 92},
    "Myles Turner": {"shot_blocking": 92, "three_point": 78},
    "Rudy Gobert": {"shot_blocking": 95, "rebounding": 95},
    "Brook Lopez": {"shot_blocking": 88, "three_point": 78},
    "Chet Holmgren": {"shot_blocking": 92, "three_point": 82},
    "Donovan Mitchell": {"finishing": 88, "mid_range": 82},
    "Anthony Edwards": {"finishing": 90, "mid_range": 82},
    "Tyrese Maxey": {"finishing": 85},
    "Jamal Murray": {"mid_range": 85, "finishing": 82},
    "Tyler Herro": {"three_point": 85, "mid_range": 82},
    "Norman Powell": {"finishing": 85},
    "Jordan Poole": {"three_point": 75},
    "Payton Pritchard": {"three_point": 90},
    "Duncan Robinson": {"three_point": 95},
    "Buddy Hield": {"three_point": 90},
    "Sam Hauser": {"three_point": 88},
    "Luke Kennard": {"three_point": 85},
    "Corey Kispert": {"three_point": 82},
    "Max Strus": {"three_point": 82},
    "Bogdan Bogdanović": {"three_point": 85},
    "Grayson Allen": {"three_point": 82},
    "Domantas Sabonis": {"rebounding": 92, "passing_vision": 80, "post_game": 85},
    "Walker Kessler": {"shot_blocking": 92, "rebounding": 85},
    "Jarrett Allen": {"finishing": 80, "rebounding": 85},
    "Robert Williams III": {"shot_blocking": 92},
    "Mitchell Robinson": {"shot_blocking": 90, "rebounding": 82},
    "Clint Capela": {"finishing": 80, "rebounding": 85},
    "Ivica Zubac": {"rebounding": 85, "finishing": 80},
    "Cooper Flagg": {"finishing": 82},
    "Jalen Williams": {"finishing": 82, "mid_range": 80},
    "Dyson Daniels": {"stealing": 92},
}

# ── CHARACTER OVERRIDES ──────────────────────────────────────────────

CHARACTER_OVERRIDES = {
    "LeBron James": {"leadership": 99, "competitiveness": 95, "work_ethic": 95, "clutch": 90, "ego": 82, "coachability": 75, "temperament": 82, "fan_favorite": 92, "media_personality": 95, "loyalty": 55},
    "Stephen Curry": {"leadership": 90, "competitiveness": 95, "work_ethic": 97, "clutch": 95, "ego": 55, "coachability": 95, "temperament": 92, "fan_favorite": 99, "media_personality": 90, "loyalty": 95},
    "Kevin Durant": {"leadership": 72, "competitiveness": 92, "work_ethic": 90, "clutch": 88, "ego": 80, "coachability": 72, "temperament": 55, "fan_favorite": 78, "media_personality": 65, "loyalty": 40},
    "Nikola Jokić": {"leadership": 85, "competitiveness": 88, "work_ethic": 85, "clutch": 92, "ego": 35, "coachability": 92, "temperament": 88, "fan_favorite": 92, "media_personality": 78, "loyalty": 88},
    "Giannis Antetokounmpo": {"leadership": 92, "competitiveness": 97, "work_ethic": 99, "clutch": 88, "ego": 55, "coachability": 90, "temperament": 82, "fan_favorite": 95, "media_personality": 85, "loyalty": 92},
    "Luka Dončić": {"leadership": 82, "competitiveness": 92, "work_ethic": 72, "clutch": 92, "ego": 75, "coachability": 68, "temperament": 55, "fan_favorite": 88, "media_personality": 78, "loyalty": 72},
    "Shai Gilgeous-Alexander": {"leadership": 85, "competitiveness": 92, "work_ethic": 92, "clutch": 90, "ego": 50, "coachability": 90, "temperament": 88, "fan_favorite": 88, "media_personality": 72, "loyalty": 82},
    "Joel Embiid": {"leadership": 78, "competitiveness": 90, "work_ethic": 78, "clutch": 78, "ego": 82, "coachability": 70, "temperament": 55, "fan_favorite": 72, "media_personality": 82, "loyalty": 72},
    "Jayson Tatum": {"leadership": 85, "competitiveness": 88, "work_ethic": 90, "clutch": 82, "ego": 72, "coachability": 82, "temperament": 78, "fan_favorite": 82, "media_personality": 78, "loyalty": 82},
    "Jaylen Brown": {"leadership": 82, "competitiveness": 88, "work_ethic": 92, "clutch": 82, "ego": 70, "coachability": 72, "temperament": 72, "fan_favorite": 78, "media_personality": 72, "loyalty": 78},
    "Anthony Edwards": {"leadership": 80, "competitiveness": 92, "work_ethic": 85, "clutch": 85, "ego": 72, "coachability": 78, "temperament": 72, "fan_favorite": 95, "media_personality": 92, "loyalty": 78},
    "Jimmy Butler III": {"leadership": 90, "competitiveness": 97, "work_ethic": 95, "clutch": 92, "ego": 82, "coachability": 52, "temperament": 45, "fan_favorite": 72, "media_personality": 78, "loyalty": 35},
    "Draymond Green": {"leadership": 88, "competitiveness": 92, "work_ethic": 82, "clutch": 78, "ego": 82, "coachability": 55, "temperament": 32, "fan_favorite": 55, "media_personality": 85, "loyalty": 72},
    "Trae Young": {"leadership": 72, "competitiveness": 82, "work_ethic": 82, "clutch": 78, "ego": 78, "coachability": 68, "temperament": 65, "fan_favorite": 62, "media_personality": 72, "loyalty": 65},
    "Kyrie Irving": {"leadership": 65, "competitiveness": 85, "work_ethic": 82, "clutch": 92, "ego": 85, "coachability": 42, "temperament": 50, "fan_favorite": 68, "media_personality": 55, "loyalty": 35},
    "James Harden": {"leadership": 60, "competitiveness": 78, "work_ethic": 62, "clutch": 72, "ego": 85, "coachability": 45, "temperament": 55, "fan_favorite": 55, "media_personality": 72, "loyalty": 30},
    "Russell Westbrook": {"leadership": 78, "competitiveness": 95, "work_ethic": 92, "clutch": 72, "ego": 88, "coachability": 50, "temperament": 52, "fan_favorite": 68, "media_personality": 75, "loyalty": 60},
    "Damian Lillard": {"leadership": 90, "competitiveness": 90, "work_ethic": 90, "clutch": 95, "ego": 65, "coachability": 82, "temperament": 82, "fan_favorite": 90, "media_personality": 82, "loyalty": 72},
    "Devin Booker": {"leadership": 82, "competitiveness": 88, "work_ethic": 88, "clutch": 85, "ego": 72, "coachability": 78, "temperament": 62, "fan_favorite": 82, "media_personality": 72, "loyalty": 80},
    "Donovan Mitchell": {"leadership": 82, "competitiveness": 88, "work_ethic": 88, "clutch": 85, "ego": 68, "coachability": 80, "temperament": 75, "fan_favorite": 82, "media_personality": 78, "loyalty": 65},
    "Ja Morant": {"leadership": 72, "competitiveness": 90, "work_ethic": 72, "clutch": 82, "ego": 78, "coachability": 55, "temperament": 42, "fan_favorite": 78, "media_personality": 78, "loyalty": 72},
    "Ben Simmons": {"leadership": 42, "competitiveness": 45, "work_ethic": 35, "clutch": 30, "ego": 78, "coachability": 32, "temperament": 42, "fan_favorite": 30, "media_personality": 35, "loyalty": 35},
    "Jalen Brunson": {"leadership": 88, "competitiveness": 88, "work_ethic": 92, "clutch": 88, "ego": 42, "coachability": 90, "temperament": 85, "fan_favorite": 88, "media_personality": 82, "loyalty": 85},
    "Tyrese Haliburton": {"leadership": 82, "competitiveness": 82, "work_ethic": 88, "clutch": 78, "ego": 45, "coachability": 90, "temperament": 85, "fan_favorite": 85, "media_personality": 82, "loyalty": 82},
    "De'Aaron Fox": {"leadership": 78, "competitiveness": 85, "work_ethic": 85, "clutch": 78, "ego": 55, "coachability": 82, "temperament": 80, "fan_favorite": 78, "media_personality": 72, "loyalty": 78},
    "Darius Garland": {"leadership": 72, "competitiveness": 78, "work_ethic": 82, "clutch": 75, "ego": 45, "coachability": 85, "temperament": 82, "fan_favorite": 78, "media_personality": 72, "loyalty": 78},
    "Bam Adebayo": {"leadership": 85, "competitiveness": 88, "work_ethic": 92, "clutch": 78, "ego": 45, "coachability": 90, "temperament": 85, "fan_favorite": 82, "media_personality": 72, "loyalty": 90},
    "Jrue Holiday": {"leadership": 90, "competitiveness": 88, "work_ethic": 92, "clutch": 82, "ego": 35, "coachability": 95, "temperament": 92, "fan_favorite": 85, "media_personality": 72, "loyalty": 82},
    "Alex Caruso": {"leadership": 78, "competitiveness": 85, "work_ethic": 92, "clutch": 72, "ego": 30, "coachability": 95, "temperament": 88, "fan_favorite": 90, "media_personality": 78, "loyalty": 78},
    "Chris Paul": {"leadership": 92, "competitiveness": 90, "work_ethic": 92, "clutch": 82, "ego": 72, "coachability": 72, "temperament": 55, "fan_favorite": 78, "media_personality": 85, "loyalty": 55},
    "Kawhi Leonard": {"leadership": 65, "competitiveness": 90, "work_ethic": 82, "clutch": 92, "ego": 45, "coachability": 72, "temperament": 92, "fan_favorite": 78, "media_personality": 30, "loyalty": 40},
    "Zion Williamson": {"leadership": 55, "competitiveness": 78, "work_ethic": 52, "clutch": 72, "ego": 62, "coachability": 58, "temperament": 65, "fan_favorite": 72, "media_personality": 65, "loyalty": 72},
    "Paul George": {"leadership": 72, "competitiveness": 78, "work_ethic": 82, "clutch": 72, "ego": 72, "coachability": 72, "temperament": 70, "fan_favorite": 72, "media_personality": 82, "loyalty": 50},
    "LaMelo Ball": {"leadership": 72, "competitiveness": 78, "work_ethic": 68, "clutch": 72, "ego": 72, "coachability": 62, "temperament": 65, "fan_favorite": 88, "media_personality": 88, "loyalty": 72},
    "Anthony Davis": {"leadership": 72, "competitiveness": 85, "work_ethic": 82, "clutch": 82, "ego": 55, "coachability": 82, "temperament": 78, "fan_favorite": 78, "media_personality": 65, "loyalty": 72},
    "Rudy Gobert": {"leadership": 72, "competitiveness": 82, "work_ethic": 90, "clutch": 60, "ego": 55, "coachability": 82, "temperament": 62, "fan_favorite": 45, "media_personality": 55, "loyalty": 78},
    "DeMar DeRozan": {"leadership": 82, "competitiveness": 85, "work_ethic": 88, "clutch": 88, "ego": 55, "coachability": 82, "temperament": 82, "fan_favorite": 82, "media_personality": 78, "loyalty": 72},
    "Klay Thompson": {"leadership": 72, "competitiveness": 82, "work_ethic": 88, "clutch": 85, "ego": 50, "coachability": 88, "temperament": 82, "fan_favorite": 92, "media_personality": 82, "loyalty": 68},
    "Victor Wembanyama": {"leadership": 72, "competitiveness": 85, "work_ethic": 92, "clutch": 78, "ego": 40, "coachability": 92, "temperament": 85, "fan_favorite": 92, "media_personality": 78, "loyalty": 82},
    "Paolo Banchero": {"leadership": 78, "competitiveness": 85, "work_ethic": 82, "clutch": 78, "ego": 65, "coachability": 78, "temperament": 72, "fan_favorite": 78, "media_personality": 72, "loyalty": 78},
    "Franz Wagner": {"leadership": 78, "competitiveness": 82, "work_ethic": 88, "clutch": 80, "ego": 40, "coachability": 90, "temperament": 88, "fan_favorite": 78, "media_personality": 72, "loyalty": 82},
    "Evan Mobley": {"leadership": 72, "competitiveness": 80, "work_ethic": 88, "clutch": 72, "ego": 35, "coachability": 92, "temperament": 88, "fan_favorite": 75, "media_personality": 55, "loyalty": 82},
    "Scottie Barnes": {"leadership": 78, "competitiveness": 85, "work_ethic": 88, "clutch": 72, "ego": 55, "coachability": 85, "temperament": 75, "fan_favorite": 85, "media_personality": 82, "loyalty": 78},
    "Chet Holmgren": {"leadership": 68, "competitiveness": 78, "work_ethic": 85, "clutch": 72, "ego": 45, "coachability": 88, "temperament": 82, "fan_favorite": 75, "media_personality": 72, "loyalty": 82},
    "Karl-Anthony Towns": {"leadership": 68, "competitiveness": 78, "work_ethic": 78, "clutch": 72, "ego": 65, "coachability": 72, "temperament": 62, "fan_favorite": 72, "media_personality": 72, "loyalty": 65},
    "Zach LaVine": {"leadership": 55, "competitiveness": 72, "work_ethic": 68, "clutch": 72, "ego": 78, "coachability": 55, "temperament": 62, "fan_favorite": 68, "media_personality": 65, "loyalty": 45},
    "Brandon Ingram": {"leadership": 55, "competitiveness": 72, "work_ethic": 72, "clutch": 72, "ego": 68, "coachability": 68, "temperament": 72, "fan_favorite": 62, "media_personality": 52, "loyalty": 55},
    "Tyler Herro": {"leadership": 68, "competitiveness": 78, "work_ethic": 78, "clutch": 82, "ego": 72, "coachability": 72, "temperament": 68, "fan_favorite": 75, "media_personality": 75, "loyalty": 72},
    "Austin Reaves": {"leadership": 72, "competitiveness": 85, "work_ethic": 92, "clutch": 82, "ego": 42, "coachability": 90, "temperament": 82, "fan_favorite": 88, "media_personality": 78, "loyalty": 78},
    "Jamal Murray": {"leadership": 72, "competitiveness": 85, "work_ethic": 82, "clutch": 90, "ego": 55, "coachability": 78, "temperament": 55, "fan_favorite": 78, "media_personality": 62, "loyalty": 78},
    "Derrick White": {"leadership": 78, "competitiveness": 82, "work_ethic": 90, "clutch": 80, "ego": 30, "coachability": 95, "temperament": 90, "fan_favorite": 82, "media_personality": 55, "loyalty": 82},
    "Domantas Sabonis": {"leadership": 78, "competitiveness": 85, "work_ethic": 90, "clutch": 72, "ego": 42, "coachability": 88, "temperament": 82, "fan_favorite": 78, "media_personality": 65, "loyalty": 78},
    "Marcus Smart": {"leadership": 85, "competitiveness": 92, "work_ethic": 90, "clutch": 75, "ego": 65, "coachability": 72, "temperament": 52, "fan_favorite": 78, "media_personality": 72, "loyalty": 72},
    "Jordan Poole": {"leadership": 45, "competitiveness": 62, "work_ethic": 58, "clutch": 55, "ego": 78, "coachability": 52, "temperament": 48, "fan_favorite": 52, "media_personality": 55, "loyalty": 48},
    "Duncan Robinson": {"leadership": 52, "competitiveness": 68, "work_ethic": 82, "clutch": 65, "ego": 42, "coachability": 88, "temperament": 82, "fan_favorite": 62, "media_personality": 65, "loyalty": 82},
    "Buddy Hield": {"leadership": 52, "competitiveness": 68, "work_ethic": 78, "clutch": 65, "ego": 50, "coachability": 78, "temperament": 75, "fan_favorite": 65, "media_personality": 62, "loyalty": 55},
    "Brook Lopez": {"leadership": 68, "competitiveness": 78, "work_ethic": 82, "clutch": 68, "ego": 35, "coachability": 88, "temperament": 88, "fan_favorite": 82, "media_personality": 78, "loyalty": 82},
    "Payton Pritchard": {"leadership": 68, "competitiveness": 82, "work_ethic": 90, "clutch": 82, "ego": 42, "coachability": 88, "temperament": 82, "fan_favorite": 82, "media_personality": 72, "loyalty": 78},
    "Cooper Flagg": {"leadership": 78, "competitiveness": 88, "work_ethic": 90, "clutch": 78, "ego": 52, "coachability": 88, "temperament": 82, "fan_favorite": 85, "media_personality": 72, "loyalty": 82},
    "Jalen Williams": {"leadership": 75, "competitiveness": 82, "work_ethic": 88, "clutch": 78, "ego": 38, "coachability": 92, "temperament": 88, "fan_favorite": 82, "media_personality": 68, "loyalty": 82},
    "Cade Cunningham": {"leadership": 82, "competitiveness": 85, "work_ethic": 85, "clutch": 82, "ego": 58, "coachability": 82, "temperament": 78, "fan_favorite": 78, "media_personality": 72, "loyalty": 78},
    "Tyrese Maxey": {"leadership": 72, "competitiveness": 85, "work_ethic": 92, "clutch": 82, "ego": 38, "coachability": 92, "temperament": 88, "fan_favorite": 90, "media_personality": 82, "loyalty": 82},
    "Alperen Sengun": {"leadership": 68, "competitiveness": 78, "work_ethic": 85, "clutch": 72, "ego": 40, "coachability": 88, "temperament": 82, "fan_favorite": 78, "media_personality": 72, "loyalty": 82},
    "Dejounte Murray": {"leadership": 72, "competitiveness": 82, "work_ethic": 85, "clutch": 72, "ego": 65, "coachability": 72, "temperament": 62, "fan_favorite": 68, "media_personality": 62, "loyalty": 55},
    "Pascal Siakam": {"leadership": 72, "competitiveness": 82, "work_ethic": 85, "clutch": 72, "ego": 55, "coachability": 82, "temperament": 78, "fan_favorite": 72, "media_personality": 62, "loyalty": 68},
    "Mikal Bridges": {"leadership": 68, "competitiveness": 78, "work_ethic": 88, "clutch": 65, "ego": 38, "coachability": 92, "temperament": 88, "fan_favorite": 78, "media_personality": 72, "loyalty": 72},
    "Norman Powell": {"leadership": 68, "competitiveness": 82, "work_ethic": 85, "clutch": 80, "ego": 42, "coachability": 88, "temperament": 82, "fan_favorite": 72, "media_personality": 62, "loyalty": 72},
    "Christian Braun": {"leadership": 72, "competitiveness": 85, "work_ethic": 88, "clutch": 78, "ego": 52, "coachability": 88, "temperament": 78, "fan_favorite": 78, "media_personality": 72, "loyalty": 82},
    "Lauri Markkanen": {"leadership": 68, "competitiveness": 78, "work_ethic": 82, "clutch": 72, "ego": 42, "coachability": 85, "temperament": 82, "fan_favorite": 72, "media_personality": 55, "loyalty": 72},
    "Josh Hart": {"leadership": 78, "competitiveness": 88, "work_ethic": 92, "clutch": 72, "ego": 35, "coachability": 92, "temperament": 82, "fan_favorite": 85, "media_personality": 82, "loyalty": 78},
    "Mike Conley": {"leadership": 88, "competitiveness": 82, "work_ethic": 88, "clutch": 78, "ego": 30, "coachability": 95, "temperament": 95, "fan_favorite": 88, "media_personality": 78, "loyalty": 85},
    "Kyle Lowry": {"leadership": 88, "competitiveness": 88, "work_ethic": 85, "clutch": 78, "ego": 62, "coachability": 72, "temperament": 55, "fan_favorite": 78, "media_personality": 72, "loyalty": 68},
    "Al Horford": {"leadership": 90, "competitiveness": 82, "work_ethic": 88, "clutch": 72, "ego": 30, "coachability": 95, "temperament": 95, "fan_favorite": 85, "media_personality": 72, "loyalty": 78},
    "Dennis Schröder": {"leadership": 65, "competitiveness": 82, "work_ethic": 78, "clutch": 68, "ego": 72, "coachability": 58, "temperament": 48, "fan_favorite": 58, "media_personality": 65, "loyalty": 42},
    "Dillon Brooks": {"leadership": 55, "competitiveness": 82, "work_ethic": 78, "clutch": 62, "ego": 78, "coachability": 55, "temperament": 35, "fan_favorite": 42, "media_personality": 62, "loyalty": 55},
    "Herbert Jones": {"leadership": 68, "competitiveness": 82, "work_ethic": 92, "clutch": 62, "ego": 30, "coachability": 92, "temperament": 88, "fan_favorite": 72, "media_personality": 48, "loyalty": 82},
    "Luguentz Dort": {"leadership": 65, "competitiveness": 85, "work_ethic": 90, "clutch": 62, "ego": 35, "coachability": 88, "temperament": 82, "fan_favorite": 72, "media_personality": 52, "loyalty": 78},
    "OG Anunoby": {"leadership": 62, "competitiveness": 78, "work_ethic": 85, "clutch": 68, "ego": 35, "coachability": 88, "temperament": 88, "fan_favorite": 78, "media_personality": 42, "loyalty": 68},
    "Desmond Bane": {"leadership": 72, "competitiveness": 82, "work_ethic": 88, "clutch": 78, "ego": 42, "coachability": 88, "temperament": 82, "fan_favorite": 78, "media_personality": 72, "loyalty": 78},
    "Jonathan Isaac": {"leadership": 55, "competitiveness": 72, "work_ethic": 78, "clutch": 55, "ego": 55, "coachability": 72, "temperament": 72, "fan_favorite": 55, "media_personality": 55, "loyalty": 72},
    "Bradley Beal": {"leadership": 65, "competitiveness": 72, "work_ethic": 72, "clutch": 72, "ego": 72, "coachability": 65, "temperament": 65, "fan_favorite": 62, "media_personality": 65, "loyalty": 55},
    "Andrew Wiggins": {"leadership": 52, "competitiveness": 62, "work_ethic": 62, "clutch": 62, "ego": 55, "coachability": 68, "temperament": 78, "fan_favorite": 62, "media_personality": 42, "loyalty": 62},
    "Tobias Harris": {"leadership": 62, "competitiveness": 68, "work_ethic": 72, "clutch": 55, "ego": 55, "coachability": 78, "temperament": 78, "fan_favorite": 55, "media_personality": 55, "loyalty": 62},
    "Jarrett Allen": {"leadership": 68, "competitiveness": 78, "work_ethic": 85, "clutch": 62, "ego": 30, "coachability": 90, "temperament": 92, "fan_favorite": 78, "media_personality": 55, "loyalty": 82},
    "Jalen Suggs": {"leadership": 68, "competitiveness": 82, "work_ethic": 85, "clutch": 72, "ego": 52, "coachability": 82, "temperament": 72, "fan_favorite": 72, "media_personality": 62, "loyalty": 78},
    "Myles Turner": {"leadership": 62, "competitiveness": 72, "work_ethic": 78, "clutch": 62, "ego": 55, "coachability": 78, "temperament": 78, "fan_favorite": 65, "media_personality": 62, "loyalty": 72},
    "Jaren Jackson Jr.": {"leadership": 72, "competitiveness": 82, "work_ethic": 82, "clutch": 72, "ego": 48, "coachability": 82, "temperament": 68, "fan_favorite": 78, "media_personality": 72, "loyalty": 82},
    "Ivica Zubac": {"leadership": 62, "competitiveness": 75, "work_ethic": 82, "clutch": 58, "ego": 30, "coachability": 88, "temperament": 88, "fan_favorite": 68, "media_personality": 52, "loyalty": 78},
    "Bogdan Bogdanović": {"leadership": 62, "competitiveness": 78, "work_ethic": 78, "clutch": 78, "ego": 50, "coachability": 78, "temperament": 72, "fan_favorite": 72, "media_personality": 62, "loyalty": 62},
    "Grayson Allen": {"leadership": 55, "competitiveness": 78, "work_ethic": 78, "clutch": 72, "ego": 55, "coachability": 78, "temperament": 48, "fan_favorite": 55, "media_personality": 55, "loyalty": 72},
    "Malik Monk": {"leadership": 55, "competitiveness": 72, "work_ethic": 72, "clutch": 78, "ego": 50, "coachability": 72, "temperament": 68, "fan_favorite": 72, "media_personality": 62, "loyalty": 62},
    "Brandon Miller": {"leadership": 68, "competitiveness": 78, "work_ethic": 82, "clutch": 72, "ego": 48, "coachability": 82, "temperament": 78, "fan_favorite": 75, "media_personality": 62, "loyalty": 78},
    "Scoot Henderson": {"leadership": 62, "competitiveness": 78, "work_ethic": 78, "clutch": 65, "ego": 55, "coachability": 78, "temperament": 68, "fan_favorite": 65, "media_personality": 62, "loyalty": 78},
    "Cam Whitmore": {"leadership": 55, "competitiveness": 78, "work_ethic": 78, "clutch": 68, "ego": 48, "coachability": 82, "temperament": 75, "fan_favorite": 68, "media_personality": 55, "loyalty": 78},
    "Dylan Harper": {"leadership": 65, "competitiveness": 78, "work_ethic": 78, "clutch": 72, "ego": 52, "coachability": 82, "temperament": 75, "fan_favorite": 72, "media_personality": 62, "loyalty": 78},
    "Ace Bailey": {"leadership": 62, "competitiveness": 78, "work_ethic": 78, "clutch": 72, "ego": 55, "coachability": 80, "temperament": 78, "fan_favorite": 72, "media_personality": 62, "loyalty": 78},
    "Jalen Green": {"leadership": 55, "competitiveness": 72, "work_ethic": 68, "clutch": 68, "ego": 72, "coachability": 68, "temperament": 68, "fan_favorite": 68, "media_personality": 68, "loyalty": 65},
    "Fred VanVleet": {"leadership": 82, "competitiveness": 85, "work_ethic": 88, "clutch": 78, "ego": 62, "coachability": 78, "temperament": 68, "fan_favorite": 75, "media_personality": 72, "loyalty": 68},
    "Shaedon Sharpe": {"leadership": 52, "competitiveness": 72, "work_ethic": 72, "clutch": 65, "ego": 58, "coachability": 72, "temperament": 72, "fan_favorite": 68, "media_personality": 52, "loyalty": 72},
}

# ── DURABILITY OVERRIDES ─────────────────────────────────────────────

DURABILITY_OVERRIDES = {
    # Injury-prone
    "Kawhi Leonard": {"overall_durability": 40, "knee_health": 30, "soft_tissue_risk": 35, "ankle_health": 45},
    "Joel Embiid": {"overall_durability": 45, "knee_health": 40, "foot_health": 38, "ankle_health": 45, "back_health": 50},
    "Zion Williamson": {"overall_durability": 42, "foot_health": 32, "soft_tissue_risk": 35, "knee_health": 40, "ankle_health": 40},
    "Anthony Davis": {"overall_durability": 52, "back_health": 48, "foot_health": 50, "knee_health": 55, "soft_tissue_risk": 50},
    "Ja Morant": {"overall_durability": 52, "shoulder_health": 42, "knee_health": 52, "ankle_health": 52},
    "Jonathan Isaac": {"overall_durability": 28, "knee_health": 22, "soft_tissue_risk": 25, "ankle_health": 30},
    "Robert Williams III": {"overall_durability": 42, "knee_health": 35, "soft_tissue_risk": 38},
    "Kristaps Porziņģis": {"overall_durability": 48, "knee_health": 40, "ankle_health": 45, "foot_health": 45, "soft_tissue_risk": 42},
    "Ben Simmons": {"overall_durability": 40, "back_health": 30, "knee_health": 42, "soft_tissue_risk": 38},
    "Chet Holmgren": {"overall_durability": 55, "foot_health": 48, "ankle_health": 50, "soft_tissue_risk": 50},
    "Mitchell Robinson": {"overall_durability": 42, "foot_health": 35, "ankle_health": 40, "knee_health": 42},
    "Jarred Vanderbilt": {"overall_durability": 48, "foot_health": 42, "soft_tissue_risk": 42},
    "De'Anthony Melton": {"overall_durability": 45, "knee_health": 38, "back_health": 42},
    "Khris Middleton": {"overall_durability": 50, "knee_health": 42, "ankle_health": 48},
    "Bradley Beal": {"overall_durability": 50, "back_health": 45, "soft_tissue_risk": 48, "ankle_health": 48},
    "E.J. Liddell": {"overall_durability": 42, "knee_health": 35, "soft_tissue_risk": 38},
    "LaMelo Ball": {"overall_durability": 52, "ankle_health": 42, "foot_health": 48, "shoulder_health": 50},
    "Brandon Clarke": {"overall_durability": 48, "knee_health": 40, "soft_tissue_risk": 42},
    "Saddiq Bey": {"overall_durability": 42, "knee_health": 32, "soft_tissue_risk": 38},
    "Taylor Hendricks": {"overall_durability": 45, "ankle_health": 38, "knee_health": 42},
    "DaRon Holmes II": {"overall_durability": 48, "ankle_health": 40, "soft_tissue_risk": 42},
    "Wendell Carter Jr.": {"overall_durability": 50, "knee_health": 45, "ankle_health": 48},
    "Luka Dončić": {"overall_durability": 60, "ankle_health": 55, "knee_health": 58, "soft_tissue_risk": 55},
    "James Harden": {"overall_durability": 58, "soft_tissue_risk": 52, "foot_health": 55},
    "Kyrie Irving": {"overall_durability": 55, "knee_health": 50, "shoulder_health": 52},

    # Ironmen
    "Mikal Bridges": {"overall_durability": 97, "ankle_health": 95, "knee_health": 95, "shoulder_health": 95, "back_health": 95, "foot_health": 95, "soft_tissue_risk": 95},
    "Jrue Holiday": {"overall_durability": 92, "ankle_health": 90, "knee_health": 90, "shoulder_health": 90, "back_health": 90, "foot_health": 90, "soft_tissue_risk": 90},
    "Domantas Sabonis": {"overall_durability": 95, "ankle_health": 92, "knee_health": 92, "back_health": 90, "foot_health": 92, "soft_tissue_risk": 92},
    "Nikola Jokić": {"overall_durability": 92, "ankle_health": 90, "knee_health": 90, "back_health": 88, "foot_health": 90, "soft_tissue_risk": 90},
    "Shai Gilgeous-Alexander": {"overall_durability": 92, "ankle_health": 90, "knee_health": 90, "foot_health": 90, "soft_tissue_risk": 90},
    "Scottie Barnes": {"overall_durability": 90, "ankle_health": 88, "knee_health": 90, "foot_health": 88},
    "Fred VanVleet": {"overall_durability": 88, "ankle_health": 85, "knee_health": 88, "foot_health": 88},
    "Ivica Zubac": {"overall_durability": 90, "ankle_health": 88, "knee_health": 90, "back_health": 88},
    "Tyus Jones": {"overall_durability": 90, "ankle_health": 88, "knee_health": 90, "foot_health": 88},
    "Josh Hart": {"overall_durability": 90, "ankle_health": 88, "knee_health": 88, "foot_health": 88},
    "Dorian Finney-Smith": {"overall_durability": 88, "ankle_health": 86, "knee_health": 88},
    "Jarrett Allen": {"overall_durability": 85, "ankle_health": 82, "knee_health": 85, "foot_health": 85},
    "Pascal Siakam": {"overall_durability": 88, "ankle_health": 86, "knee_health": 88, "foot_health": 86},
    "Giannis Antetokounmpo": {"overall_durability": 78, "ankle_health": 72, "knee_health": 75, "back_health": 78},
    "LeBron James": {"overall_durability": 78, "ankle_health": 75, "knee_health": 72, "foot_health": 75},
    "Stephen Curry": {"overall_durability": 68, "ankle_health": 55, "knee_health": 70, "foot_health": 65},
}

# ── TENDENCY OVERRIDES ───────────────────────────────────────────────

TENDENCY_OVERRIDES = {
    "Rudy Gobert": {
        "pull_up_frequency": 5, "catch_and_shoot_frequency": 5, "drive_frequency": 15,
        "post_up_frequency": 55, "iso_frequency": 5, "pick_and_roll_ball_handler": 5,
        "pick_and_roll_screener": 95, "spot_up_frequency": 5, "transition_frequency": 35,
        "cut_frequency": 60, "pass_out_of_drive_rate": 15, "contested_shot_willingness": 25,
        "help_defense_rate": 90, "box_out_rate": 95, "closeout_aggression": 55,
        "usage_desire": 30,
    },
    "Stephen Curry": {
        "pull_up_frequency": 88, "catch_and_shoot_frequency": 92, "drive_frequency": 55,
        "post_up_frequency": 10, "iso_frequency": 65, "pick_and_roll_ball_handler": 80,
        "pick_and_roll_screener": 10, "spot_up_frequency": 88, "transition_frequency": 70,
        "cut_frequency": 65, "pass_out_of_drive_rate": 55, "contested_shot_willingness": 85,
        "usage_desire": 85, "gamble_for_steals": 55,
    },
    "LeBron James": {
        "pull_up_frequency": 55, "catch_and_shoot_frequency": 45, "drive_frequency": 85,
        "post_up_frequency": 55, "iso_frequency": 80, "pick_and_roll_ball_handler": 65,
        "pick_and_roll_screener": 10, "spot_up_frequency": 35, "transition_frequency": 85,
        "cut_frequency": 35, "pass_out_of_drive_rate": 80, "skip_pass_rate": 72,
        "alley_oop_pass_rate": 45, "contested_shot_willingness": 72, "usage_desire": 88,
    },
    "Nikola Jokić": {
        "pull_up_frequency": 40, "catch_and_shoot_frequency": 30, "drive_frequency": 35,
        "post_up_frequency": 85, "iso_frequency": 45, "pick_and_roll_ball_handler": 68,
        "pick_and_roll_screener": 55, "spot_up_frequency": 35, "transition_frequency": 50,
        "cut_frequency": 25, "pass_out_of_drive_rate": 88, "skip_pass_rate": 78,
        "alley_oop_pass_rate": 55, "contested_shot_willingness": 55, "usage_desire": 82,
        "help_defense_rate": 60, "box_out_rate": 72,
    },
    "Giannis Antetokounmpo": {
        "pull_up_frequency": 35, "catch_and_shoot_frequency": 15, "drive_frequency": 90,
        "post_up_frequency": 55, "iso_frequency": 72, "pick_and_roll_ball_handler": 55,
        "pick_and_roll_screener": 20, "spot_up_frequency": 10, "transition_frequency": 92,
        "cut_frequency": 55, "pass_out_of_drive_rate": 55, "contested_shot_willingness": 82,
        "usage_desire": 90, "help_defense_rate": 78, "box_out_rate": 72,
    },
    "Luka Dončić": {
        "pull_up_frequency": 80, "catch_and_shoot_frequency": 35, "drive_frequency": 72,
        "post_up_frequency": 45, "iso_frequency": 85, "pick_and_roll_ball_handler": 88,
        "pick_and_roll_screener": 5, "spot_up_frequency": 30, "transition_frequency": 62,
        "cut_frequency": 15, "pass_out_of_drive_rate": 78, "skip_pass_rate": 72,
        "contested_shot_willingness": 82, "usage_desire": 92,
    },
    "Shai Gilgeous-Alexander": {
        "pull_up_frequency": 82, "catch_and_shoot_frequency": 30, "drive_frequency": 82,
        "post_up_frequency": 25, "iso_frequency": 82, "pick_and_roll_ball_handler": 78,
        "pick_and_roll_screener": 5, "spot_up_frequency": 20, "transition_frequency": 72,
        "cut_frequency": 25, "pass_out_of_drive_rate": 45, "contested_shot_willingness": 85,
        "usage_desire": 92,
    },
    "Joel Embiid": {
        "pull_up_frequency": 45, "catch_and_shoot_frequency": 25, "drive_frequency": 40,
        "post_up_frequency": 90, "iso_frequency": 72, "pick_and_roll_ball_handler": 15,
        "pick_and_roll_screener": 55, "spot_up_frequency": 20, "transition_frequency": 45,
        "cut_frequency": 20, "pass_out_of_drive_rate": 35, "contested_shot_willingness": 78,
        "usage_desire": 88, "help_defense_rate": 72, "box_out_rate": 75,
    },
    "Kevin Durant": {
        "pull_up_frequency": 82, "catch_and_shoot_frequency": 55, "drive_frequency": 55,
        "post_up_frequency": 55, "iso_frequency": 82, "pick_and_roll_ball_handler": 55,
        "pick_and_roll_screener": 5, "spot_up_frequency": 55, "transition_frequency": 65,
        "cut_frequency": 30, "pass_out_of_drive_rate": 42, "contested_shot_willingness": 88,
        "usage_desire": 88,
    },
    "Jayson Tatum": {
        "pull_up_frequency": 72, "catch_and_shoot_frequency": 55, "drive_frequency": 72,
        "post_up_frequency": 30, "iso_frequency": 72, "pick_and_roll_ball_handler": 55,
        "pick_and_roll_screener": 5, "spot_up_frequency": 55, "transition_frequency": 72,
        "cut_frequency": 35, "pass_out_of_drive_rate": 55, "contested_shot_willingness": 78,
        "usage_desire": 88,
    },
    "Anthony Edwards": {
        "pull_up_frequency": 78, "catch_and_shoot_frequency": 55, "drive_frequency": 82,
        "post_up_frequency": 20, "iso_frequency": 78, "pick_and_roll_ball_handler": 55,
        "pick_and_roll_screener": 5, "spot_up_frequency": 50, "transition_frequency": 85,
        "cut_frequency": 35, "pass_out_of_drive_rate": 35, "contested_shot_willingness": 85,
        "usage_desire": 90,
    },
    "Trae Young": {
        "pull_up_frequency": 85, "catch_and_shoot_frequency": 45, "drive_frequency": 55,
        "post_up_frequency": 5, "iso_frequency": 72, "pick_and_roll_ball_handler": 92,
        "pick_and_roll_screener": 5, "spot_up_frequency": 45, "transition_frequency": 62,
        "cut_frequency": 15, "pass_out_of_drive_rate": 72, "skip_pass_rate": 72,
        "alley_oop_pass_rate": 62, "contested_shot_willingness": 72, "usage_desire": 90,
    },
    "Ja Morant": {
        "pull_up_frequency": 72, "catch_and_shoot_frequency": 25, "drive_frequency": 92,
        "post_up_frequency": 10, "iso_frequency": 72, "pick_and_roll_ball_handler": 78,
        "pick_and_roll_screener": 5, "spot_up_frequency": 20, "transition_frequency": 92,
        "cut_frequency": 35, "pass_out_of_drive_rate": 55, "contested_shot_willingness": 78,
        "usage_desire": 88,
    },
    "Devin Booker": {
        "pull_up_frequency": 82, "catch_and_shoot_frequency": 65, "drive_frequency": 62,
        "post_up_frequency": 25, "iso_frequency": 72, "pick_and_roll_ball_handler": 65,
        "pick_and_roll_screener": 5, "spot_up_frequency": 60, "transition_frequency": 62,
        "cut_frequency": 30, "pass_out_of_drive_rate": 55, "contested_shot_willingness": 82,
        "usage_desire": 88,
    },
    "Donovan Mitchell": {
        "pull_up_frequency": 78, "catch_and_shoot_frequency": 55, "drive_frequency": 72,
        "post_up_frequency": 15, "iso_frequency": 75, "pick_and_roll_ball_handler": 62,
        "pick_and_roll_screener": 5, "spot_up_frequency": 55, "transition_frequency": 72,
        "cut_frequency": 25, "pass_out_of_drive_rate": 42, "contested_shot_willingness": 82,
        "usage_desire": 88,
    },
    "Jimmy Butler III": {
        "pull_up_frequency": 45, "catch_and_shoot_frequency": 25, "drive_frequency": 82,
        "post_up_frequency": 45, "iso_frequency": 72, "pick_and_roll_ball_handler": 55,
        "pick_and_roll_screener": 10, "spot_up_frequency": 20, "transition_frequency": 65,
        "cut_frequency": 40, "pass_out_of_drive_rate": 72, "contested_shot_willingness": 55,
        "usage_desire": 78,
    },
    "Jalen Brunson": {
        "pull_up_frequency": 82, "catch_and_shoot_frequency": 45, "drive_frequency": 62,
        "post_up_frequency": 15, "iso_frequency": 72, "pick_and_roll_ball_handler": 85,
        "pick_and_roll_screener": 5, "spot_up_frequency": 35, "transition_frequency": 55,
        "cut_frequency": 25, "pass_out_of_drive_rate": 55, "contested_shot_willingness": 78,
        "usage_desire": 85,
    },
    "Damian Lillard": {
        "pull_up_frequency": 88, "catch_and_shoot_frequency": 55, "drive_frequency": 55,
        "post_up_frequency": 10, "iso_frequency": 78, "pick_and_roll_ball_handler": 82,
        "pick_and_roll_screener": 5, "spot_up_frequency": 55, "transition_frequency": 62,
        "cut_frequency": 20, "pass_out_of_drive_rate": 52, "contested_shot_willingness": 88,
        "usage_desire": 88,
    },
    "Kyrie Irving": {
        "pull_up_frequency": 82, "catch_and_shoot_frequency": 55, "drive_frequency": 72,
        "post_up_frequency": 25, "iso_frequency": 85, "pick_and_roll_ball_handler": 72,
        "pick_and_roll_screener": 5, "spot_up_frequency": 45, "transition_frequency": 62,
        "cut_frequency": 25, "pass_out_of_drive_rate": 55, "contested_shot_willingness": 85,
        "usage_desire": 85,
    },
    "James Harden": {
        "pull_up_frequency": 72, "catch_and_shoot_frequency": 35, "drive_frequency": 72,
        "post_up_frequency": 20, "iso_frequency": 82, "pick_and_roll_ball_handler": 85,
        "pick_and_roll_screener": 5, "spot_up_frequency": 45, "transition_frequency": 50,
        "cut_frequency": 15, "pass_out_of_drive_rate": 72, "contested_shot_willingness": 72,
        "usage_desire": 82,
    },
    "Draymond Green": {
        "pull_up_frequency": 15, "catch_and_shoot_frequency": 25, "drive_frequency": 35,
        "post_up_frequency": 35, "iso_frequency": 15, "pick_and_roll_ball_handler": 35,
        "pick_and_roll_screener": 82, "spot_up_frequency": 25, "transition_frequency": 60,
        "cut_frequency": 40, "pass_out_of_drive_rate": 82, "skip_pass_rate": 72,
        "alley_oop_pass_rate": 45, "contested_shot_willingness": 25, "usage_desire": 35,
        "help_defense_rate": 92, "closeout_aggression": 72,
    },
    "Duncan Robinson": {
        "pull_up_frequency": 35, "catch_and_shoot_frequency": 95, "drive_frequency": 15,
        "post_up_frequency": 5, "iso_frequency": 10, "pick_and_roll_ball_handler": 10,
        "pick_and_roll_screener": 25, "spot_up_frequency": 95, "transition_frequency": 45,
        "cut_frequency": 45, "pass_out_of_drive_rate": 25, "contested_shot_willingness": 55,
        "usage_desire": 55,
    },
    "Buddy Hield": {
        "pull_up_frequency": 45, "catch_and_shoot_frequency": 90, "drive_frequency": 25,
        "post_up_frequency": 5, "iso_frequency": 20, "pick_and_roll_ball_handler": 15,
        "pick_and_roll_screener": 15, "spot_up_frequency": 92, "transition_frequency": 55,
        "cut_frequency": 40, "pass_out_of_drive_rate": 25, "contested_shot_willingness": 65,
        "usage_desire": 65,
    },
    "Brook Lopez": {
        "pull_up_frequency": 15, "catch_and_shoot_frequency": 55, "drive_frequency": 15,
        "post_up_frequency": 45, "iso_frequency": 15, "pick_and_roll_ball_handler": 5,
        "pick_and_roll_screener": 82, "spot_up_frequency": 55, "transition_frequency": 30,
        "cut_frequency": 25, "pass_out_of_drive_rate": 15, "contested_shot_willingness": 55,
        "usage_desire": 42, "help_defense_rate": 85, "box_out_rate": 82,
    },
    "Victor Wembanyama": {
        "pull_up_frequency": 55, "catch_and_shoot_frequency": 45, "drive_frequency": 45,
        "post_up_frequency": 55, "iso_frequency": 55, "pick_and_roll_ball_handler": 25,
        "pick_and_roll_screener": 60, "spot_up_frequency": 45, "transition_frequency": 65,
        "cut_frequency": 35, "pass_out_of_drive_rate": 55, "contested_shot_willingness": 68,
        "usage_desire": 78, "help_defense_rate": 88, "box_out_rate": 75,
    },
    "Bam Adebayo": {
        "pull_up_frequency": 30, "catch_and_shoot_frequency": 15, "drive_frequency": 55,
        "post_up_frequency": 55, "iso_frequency": 35, "pick_and_roll_ball_handler": 25,
        "pick_and_roll_screener": 82, "spot_up_frequency": 15, "transition_frequency": 65,
        "cut_frequency": 50, "pass_out_of_drive_rate": 62, "contested_shot_willingness": 52,
        "usage_desire": 62, "help_defense_rate": 88, "box_out_rate": 85,
    },
    "Anthony Davis": {
        "pull_up_frequency": 40, "catch_and_shoot_frequency": 25, "drive_frequency": 52,
        "post_up_frequency": 65, "iso_frequency": 55, "pick_and_roll_ball_handler": 15,
        "pick_and_roll_screener": 65, "spot_up_frequency": 25, "transition_frequency": 65,
        "cut_frequency": 35, "pass_out_of_drive_rate": 35, "contested_shot_willingness": 72,
        "usage_desire": 82, "help_defense_rate": 88, "box_out_rate": 78,
    },
    "Karl-Anthony Towns": {
        "pull_up_frequency": 55, "catch_and_shoot_frequency": 55, "drive_frequency": 35,
        "post_up_frequency": 55, "iso_frequency": 45, "pick_and_roll_ball_handler": 15,
        "pick_and_roll_screener": 55, "spot_up_frequency": 55, "transition_frequency": 55,
        "cut_frequency": 30, "pass_out_of_drive_rate": 35, "contested_shot_willingness": 72,
        "usage_desire": 78,
    },
    "De'Aaron Fox": {
        "pull_up_frequency": 72, "catch_and_shoot_frequency": 30, "drive_frequency": 88,
        "post_up_frequency": 10, "iso_frequency": 68, "pick_and_roll_ball_handler": 82,
        "pick_and_roll_screener": 5, "spot_up_frequency": 25, "transition_frequency": 92,
        "cut_frequency": 25, "pass_out_of_drive_rate": 55, "contested_shot_willingness": 72,
        "usage_desire": 85,
    },
    "Tyrese Maxey": {
        "pull_up_frequency": 78, "catch_and_shoot_frequency": 62, "drive_frequency": 72,
        "post_up_frequency": 5, "iso_frequency": 55, "pick_and_roll_ball_handler": 72,
        "pick_and_roll_screener": 5, "spot_up_frequency": 55, "transition_frequency": 82,
        "cut_frequency": 40, "pass_out_of_drive_rate": 42, "contested_shot_willingness": 72,
        "usage_desire": 82,
    },
    "Domantas Sabonis": {
        "pull_up_frequency": 25, "catch_and_shoot_frequency": 15, "drive_frequency": 35,
        "post_up_frequency": 72, "iso_frequency": 25, "pick_and_roll_ball_handler": 20,
        "pick_and_roll_screener": 78, "spot_up_frequency": 15, "transition_frequency": 55,
        "cut_frequency": 40, "pass_out_of_drive_rate": 72, "skip_pass_rate": 55,
        "contested_shot_willingness": 45, "usage_desire": 65, "box_out_rate": 88,
    },
    "Evan Mobley": {
        "pull_up_frequency": 40, "catch_and_shoot_frequency": 35, "drive_frequency": 45,
        "post_up_frequency": 45, "iso_frequency": 35, "pick_and_roll_ball_handler": 20,
        "pick_and_roll_screener": 65, "spot_up_frequency": 35, "transition_frequency": 60,
        "cut_frequency": 40, "pass_out_of_drive_rate": 52, "contested_shot_willingness": 55,
        "usage_desire": 62, "help_defense_rate": 85, "box_out_rate": 72,
    },
    "Paolo Banchero": {
        "pull_up_frequency": 62, "catch_and_shoot_frequency": 35, "drive_frequency": 72,
        "post_up_frequency": 40, "iso_frequency": 72, "pick_and_roll_ball_handler": 55,
        "pick_and_roll_screener": 10, "spot_up_frequency": 30, "transition_frequency": 62,
        "cut_frequency": 25, "pass_out_of_drive_rate": 45, "contested_shot_willingness": 78,
        "usage_desire": 85,
    },
    "Franz Wagner": {
        "pull_up_frequency": 62, "catch_and_shoot_frequency": 45, "drive_frequency": 72,
        "post_up_frequency": 25, "iso_frequency": 55, "pick_and_roll_ball_handler": 55,
        "pick_and_roll_screener": 10, "spot_up_frequency": 45, "transition_frequency": 62,
        "cut_frequency": 35, "pass_out_of_drive_rate": 55, "contested_shot_willingness": 72,
        "usage_desire": 82,
    },
    "Cade Cunningham": {
        "pull_up_frequency": 72, "catch_and_shoot_frequency": 42, "drive_frequency": 62,
        "post_up_frequency": 15, "iso_frequency": 65, "pick_and_roll_ball_handler": 78,
        "pick_and_roll_screener": 5, "spot_up_frequency": 35, "transition_frequency": 60,
        "cut_frequency": 20, "pass_out_of_drive_rate": 62, "contested_shot_willingness": 72,
        "usage_desire": 82,
    },
    "Russell Westbrook": {
        "pull_up_frequency": 72, "catch_and_shoot_frequency": 15, "drive_frequency": 88,
        "post_up_frequency": 15, "iso_frequency": 72, "pick_and_roll_ball_handler": 72,
        "pick_and_roll_screener": 5, "spot_up_frequency": 10, "transition_frequency": 92,
        "cut_frequency": 35, "pass_out_of_drive_rate": 45, "contested_shot_willingness": 82,
        "usage_desire": 85,
    },
    "DeMar DeRozan": {
        "pull_up_frequency": 78, "catch_and_shoot_frequency": 25, "drive_frequency": 62,
        "post_up_frequency": 45, "iso_frequency": 78, "pick_and_roll_ball_handler": 55,
        "pick_and_roll_screener": 5, "spot_up_frequency": 15, "transition_frequency": 55,
        "cut_frequency": 25, "pass_out_of_drive_rate": 55, "contested_shot_willingness": 82,
        "usage_desire": 78,
    },
    "Zion Williamson": {
        "pull_up_frequency": 25, "catch_and_shoot_frequency": 10, "drive_frequency": 92,
        "post_up_frequency": 55, "iso_frequency": 55, "pick_and_roll_ball_handler": 35,
        "pick_and_roll_screener": 20, "spot_up_frequency": 10, "transition_frequency": 82,
        "cut_frequency": 55, "pass_out_of_drive_rate": 42, "contested_shot_willingness": 72,
        "usage_desire": 82,
    },
    "Jaylen Brown": {
        "pull_up_frequency": 62, "catch_and_shoot_frequency": 55, "drive_frequency": 78,
        "post_up_frequency": 20, "iso_frequency": 62, "pick_and_roll_ball_handler": 35,
        "pick_and_roll_screener": 10, "spot_up_frequency": 55, "transition_frequency": 78,
        "cut_frequency": 45, "pass_out_of_drive_rate": 35, "contested_shot_willingness": 78,
        "usage_desire": 82,
    },
    "Scottie Barnes": {
        "pull_up_frequency": 45, "catch_and_shoot_frequency": 30, "drive_frequency": 68,
        "post_up_frequency": 35, "iso_frequency": 45, "pick_and_roll_ball_handler": 55,
        "pick_and_roll_screener": 20, "spot_up_frequency": 25, "transition_frequency": 72,
        "cut_frequency": 45, "pass_out_of_drive_rate": 65, "contested_shot_willingness": 55,
        "usage_desire": 72,
    },
    "Chet Holmgren": {
        "pull_up_frequency": 42, "catch_and_shoot_frequency": 55, "drive_frequency": 35,
        "post_up_frequency": 40, "iso_frequency": 35, "pick_and_roll_ball_handler": 15,
        "pick_and_roll_screener": 65, "spot_up_frequency": 55, "transition_frequency": 60,
        "cut_frequency": 40, "pass_out_of_drive_rate": 45, "contested_shot_willingness": 55,
        "usage_desire": 65, "help_defense_rate": 85,
    },
    "Tyrese Haliburton": {
        "pull_up_frequency": 55, "catch_and_shoot_frequency": 65, "drive_frequency": 42,
        "post_up_frequency": 5, "iso_frequency": 35, "pick_and_roll_ball_handler": 82,
        "pick_and_roll_screener": 5, "spot_up_frequency": 62, "transition_frequency": 72,
        "cut_frequency": 25, "pass_out_of_drive_rate": 78, "skip_pass_rate": 72,
        "alley_oop_pass_rate": 55, "contested_shot_willingness": 55, "usage_desire": 75,
    },
    "Jrue Holiday": {
        "pull_up_frequency": 55, "catch_and_shoot_frequency": 62, "drive_frequency": 55,
        "post_up_frequency": 15, "iso_frequency": 35, "pick_and_roll_ball_handler": 55,
        "pick_and_roll_screener": 10, "spot_up_frequency": 55, "transition_frequency": 62,
        "cut_frequency": 40, "pass_out_of_drive_rate": 55, "contested_shot_willingness": 62,
        "usage_desire": 55, "gamble_for_steals": 72, "help_defense_rate": 82,
    },
    "Ben Simmons": {
        "pull_up_frequency": 10, "catch_and_shoot_frequency": 5, "drive_frequency": 78,
        "post_up_frequency": 35, "iso_frequency": 25, "pick_and_roll_ball_handler": 55,
        "pick_and_roll_screener": 25, "spot_up_frequency": 5, "transition_frequency": 82,
        "cut_frequency": 55, "pass_out_of_drive_rate": 72, "skip_pass_rate": 55,
        "alley_oop_pass_rate": 45, "contested_shot_willingness": 15, "usage_desire": 52,
    },
    "Myles Turner": {
        "pull_up_frequency": 20, "catch_and_shoot_frequency": 45, "drive_frequency": 20,
        "post_up_frequency": 35, "iso_frequency": 15, "pick_and_roll_ball_handler": 5,
        "pick_and_roll_screener": 78, "spot_up_frequency": 45, "transition_frequency": 42,
        "cut_frequency": 35, "pass_out_of_drive_rate": 20, "contested_shot_willingness": 55,
        "usage_desire": 45, "help_defense_rate": 82, "box_out_rate": 72,
    },
    "Jaren Jackson Jr.": {
        "pull_up_frequency": 35, "catch_and_shoot_frequency": 45, "drive_frequency": 35,
        "post_up_frequency": 40, "iso_frequency": 30, "pick_and_roll_ball_handler": 10,
        "pick_and_roll_screener": 62, "spot_up_frequency": 45, "transition_frequency": 55,
        "cut_frequency": 35, "pass_out_of_drive_rate": 25, "contested_shot_willingness": 62,
        "usage_desire": 62, "help_defense_rate": 82,
    },
    "Austin Reaves": {
        "pull_up_frequency": 65, "catch_and_shoot_frequency": 62, "drive_frequency": 62,
        "post_up_frequency": 10, "iso_frequency": 55, "pick_and_roll_ball_handler": 65,
        "pick_and_roll_screener": 5, "spot_up_frequency": 55, "transition_frequency": 62,
        "cut_frequency": 40, "pass_out_of_drive_rate": 62, "contested_shot_willingness": 72,
        "usage_desire": 72,
    },
    "Jamal Murray": {
        "pull_up_frequency": 78, "catch_and_shoot_frequency": 55, "drive_frequency": 55,
        "post_up_frequency": 10, "iso_frequency": 62, "pick_and_roll_ball_handler": 78,
        "pick_and_roll_screener": 5, "spot_up_frequency": 52, "transition_frequency": 55,
        "cut_frequency": 25, "pass_out_of_drive_rate": 55, "contested_shot_willingness": 78,
        "usage_desire": 78,
    },
    "Walker Kessler": {
        "pull_up_frequency": 5, "catch_and_shoot_frequency": 5, "drive_frequency": 10,
        "post_up_frequency": 45, "iso_frequency": 5, "pick_and_roll_ball_handler": 5,
        "pick_and_roll_screener": 92, "spot_up_frequency": 5, "transition_frequency": 35,
        "cut_frequency": 55, "pass_out_of_drive_rate": 15, "contested_shot_willingness": 25,
        "usage_desire": 25, "help_defense_rate": 85, "box_out_rate": 88,
    },
    "Payton Pritchard": {
        "pull_up_frequency": 82, "catch_and_shoot_frequency": 88, "drive_frequency": 35,
        "post_up_frequency": 5, "iso_frequency": 45, "pick_and_roll_ball_handler": 55,
        "pick_and_roll_screener": 5, "spot_up_frequency": 85, "transition_frequency": 65,
        "cut_frequency": 35, "pass_out_of_drive_rate": 42, "contested_shot_willingness": 82,
        "usage_desire": 72,
    },
    "Norman Powell": {
        "pull_up_frequency": 62, "catch_and_shoot_frequency": 62, "drive_frequency": 72,
        "post_up_frequency": 10, "iso_frequency": 55, "pick_and_roll_ball_handler": 35,
        "pick_and_roll_screener": 5, "spot_up_frequency": 55, "transition_frequency": 65,
        "cut_frequency": 45, "pass_out_of_drive_rate": 30, "contested_shot_willingness": 72,
        "usage_desire": 72,
    },
    "Klay Thompson": {
        "pull_up_frequency": 55, "catch_and_shoot_frequency": 88, "drive_frequency": 25,
        "post_up_frequency": 15, "iso_frequency": 30, "pick_and_roll_ball_handler": 20,
        "pick_and_roll_screener": 10, "spot_up_frequency": 88, "transition_frequency": 55,
        "cut_frequency": 55, "pass_out_of_drive_rate": 25, "contested_shot_willingness": 78,
        "usage_desire": 68,
    },
    "LaMelo Ball": {
        "pull_up_frequency": 82, "catch_and_shoot_frequency": 45, "drive_frequency": 55,
        "post_up_frequency": 5, "iso_frequency": 62, "pick_and_roll_ball_handler": 78,
        "pick_and_roll_screener": 5, "spot_up_frequency": 45, "transition_frequency": 72,
        "cut_frequency": 20, "pass_out_of_drive_rate": 72, "skip_pass_rate": 68,
        "alley_oop_pass_rate": 55, "contested_shot_willingness": 72, "usage_desire": 82,
    },
    "Chris Paul": {
        "pull_up_frequency": 55, "catch_and_shoot_frequency": 42, "drive_frequency": 35,
        "post_up_frequency": 10, "iso_frequency": 35, "pick_and_roll_ball_handler": 88,
        "pick_and_roll_screener": 5, "spot_up_frequency": 42, "transition_frequency": 45,
        "cut_frequency": 15, "pass_out_of_drive_rate": 82, "skip_pass_rate": 72,
        "alley_oop_pass_rate": 62, "contested_shot_willingness": 45, "usage_desire": 62,
    },
    "Kawhi Leonard": {
        "pull_up_frequency": 72, "catch_and_shoot_frequency": 45, "drive_frequency": 62,
        "post_up_frequency": 40, "iso_frequency": 82, "pick_and_roll_ball_handler": 35,
        "pick_and_roll_screener": 5, "spot_up_frequency": 45, "transition_frequency": 55,
        "cut_frequency": 25, "pass_out_of_drive_rate": 35, "contested_shot_willingness": 82,
        "usage_desire": 78,
    },
    "Derrick White": {
        "pull_up_frequency": 55, "catch_and_shoot_frequency": 65, "drive_frequency": 55,
        "post_up_frequency": 10, "iso_frequency": 30, "pick_and_roll_ball_handler": 45,
        "pick_and_roll_screener": 10, "spot_up_frequency": 62, "transition_frequency": 62,
        "cut_frequency": 45, "pass_out_of_drive_rate": 52, "contested_shot_willingness": 62,
        "usage_desire": 55, "gamble_for_steals": 55, "help_defense_rate": 78,
    },
    "Alex Caruso": {
        "pull_up_frequency": 25, "catch_and_shoot_frequency": 55, "drive_frequency": 35,
        "post_up_frequency": 5, "iso_frequency": 10, "pick_and_roll_ball_handler": 25,
        "pick_and_roll_screener": 15, "spot_up_frequency": 55, "transition_frequency": 62,
        "cut_frequency": 55, "pass_out_of_drive_rate": 45, "contested_shot_willingness": 42,
        "usage_desire": 30, "gamble_for_steals": 78, "help_defense_rate": 82,
        "closeout_aggression": 78,
    },
    "Cooper Flagg": {
        "pull_up_frequency": 55, "catch_and_shoot_frequency": 40, "drive_frequency": 72,
        "post_up_frequency": 25, "iso_frequency": 55, "pick_and_roll_ball_handler": 35,
        "pick_and_roll_screener": 20, "spot_up_frequency": 35, "transition_frequency": 72,
        "cut_frequency": 45, "pass_out_of_drive_rate": 55, "contested_shot_willingness": 68,
        "usage_desire": 72, "help_defense_rate": 75,
    },
    "Alperen Sengun": {
        "pull_up_frequency": 30, "catch_and_shoot_frequency": 15, "drive_frequency": 35,
        "post_up_frequency": 78, "iso_frequency": 35, "pick_and_roll_ball_handler": 25,
        "pick_and_roll_screener": 65, "spot_up_frequency": 15, "transition_frequency": 45,
        "cut_frequency": 35, "pass_out_of_drive_rate": 72, "skip_pass_rate": 55,
        "contested_shot_willingness": 55, "usage_desire": 65, "box_out_rate": 72,
    },
    "Jalen Williams": {
        "pull_up_frequency": 62, "catch_and_shoot_frequency": 52, "drive_frequency": 72,
        "post_up_frequency": 15, "iso_frequency": 55, "pick_and_roll_ball_handler": 55,
        "pick_and_roll_screener": 10, "spot_up_frequency": 45, "transition_frequency": 68,
        "cut_frequency": 40, "pass_out_of_drive_rate": 55, "contested_shot_willingness": 68,
        "usage_desire": 72,
    },
    "Darius Garland": {
        "pull_up_frequency": 78, "catch_and_shoot_frequency": 55, "drive_frequency": 52,
        "post_up_frequency": 5, "iso_frequency": 55, "pick_and_roll_ball_handler": 82,
        "pick_and_roll_screener": 5, "spot_up_frequency": 52, "transition_frequency": 55,
        "cut_frequency": 20, "pass_out_of_drive_rate": 68, "contested_shot_willingness": 68,
        "usage_desire": 78,
    },
}


# ═══════════════════════════════════════════════════════════════════════
# RATING FORMULAS
# ═══════════════════════════════════════════════════════════════════════

def compute_free_throw_rating(ft_pct: float, fta: float) -> int:
    """FT rating based primarily on FT%, with slight volume consideration."""
    if fta < 0.5:
        # Very few FTA — not enough sample, regress toward average
        return 62
    if fta < 1.0:
        # Low volume — dampen toward 65
        if ft_pct >= 90:
            raw = 85
        elif ft_pct >= 80:
            raw = 75
        elif ft_pct >= 70:
            raw = 68
        elif ft_pct >= 60:
            raw = 60
        elif ft_pct >= 50:
            raw = 50
        else:
            raw = 40
        return clamp(raw, 25, 99)

    # 2+ FTA: confident sample
    if ft_pct >= 92:
        raw = 95 + (ft_pct - 92) * 0.5
    elif ft_pct >= 90:
        raw = 92 + (ft_pct - 90) * 1.5
    elif ft_pct >= 85:
        raw = 85 + (ft_pct - 85) * 1.4
    elif ft_pct >= 80:
        raw = 80 + (ft_pct - 80) * 1.0
    elif ft_pct >= 75:
        raw = 72 + (ft_pct - 75) * 1.6
    elif ft_pct >= 70:
        raw = 68 + (ft_pct - 70) * 0.8
    elif ft_pct >= 65:
        raw = 60 + (ft_pct - 65) * 1.6
    elif ft_pct >= 60:
        raw = 55 + (ft_pct - 60) * 1.0
    elif ft_pct >= 55:
        raw = 48 + (ft_pct - 55) * 1.4
    elif ft_pct >= 50:
        raw = 40 + (ft_pct - 50) * 1.6
    elif ft_pct >= 45:
        raw = 32 + (ft_pct - 45) * 1.6
    else:
        raw = 25 + max(0, ft_pct - 30) * 0.47

    return clamp(raw, 25, 99)


def compute_three_point_rating(three_pct: float, three_pa: float) -> int:
    """3PT rating based on 3P% as primary, 3PA as secondary."""
    if three_pa < 0.1:
        # Essentially never shoots threes
        return clamp(25 + three_pct * 0.2, 25, 35)

    if three_pa < 1.0:
        # Rare three-point shooter — cap at 60 regardless of %
        if three_pct >= 40:
            raw = 55
        elif three_pct >= 35:
            raw = 48
        elif three_pct >= 30:
            raw = 42
        elif three_pct >= 25:
            raw = 35
        else:
            raw = 28
        return clamp(raw, 25, 60)

    # 1+ 3PA: Use percentage as primary driver
    if three_pct >= 42 and three_pa >= 5:
        raw = 95 + (three_pct - 42) * 0.5
    elif three_pct >= 40:
        raw = 90 + (three_pct - 40) * 2.5
        if three_pa >= 7:
            raw += 2
        elif three_pa < 3:
            raw -= 3
    elif three_pct >= 38:
        raw = 85 + (three_pct - 38) * 2.5
        if three_pa >= 6:
            raw += 2
        elif three_pa < 2:
            raw -= 3
    elif three_pct >= 37:
        raw = 82 + (three_pct - 37) * 3.0
        if three_pa >= 5:
            raw += 1
    elif three_pct >= 36:
        raw = 78 + (three_pct - 36) * 4.0
    elif three_pct >= 35:
        raw = 75 + (three_pct - 35) * 3.0
    elif three_pct >= 34:
        raw = 72 + (three_pct - 34) * 3.0
    elif three_pct >= 33:
        raw = 68 + (three_pct - 33) * 4.0
    elif three_pct >= 31:
        raw = 62 + (three_pct - 31) * 3.0
    elif three_pct >= 30:
        raw = 58 + (three_pct - 30) * 4.0
    elif three_pct >= 28:
        raw = 50 + (three_pct - 28) * 4.0
    elif three_pct >= 27:
        raw = 45 + (three_pct - 27) * 5.0
    elif three_pct >= 25:
        raw = 38 + (three_pct - 25) * 3.5
    elif three_pct >= 20:
        raw = 30 + (three_pct - 20) * 1.6
    else:
        raw = 25 + max(0, three_pct) * 0.25

    # Volume bonus/penalty on top
    if three_pa >= 8:
        raw += 2
    elif three_pa >= 6:
        raw += 1
    elif three_pa < 2 and three_pct < 38:
        raw -= 2

    return clamp(raw, 25, 99)


def compute_ball_handling(apg: float, ppg: float, topg: float, position: str, all_stats: list[dict]) -> int:
    """Ball handling based on primary handler indicators."""
    # Assist-to-turnover and usage as handler
    ast_to = apg / max(topg, 0.3)

    # Position baseline: PGs handle more, Centers handle least
    pos_base = {"PG": 65, "SG": 52, "SF": 45, "PF": 40, "C": 35}.get(position, 45)

    # APG contribution (scaled by position expectation)
    apg_bonus = min(25, apg * 3.0)

    # Penalty for high turnover rate (indicates loose handles)
    if topg > 0 and apg > 0:
        to_penalty = max(0, (topg / max(apg, 1) - 0.5) * 8)
    else:
        to_penalty = 0

    raw = pos_base + apg_bonus - to_penalty

    return clamp(raw, 30, 97)


def compute_perimeter_defense(spg: float, mpg: float, position: str, years: int) -> int:
    """Perimeter defense based on steals, position, and experience."""
    pos_base = {"PG": 50, "SG": 50, "SF": 48, "PF": 42, "C": 35}.get(position, 45)

    # Steals are the best counting stat proxy for perimeter defense
    stl_bonus = min(20, spg * 12)

    # MPG indicates coach trusts you defensively (slight)
    mpg_bonus = min(5, max(0, mpg - 20) * 0.2)

    # Experience bonus (moderate)
    exp_bonus = min(5, years * 0.4)

    raw = pos_base + stl_bonus + mpg_bonus + exp_bonus
    return clamp(raw, 30, 95)


def compute_interior_defense(bpg: float, rpg: float, position: str, mpg: float) -> int:
    """Interior defense based on blocks, rebounds, and position."""
    pos_base = {"PG": 30, "SG": 32, "SF": 38, "PF": 50, "C": 58}.get(position, 40)

    blk_bonus = min(25, bpg * 10)
    reb_bonus = min(8, rpg * 0.6)
    mpg_bonus = min(3, max(0, mpg - 20) * 0.12)

    raw = pos_base + blk_bonus + reb_bonus + mpg_bonus
    return clamp(raw, 30, 97)


def compute_defensive_iq(spg: float, bpg: float, rpg: float, years: int, mpg: float, position: str) -> int:
    """Defensive IQ based on experience, position trust, and counting stats."""
    base = 45

    # Experience is the biggest factor for defensive IQ
    exp_bonus = min(15, years * 1.2)

    # MPG indicates trust
    mpg_bonus = min(8, max(0, mpg - 15) * 0.35)

    # Counting stats as proxy
    stat_bonus = min(10, (spg * 3 + bpg * 3 + rpg * 0.3))

    raw = base + exp_bonus + mpg_bonus + stat_bonus
    return clamp(raw, 40, 95)


def compute_defensive_consistency(gp: int, mpg: float, years: int) -> int:
    """Defensive consistency based on games played and minutes regularity."""
    base = 50

    # Games played factor (82 game season)
    gp_bonus = min(15, (gp / 82) * 18)

    # MPG consistency — higher MPG = more consistent role
    mpg_bonus = min(10, max(0, mpg - 15) * 0.4)

    # Experience
    exp_bonus = min(8, years * 0.6)

    raw = base + gp_bonus + mpg_bonus + exp_bonus
    return clamp(raw, 30, 93)


def compute_finishing(ppg: float, fg_pct: float, fga: float, all_stats: list[dict]) -> int:
    """Finishing/scoring ability."""
    scoring_composite = ppg * (fg_pct / 100) if fg_pct > 0 else 0
    all_scoring = [s.get("ppg", 0) * (s.get("fg_pct", 0) / 100) for s in all_stats]
    pct = percentile_rank(scoring_composite, all_scoring)
    return clamp(55 + pct * 44, 40, 99)


def compute_mid_range(ppg: float, fg_pct: float, three_pct: float, fga: float, three_pa: float) -> int:
    """Mid-range rating from overall FG% minus the 3P influence."""
    # Estimate mid-range by looking at 2PT shooting
    two_pa = max(fga - three_pa, 0.1)
    # Approximate 2PT% (if we had it directly we'd use it)
    # Use FG% as a proxy, slightly penalize pure 3PT shooters
    raw = 50 + fg_pct * 0.5 + min(10, ppg * 0.3)
    if three_pa > fga * 0.6 and fga > 5:
        # Very high 3P share — probably not a midrange player
        raw -= 5
    return clamp(raw, 35, 96)


def compute_passing(apg: float, topg: float, all_apg: list[float]) -> tuple[int, int]:
    """Returns (passing_vision, passing_accuracy)."""
    pct = percentile_rank(apg, all_apg)
    vision = clamp(40 + pct * 58, 30, 98)

    ast_to = apg / max(topg, 0.3)
    # Good passers have high AST/TO
    if ast_to >= 4.0:
        accuracy = 90 + min(5, (ast_to - 4) * 2)
    elif ast_to >= 3.0:
        accuracy = 82 + (ast_to - 3.0) * 8
    elif ast_to >= 2.5:
        accuracy = 75 + (ast_to - 2.5) * 14
    elif ast_to >= 2.0:
        accuracy = 68 + (ast_to - 2.0) * 14
    elif ast_to >= 1.5:
        accuracy = 58 + (ast_to - 1.5) * 20
    elif ast_to >= 1.0:
        accuracy = 48 + (ast_to - 1.0) * 20
    else:
        accuracy = 38 + ast_to * 10

    # Low usage passers — cap accuracy since sample is weird
    if apg < 1.0:
        accuracy = min(accuracy, 70)

    return clamp(vision, 30, 98), clamp(accuracy, 30, 95)


def compute_post_game(rpg: float, ppg: float, fg_pct: float, position: str) -> int:
    """Post game rating."""
    pos_bonus = {"C": 15, "PF": 8, "SF": 0, "SG": -5, "PG": -10}.get(position, 0)
    raw = 40 + rpg * 1.2 + ppg * 0.3 + fg_pct * 0.15 + pos_bonus
    return clamp(raw, 30, 95)


def compute_rebounding(rpg: float, all_rpg: list[float]) -> int:
    """Rebounding rating."""
    pct = percentile_rank(rpg, all_rpg)
    return clamp(40 + pct * 59, 30, 99)


# ═══════════════════════════════════════════════════════════════════════
# SHOT CHART GENERATION (from actual stats)
# ═══════════════════════════════════════════════════════════════════════

def generate_shot_chart(stats: dict, position: str) -> dict:
    """Generate shot chart from actual player stats."""
    if not stats:
        return _default_shot_chart(position)

    fga = stats.get("fga", 5)
    three_pa = stats.get("three_pa", 0)
    three_pct = stats.get("three_pct", 33) / 100
    fg_pct = stats.get("fg_pct", 45) / 100
    ft_pct = stats.get("ft_pct", 75) / 100
    rpg = stats.get("rpg", 4)
    ppg = stats.get("ppg", 8)

    # Calculate actual shot distribution ratios
    if fga > 0:
        three_share = three_pa / fga
    else:
        three_share = 0.3  # default

    # Position-based baseline for paint vs midrange split
    pos_paint_base = {"PG": 0.30, "SG": 0.28, "SF": 0.30, "PF": 0.38, "C": 0.50}.get(position, 0.30)
    pos_mid_base = {"PG": 0.22, "SG": 0.22, "SF": 0.20, "PF": 0.15, "C": 0.10}.get(position, 0.18)

    # Adjust paint/mid based on three-point share
    remaining = 1.0 - three_share
    paint_share = remaining * (pos_paint_base / (pos_paint_base + pos_mid_base))
    mid_share = remaining * (pos_mid_base / (pos_paint_base + pos_mid_base))

    # Sub-distribute paint zone
    if position in ("C", "PF"):
        ra_pct = 0.60  # restricted area dominates
        pnra_pct = 0.25
        post_pct = 0.15
    elif position == "SF":
        ra_pct = 0.55
        pnra_pct = 0.30
        post_pct = 0.15
    else:  # PG, SG
        ra_pct = 0.60
        pnra_pct = 0.30
        post_pct = 0.10

    restricted_area = paint_share * ra_pct
    paint_non_ra = paint_share * pnra_pct
    post_up = paint_share * post_pct

    # Sub-distribute midrange (8 zones, slight variance)
    mid_zones = {
        "midrange_left_baseline": 0.12,
        "midrange_left_wing": 0.14,
        "midrange_center": 0.20,
        "midrange_right_wing": 0.14,
        "midrange_right_baseline": 0.12,
    }
    # Remaining midrange shares can bleed into paint
    mid_total_weight = sum(mid_zones.values())

    # Sub-distribute three-point zones
    three_zones_weight = {
        "three_left_corner": 0.12,
        "three_left_wing": 0.22,
        "three_center": 0.30,
        "three_right_wing": 0.22,
        "three_right_corner": 0.14,
    }
    three_total_weight = sum(three_zones_weight.values())

    tendencies = {
        "restricted_area": max(0.02, restricted_area),
        "paint_non_ra": max(0.01, paint_non_ra),
        "post_up": max(0.005, post_up),
    }

    for zone, weight in mid_zones.items():
        tendencies[zone] = max(0.005, mid_share * (weight / mid_total_weight))

    for zone, weight in three_zones_weight.items():
        tendencies[zone] = max(0.001 if three_share < 0.05 else 0.01, three_share * (weight / three_total_weight))

    tendencies["backcourt"] = 0.005

    # Normalize
    total = sum(tendencies.values())
    if total > 0:
        tendencies = {k: round(v / total, 4) for k, v in tendencies.items()}

    # Generate make rates based on actual shooting percentages
    zones = []
    for zone_id, tendency in tendencies.items():
        if zone_id == "restricted_area":
            make_rate = round(min(0.80, 0.50 + fg_pct * 0.30 + rpg * 0.005), 3)
        elif zone_id == "paint_non_ra":
            make_rate = round(min(0.55, 0.32 + fg_pct * 0.20), 3)
        elif zone_id == "post_up":
            make_rate = round(min(0.55, 0.35 + fg_pct * 0.15), 3)
        elif zone_id.startswith("midrange_"):
            make_rate = round(min(0.55, 0.30 + fg_pct * 0.18), 3)
        elif zone_id.startswith("three_"):
            make_rate = round(min(0.48, max(0.22, three_pct * 0.92 + 0.02)), 3)
        elif zone_id == "backcourt":
            make_rate = 0.02
        else:
            make_rate = round(fg_pct * 0.8, 3)

        zones.append({"zone_id": zone_id, "tendency": round(tendency, 3), "make_rate": make_rate})

    return {"zones": zones}


def _default_shot_chart(position: str) -> dict:
    """Fallback shot chart when no stats available."""
    return generate_shot_chart({
        "fga": 5, "three_pa": 1.5, "three_pct": 33, "fg_pct": 45,
        "ft_pct": 75, "rpg": 4, "ppg": 8
    }, position)


# ═══════════════════════════════════════════════════════════════════════
# TENDENCIES (improved formula)
# ═══════════════════════════════════════════════════════════════════════

def generate_tendencies(stats: dict, position: str) -> dict:
    """Generate tendencies from stats with better position awareness."""
    if not stats:
        stats = {}

    ppg = stats.get("ppg", 8)
    apg = stats.get("apg", 2)
    rpg = stats.get("rpg", 3)
    spg = stats.get("spg", 0.6)
    bpg = stats.get("bpg", 0.3)
    three_pa = stats.get("three_pa", 2)
    fta = stats.get("fta", 1.5)
    fga = stats.get("fga", 6)
    mpg = stats.get("mpg", 18)

    three_share = three_pa / max(fga, 1)

    pm = {
        "PG": {"pnr_bh": 20, "pnr_sc": -20, "post": -25, "drive": 10, "spot": -5, "cut": -8, "iso": 5},
        "SG": {"pnr_bh": 5, "pnr_sc": -12, "post": -18, "drive": 5, "spot": 10, "cut": 0, "iso": 3},
        "SF": {"pnr_bh": -5, "pnr_sc": -5, "post": -5, "drive": 3, "spot": 5, "cut": 5, "iso": 0},
        "PF": {"pnr_bh": -15, "pnr_sc": 15, "post": 12, "drive": -5, "spot": 0, "cut": 5, "iso": -5},
        "C":  {"pnr_bh": -25, "pnr_sc": 25, "post": 25, "drive": -18, "spot": -10, "cut": 5, "iso": -15},
    }.get(position, {"pnr_bh": 0, "pnr_sc": 0, "post": 0, "drive": 0, "spot": 0, "cut": 0, "iso": 0})

    usage = min(95, int(40 + ppg * 1.2 + apg * 0.3))
    iso = max(10, min(90, int(20 + ppg * 0.8 - apg * 0.3 + pm["iso"])))

    return {
        "pull_up_frequency": clamp(30 + ppg * 0.6 + pm["drive"], 5, 95),
        "catch_and_shoot_frequency": clamp(25 + three_pa * 3.0 + three_share * 30 + pm["spot"], 5, 95),
        "drive_frequency": clamp(25 + ppg * 0.5 + pm["drive"], 5, 95),
        "post_up_frequency": clamp(10 + rpg * 1.5 + pm["post"], 5, 95),
        "iso_frequency": clamp(iso, 5, 95),
        "pick_and_roll_ball_handler": clamp(25 + apg * 2.5 + pm["pnr_bh"], 5, 95),
        "pick_and_roll_screener": clamp(20 + rpg * 1.5 + pm["pnr_sc"], 5, 95),
        "spot_up_frequency": clamp(20 + three_pa * 2.5 + three_share * 25 + pm["spot"], 5, 95),
        "transition_frequency": clamp(35 + ppg * 0.4 + spg * 4, 10, 92),
        "cut_frequency": clamp(20 + ppg * 0.2 + pm["cut"], 5, 80),
        "pass_out_of_drive_rate": clamp(20 + apg * 3.5, 10, 88),
        "skip_pass_rate": clamp(18 + apg * 2.5, 5, 80),
        "alley_oop_pass_rate": clamp(10 + apg * 1.8, 5, 65),
        "gamble_for_steals": clamp(20 + spg * 15, 5, 85),
        "help_defense_rate": clamp(35 + rpg * 1.5 + bpg * 5 + spg * 2, 15, 92),
        "closeout_aggression": clamp(30 + spg * 12, 10, 85),
        "box_out_rate": clamp(25 + rpg * 3.5, 10, 92),
        "usage_desire": clamp(usage, 15, 95),
        "pace_preference": clamp(45 + ppg * 0.25 + apg * 0.4, 25, 85),
        "foul_proneness": clamp(30 + fta * 1.2, 10, 80),
        "shot_clock_tendency": clamp(40 + ppg * 0.25, 20, 80),
        "contested_shot_willingness": clamp(25 + ppg * 0.8, 10, 90),
    }


# ═══════════════════════════════════════════════════════════════════════
# CHARACTER (improved formula + overrides)
# ═══════════════════════════════════════════════════════════════════════

def generate_character(stats: dict, years: int, name: str) -> dict:
    """Generate character traits — use overrides if available, otherwise formula."""
    if name in CHARACTER_OVERRIDES:
        return CHARACTER_OVERRIDES[name]

    mpg = stats.get("mpg", 18) if stats else 18
    ppg = stats.get("ppg", 8) if stats else 8
    apg = stats.get("apg", 2) if stats else 2

    # Seed by name for deterministic results
    rng = random.Random(hash(name) & 0xFFFFFFFF)

    return {
        "leadership": clamp(45 + years * 2.5 + apg * 1.2 + rng.randint(-5, 5), 30, 95),
        "work_ethic": clamp(62 + mpg * 0.3 + rng.randint(-8, 8), 35, 95),
        "clutch": clamp(50 + ppg * 0.5 + rng.randint(-8, 8), 30, 95),
        "ego": clamp(35 + ppg * 0.7 + rng.randint(-8, 8), 20, 90),
        "coachability": clamp(68 + rng.randint(-10, 10), 35, 95),
        "temperament": clamp(65 + rng.randint(-10, 10), 30, 95),
        "fan_favorite": clamp(42 + ppg * 0.7 + apg * 0.4 + rng.randint(-8, 8), 20, 95),
        "media_personality": clamp(45 + ppg * 0.4 + rng.randint(-8, 8), 20, 95),
        "loyalty": clamp(58 + rng.randint(-12, 12), 25, 95),
        "competitiveness": clamp(60 + ppg * 0.3 + mpg * 0.15 + rng.randint(-6, 6), 35, 95),
    }


# ═══════════════════════════════════════════════════════════════════════
# DURABILITY (improved formula + overrides)
# ═══════════════════════════════════════════════════════════════════════

def generate_durability(age: int, gp: int, name: str) -> dict:
    """Generate durability — use overrides if available, otherwise formula."""
    rng = random.Random(hash(name + "_dur") & 0xFFFFFFFF)

    gp_factor = min(1.0, gp / 72)
    base = int(68 + gp_factor * 18 + rng.randint(-4, 4))
    age_penalty = max(0, (age - 28) * 2) if age > 28 else 0
    base = max(38, base - age_penalty)

    result = {
        "overall_durability": clamp(base, 38, 95),
        "ankle_health": clamp(base + rng.randint(-6, 6), 38, 99),
        "knee_health": clamp(base + rng.randint(-6, 6), 38, 99),
        "shoulder_health": clamp(base + rng.randint(-4, 4), 42, 99),
        "back_health": clamp(base + rng.randint(-4, 4), 42, 99),
        "wrist_hand_health": clamp(base + rng.randint(-3, 3), 48, 99),
        "foot_health": clamp(base + rng.randint(-4, 4), 42, 99),
        "concussion_risk": clamp(88 - rng.randint(0, 12), 50, 99),
        "soft_tissue_risk": clamp(base + rng.randint(-4, 4), 38, 99),
        "injury_history": [],
    }

    # Apply overrides
    if name in DURABILITY_OVERRIDES:
        for key, val in DURABILITY_OVERRIDES[name].items():
            result[key] = val

    return result


# ═══════════════════════════════════════════════════════════════════════
# MAIN RE-RATING LOGIC
# ═══════════════════════════════════════════════════════════════════════

def rerate_all():
    print(f"Reading {PLAYERS_JSON}...")
    with open(PLAYERS_JSON) as f:
        players = json.load(f)
    print(f"Loaded {len(players)} players")

    # Gather all latest stats for percentile calculations
    all_stats = []
    for p in players:
        if p["career_stats"]:
            all_stats.append(p["career_stats"][-1])

    all_ppg = [s.get("ppg", 0) for s in all_stats]
    all_rpg = [s.get("rpg", 0) for s in all_stats]
    all_apg = [s.get("apg", 0) for s in all_stats]
    all_spg = [s.get("spg", 0) for s in all_stats]
    all_bpg = [s.get("bpg", 0) for s in all_stats]
    all_mpg = [s.get("mpg", 0) for s in all_stats]

    for p in players:
        name = f"{p['bio']['first_name']} {p['bio']['last_name']}"
        position = p["bio"]["position"]
        age = p["bio"]["age"]
        years = p["bio"]["years_in_league"]

        stats = p["career_stats"][-1] if p["career_stats"] else {}
        if not stats:
            continue  # keep defaults for players with no stats

        ppg = stats.get("ppg", 0)
        rpg = stats.get("rpg", 0)
        apg = stats.get("apg", 0)
        spg = stats.get("spg", 0)
        bpg = stats.get("bpg", 0)
        fg_pct = stats.get("fg_pct", 0)
        three_pct = stats.get("three_pct", 0)
        ft_pct = stats.get("ft_pct", 0)
        three_pa = stats.get("three_pa", 0)
        fta = stats.get("fta", 0)
        fga = stats.get("fga", 0)
        mpg = stats.get("mpg", 0)
        gp = stats.get("gp", 0)
        topg = stats.get("topg", 0)

        ratings = p["ratings"]

        # ── Offensive ratings ────────────────────────────────────────
        ratings["finishing"] = compute_finishing(ppg, fg_pct, fga, all_stats)
        ratings["close_range"] = clamp(40 + fg_pct * 0.55 + rpg * 0.5, 35, 97)

        ratings["mid_range"] = compute_mid_range(ppg, fg_pct, three_pct, fga, three_pa)
        ratings["three_point"] = compute_three_point_rating(three_pct, three_pa)
        ratings["free_throw"] = compute_free_throw_rating(ft_pct, fta)

        ratings["post_game"] = compute_post_game(rpg, ppg, fg_pct, position)

        # Draw foul: based on FTA
        all_fta = [s.get("fta", 0) for s in all_stats]
        fta_pct = percentile_rank(fta, all_fta)
        ratings["draw_foul"] = clamp(40 + fta_pct * 55, 30, 95)

        # Off-ball movement
        off_ball_composite = ppg * 0.3 + fg_pct * 0.3 + three_pa * 1.0
        all_off_ball = [s.get("ppg", 0) * 0.3 + s.get("fg_pct", 0) * 0.3 + s.get("three_pa", 0) * 1.0 for s in all_stats]
        off_ball_pct = percentile_rank(off_ball_composite, all_off_ball)
        ratings["off_ball_movement"] = clamp(42 + off_ball_pct * 53, 35, 95)

        # Ball handling
        if name in BALL_HANDLING_OVERRIDES:
            ratings["ball_handling"] = BALL_HANDLING_OVERRIDES[name]
        else:
            ratings["ball_handling"] = compute_ball_handling(apg, ppg, topg, position, all_stats)

        # Passing
        ratings["passing_vision"], ratings["passing_accuracy"] = compute_passing(apg, topg, all_apg)

        # ── Defensive ratings ────────────────────────────────────────
        if name in DEFENSIVE_OVERRIDES:
            for key, val in DEFENSIVE_OVERRIDES[name].items():
                ratings[key] = val
            # Fill in any missing defensive keys with formula
            if "perimeter_defense" not in DEFENSIVE_OVERRIDES[name]:
                ratings["perimeter_defense"] = compute_perimeter_defense(spg, mpg, position, years)
            if "interior_defense" not in DEFENSIVE_OVERRIDES[name]:
                ratings["interior_defense"] = compute_interior_defense(bpg, rpg, position, mpg)
            if "shot_blocking" not in DEFENSIVE_OVERRIDES[name]:
                blk_pct = percentile_rank(bpg, all_bpg)
                ratings["shot_blocking"] = clamp(30 + blk_pct * 69, 25, 99)
            if "stealing" not in DEFENSIVE_OVERRIDES[name]:
                stl_pct = percentile_rank(spg, all_spg)
                ratings["stealing"] = clamp(35 + stl_pct * 62, 30, 97)
            if "defensive_iq" not in DEFENSIVE_OVERRIDES[name]:
                ratings["defensive_iq"] = compute_defensive_iq(spg, bpg, rpg, years, mpg, position)
            if "defensive_consistency" not in DEFENSIVE_OVERRIDES[name]:
                ratings["defensive_consistency"] = compute_defensive_consistency(gp, mpg, years)
        else:
            ratings["perimeter_defense"] = compute_perimeter_defense(spg, mpg, position, years)
            ratings["interior_defense"] = compute_interior_defense(bpg, rpg, position, mpg)

            blk_pct = percentile_rank(bpg, all_bpg)
            ratings["shot_blocking"] = clamp(30 + blk_pct * 69, 25, 99)

            stl_pct = percentile_rank(spg, all_spg)
            ratings["stealing"] = clamp(35 + stl_pct * 62, 30, 97)

            ratings["defensive_iq"] = compute_defensive_iq(spg, bpg, rpg, years, mpg, position)
            ratings["defensive_consistency"] = compute_defensive_consistency(gp, mpg, years)

        # ── Physical ratings ─────────────────────────────────────────
        pos_speed = {"PG": 12, "SG": 8, "SF": 4, "PF": -3, "C": -10}
        pos_strength = {"PG": -10, "SG": -5, "SF": 0, "PF": 6, "C": 12}
        pos_vertical = {"PG": 2, "SG": 5, "SF": 4, "PF": 0, "C": -4}

        mpg_pct = percentile_rank(mpg, all_mpg)
        base_physical = clamp(55 + mpg_pct * 30, 45, 85)

        if name not in PHYSICAL_OVERRIDES or "speed" not in PHYSICAL_OVERRIDES.get(name, {}):
            ratings["speed"] = clamp(base_physical + pos_speed.get(position, 0), 40, 99)
        if name not in PHYSICAL_OVERRIDES or "acceleration" not in PHYSICAL_OVERRIDES.get(name, {}):
            ratings["acceleration"] = clamp(base_physical + pos_speed.get(position, 0) - 2, 40, 99)
        if name not in PHYSICAL_OVERRIDES or "lateral_quickness" not in PHYSICAL_OVERRIDES.get(name, {}):
            ratings["lateral_quickness"] = clamp(base_physical + pos_speed.get(position, 0) - 1, 40, 99)
        if name not in PHYSICAL_OVERRIDES or "vertical" not in PHYSICAL_OVERRIDES.get(name, {}):
            ratings["vertical"] = clamp(base_physical + pos_vertical.get(position, 0), 40, 99)
        if name not in PHYSICAL_OVERRIDES or "strength" not in PHYSICAL_OVERRIDES.get(name, {}):
            ratings["strength"] = clamp(base_physical + pos_strength.get(position, 0), 40, 99)

        ratings["stamina"] = clamp(50 + mpg_pct * 45, 40, 95)

        # Apply physical overrides
        if name in PHYSICAL_OVERRIDES:
            for key, val in PHYSICAL_OVERRIDES[name].items():
                ratings[key] = val

        # ── Mental ratings ───────────────────────────────────────────
        ast_to = apg / max(topg, 0.3)

        biq_composite = apg * 0.25 + ast_to * 0.25 + mpg * 0.15 + ppg * 0.15 + years * 0.5
        all_biq = [s.get("apg", 0) * 0.25 + (s.get("apg", 0) / max(s.get("topg", 0.3), 0.3)) * 0.25 + s.get("mpg", 0) * 0.15 + s.get("ppg", 0) * 0.15 + 5 * 0.5 for s in all_stats]
        biq_pct = percentile_rank(biq_composite, all_biq)
        ratings["basketball_iq"] = clamp(45 + biq_pct * 52, 40, 97)

        oiq_composite = ppg * 0.35 + apg * 0.30 + fg_pct * 0.35
        all_oiq = [s.get("ppg", 0) * 0.35 + s.get("apg", 0) * 0.30 + s.get("fg_pct", 0) * 0.35 for s in all_stats]
        oiq_pct = percentile_rank(oiq_composite, all_oiq)
        ratings["offensive_iq"] = clamp(45 + oiq_pct * 52, 40, 97)

        ratings["rebounding"] = compute_rebounding(rpg, all_rpg)
        ratings["offensive_rebounding"] = clamp(ratings["rebounding"] - 12 + (8 if position in ("C", "PF") else -3 if position == "PG" else 0), 30, 92)

        hustle_composite = spg * 0.25 + rpg * 0.25 + mpg * 0.2 + bpg * 0.15 + gp * 0.01
        all_hustle = [s.get("spg", 0) * 0.25 + s.get("rpg", 0) * 0.25 + s.get("mpg", 0) * 0.2 + s.get("bpg", 0) * 0.15 + s.get("gp", 50) * 0.01 for s in all_stats]
        hustle_pct = percentile_rank(hustle_composite, all_hustle)
        ratings["hustle"] = clamp(42 + hustle_pct * 53, 40, 95)

        # ── Rating overrides (skill-specific) ────────────────────────
        if name in RATING_OVERRIDES:
            for key, val in RATING_OVERRIDES[name].items():
                if key in ratings:
                    ratings[key] = val

        # ── Intangibles ──────────────────────────────────────────────
        ratings["intangibles"] = INTANGIBLES.get(name, 75)

        # ── Overall ──────────────────────────────────────────────────
        # Use position-weighted offensive average so bigs aren't penalized
        # for low 3PT and guards aren't penalized for low post_game
        if position in ("C", "PF"):
            off_avg = (
                ratings["finishing"] * 0.22 + ratings["three_point"] * 0.10 +
                ratings["mid_range"] * 0.15 + ratings["free_throw"] * 0.13 +
                ratings["ball_handling"] * 0.10 + ratings["passing_vision"] * 0.10 +
                ratings["post_game"] * 0.10 + ratings["close_range"] * 0.10
            )
        else:
            off_avg = (
                ratings["finishing"] * 0.18 + ratings["three_point"] * 0.18 +
                ratings["mid_range"] * 0.12 + ratings["free_throw"] * 0.14 +
                ratings["ball_handling"] * 0.18 + ratings["passing_vision"] * 0.12 +
                ratings["post_game"] * 0.02 + ratings["close_range"] * 0.06
            )

        # Position-weighted defensive average: guards don't need interior_defense
        def_weights = {
            "PG": {"pd": 0.35, "id": 0.05, "sb": 0.05, "st": 0.25, "diq": 0.30},
            "SG": {"pd": 0.32, "id": 0.08, "sb": 0.08, "st": 0.22, "diq": 0.30},
            "SF": {"pd": 0.25, "id": 0.15, "sb": 0.12, "st": 0.20, "diq": 0.28},
            "PF": {"pd": 0.15, "id": 0.25, "sb": 0.18, "st": 0.15, "diq": 0.27},
            "C":  {"pd": 0.08, "id": 0.32, "sb": 0.25, "st": 0.08, "diq": 0.27},
        }.get(position, {"pd": 0.20, "id": 0.20, "sb": 0.15, "st": 0.20, "diq": 0.25})
        dw = def_weights
        def_avg = (
            ratings["perimeter_defense"] * dw["pd"] +
            ratings["interior_defense"] * dw["id"] +
            ratings["shot_blocking"] * dw["sb"] +
            ratings["stealing"] * dw["st"] +
            ratings["defensive_iq"] * dw["diq"]
        )

        phys_ratings = [ratings["speed"], ratings["vertical"], ratings["strength"], ratings["stamina"]]
        mental_ratings = [ratings["basketball_iq"], ratings["rebounding"], ratings["hustle"]]

        raw_overall = (
            off_avg * 0.35 +
            def_avg * 0.20 +
            sum(phys_ratings) / len(phys_ratings) * 0.10 +
            sum(mental_ratings) / len(mental_ratings) * 0.15 +
            ratings["intangibles"] * 0.20
        )
        # Store raw_overall temporarily; normalization happens in a second pass
        ratings["_raw_overall"] = raw_overall
        ratings["overall"] = clamp(raw_overall, 65, 99)

        # Potential/peak_age computed after normalization pass

        # ── Shot chart ───────────────────────────────────────────────
        p["shot_chart"] = generate_shot_chart(stats, position)

        # ── Tendencies ───────────────────────────────────────────────
        if name in TENDENCY_OVERRIDES:
            # Start with formula, then overlay overrides
            base_tendencies = generate_tendencies(stats, position)
            base_tendencies.update(TENDENCY_OVERRIDES[name])
            p["tendencies"] = base_tendencies
        else:
            p["tendencies"] = generate_tendencies(stats, position)

        # ── Character ────────────────────────────────────────────────
        p["character"] = generate_character(stats, years, name)

        # ── Durability ───────────────────────────────────────────────
        p["durability"] = generate_durability(age, gp, name)

    # ── Normalize overall distribution ──────────────────────────────
    # Collect all raw overalls, then scale to produce 65-99 range
    # with the best players at 93-96 and reasonable distribution
    raw_overalls = []
    for p in players:
        if "_raw_overall" in p["ratings"]:
            raw_overalls.append(p["ratings"]["_raw_overall"])

    # Use rank-based percentile mapping with a piecewise curve
    # to produce a realistic overall distribution
    def pct_to_overall(pct: float) -> int:
        """Map rank percentile (0=worst, 1=best) to overall rating."""
        # Piecewise linear tiers matching realistic NBA distribution
        # ~10 superstars, ~25 stars, ~55 all-star level, etc.
        tiers = [
            # (lo_pct, hi_pct, lo_ovr, hi_ovr)
            (0.98, 1.00, 94, 96),   # top 2%: ~10 superstars
            (0.95, 0.98, 91, 94),   # next 3%: ~16 stars
            (0.90, 0.95, 87, 91),   # next 5%: ~27 all-stars
            (0.80, 0.90, 82, 87),   # next 10%: ~53 quality starters
            (0.65, 0.80, 78, 82),   # next 15%: ~80 starters
            (0.45, 0.65, 74, 78),   # next 20%: ~106 rotation
            (0.20, 0.45, 70, 74),   # next 25%: ~133 bench
            (0.00, 0.20, 66, 70),   # bottom 20%: ~106 end of bench
        ]
        for lo_pct, hi_pct, lo_ovr, hi_ovr in tiers:
            if pct >= lo_pct:
                t = (pct - lo_pct) / max(hi_pct - lo_pct, 0.001)
                return clamp(lo_ovr + t * (hi_ovr - lo_ovr), 65, 99)
        return 66

    # Build rank-based percentile from raw_overall values
    players_with_raw = [(i, p) for i, p in enumerate(players) if "_raw_overall" in p["ratings"]]
    players_with_raw.sort(key=lambda x: x[1]["ratings"]["_raw_overall"])
    n_rated = len(players_with_raw)

    if n_rated > 0:
        for rank, (idx, p) in enumerate(players_with_raw):
            pct = rank / max(n_rated - 1, 1)
            p["ratings"]["overall"] = pct_to_overall(pct)
            del p["ratings"]["_raw_overall"]

            # Re-compute potential after normalization
            age = p["bio"]["age"]
            overall = p["ratings"]["overall"]
            if age <= 22:
                p["ratings"]["potential"] = clamp(overall + 10, 70, 99)
                p["ratings"]["peak_age"] = 27
            elif age <= 24:
                p["ratings"]["potential"] = clamp(overall + 6, 70, 99)
                p["ratings"]["peak_age"] = 27
            elif age <= 26:
                p["ratings"]["potential"] = clamp(overall + 3, 70, 99)
                p["ratings"]["peak_age"] = 28
            elif age <= 28:
                p["ratings"]["potential"] = clamp(overall + 1, 70, 99)
                p["ratings"]["peak_age"] = 28
            else:
                p["ratings"]["potential"] = overall
                p["ratings"]["peak_age"] = max(25, age - 1)

            if p["ratings"]["potential"] < overall:
                p["ratings"]["potential"] = min(99, overall + 1)

    # ── Re-generate contracts based on normalized overall ────────────
    for p in players:
        overall = p["ratings"]["overall"]
        age = p["bio"]["age"]
        years = p["bio"]["years_in_league"]

        if overall >= 93:
            salary = 45_000_000 + (overall - 93) * 3_000_000
            contract_years = max(1, 5 - max(0, age - 28))
            ctype = "Designated Veteran Max" if years >= 8 else "Supermax"
        elif overall >= 88:
            salary = 30_000_000 + (overall - 88) * 3_000_000
            contract_years = max(1, 4 - max(0, age - 30))
            ctype = "Max"
        elif overall >= 82:
            salary = 18_000_000 + (overall - 82) * 2_000_000
            contract_years = max(1, 4 - max(0, age - 30))
            ctype = "Standard"
        elif overall >= 76:
            salary = 8_000_000 + (overall - 76) * 1_500_000
            contract_years = max(1, 3 - max(0, age - 31))
            ctype = "Standard"
        elif overall >= 72:
            salary = 3_000_000 + (overall - 72) * 1_000_000
            contract_years = max(1, 2)
            ctype = "MLE" if overall >= 74 else "Standard"
        else:
            salary = 1_800_000 + (overall - 65) * 200_000
            contract_years = 1
            ctype = "Minimum"
        if years <= 4:
            ctype = "Rookie Scale"
            salary = min(salary, 12_000_000)

        p["contract"] = {
            "annual_salary": salary,
            "years_remaining": max(1, contract_years),
            "total_years": contract_years,
            "contract_type": ctype,
            "no_trade_clause": overall >= 93 and years >= 8,
            "player_option": overall >= 90 and age <= 30,
            "team_option": years <= 4,
            "guaranteed": True,
        }

    # ── Write back ───────────────────────────────────────────────────
    print(f"\nWriting to {PLAYERS_JSON}...")
    with open(PLAYERS_JSON, "w") as f:
        json.dump(players, f, indent=2)
    print("Done!")

    # ── Report ───────────────────────────────────────────────────────
    print(f"\n{'='*60}")
    print("RE-RATING SUMMARY")
    print(f"{'='*60}")

    top = sorted(players, key=lambda p: p["ratings"]["overall"], reverse=True)[:30]
    print("\nTop 30 Players:")
    for i, p in enumerate(top, 1):
        r = p["ratings"]
        name = f"{p['bio']['first_name']} {p['bio']['last_name']}"
        print(f"  {i:2d}. {r['overall']:2d} — {name} ({p['bio']['position']})  "
              f"3PT={r['three_point']} FT={r['free_throw']} BH={r['ball_handling']} "
              f"PDef={r['perimeter_defense']} IDef={r['interior_defense']}")

    print(f"\nElite (90+): {sum(1 for p in players if p['ratings']['overall'] >= 90)}")
    print(f"All-Star (85+): {sum(1 for p in players if p['ratings']['overall'] >= 85)}")
    print(f"Starter (78+): {sum(1 for p in players if p['ratings']['overall'] >= 78)}")
    print(f"Rotation (72+): {sum(1 for p in players if p['ratings']['overall'] >= 72)}")

    # Validation checks
    print("\n--- Validation Checks ---")
    for p in players:
        name = f"{p['bio']['first_name']} {p['bio']['last_name']}"
        r = p["ratings"]
        if name == "Rudy Gobert":
            print(f"Gobert: FT={r['free_throw']} (should be ~40-48), 3PT={r['three_point']} (should be 25-30), "
                  f"BH={r['ball_handling']} (should be ~30), PDef={r['perimeter_defense']} (should be ~55), "
                  f"IDef={r['interior_defense']} (should be ~97)")
            three_zones = [z for z in p["shot_chart"]["zones"] if z["zone_id"].startswith("three_")]
            three_tend = sum(z["tendency"] for z in three_zones)
            print(f"  3PT shot tendency: {three_tend:.3f} (should be near 0)")
        elif name == "Stephen Curry":
            print(f"Curry: 3PT={r['three_point']} (should be 95+), FT={r['free_throw']} (should be 90+), "
                  f"BH={r['ball_handling']} (should be 95)")
        elif name == "Draymond Green":
            print(f"Draymond: 3PT={r['three_point']} (should be ~65), BH={r['ball_handling']} (should be ~65), "
                  f"DefIQ={r['defensive_iq']} (should be 95)")
        elif name == "Trae Young":
            print(f"Trae: PDef={r['perimeter_defense']} (should be ~38), BH={r['ball_handling']} (should be 93)")
        elif name == "Duncan Robinson":
            print(f"Duncan Robinson: 3PT={r['three_point']} (should be 92+), BH={r['ball_handling']} (should be ~42), "
                  f"PDef={r['perimeter_defense']} (should be ~45)")
        elif name == "Brook Lopez":
            print(f"Brook Lopez: 3PT={r['three_point']} (should be ~78), BH={r['ball_handling']} (should be ~35), "
                  f"IDef={r['interior_defense']} (should be ~88)")


if __name__ == "__main__":
    rerate_all()
