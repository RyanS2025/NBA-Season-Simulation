from __future__ import annotations

import random
from dataclasses import dataclass, field


CITY_DISTANCES: dict[str, dict[str, int]] = {}

_CITY_COORDS: dict[str, tuple[float, float]] = {
    "Boston": (42.36, -71.06),
    "New York": (40.75, -73.99),
    "Philadelphia": (39.95, -75.17),
    "Toronto": (43.64, -79.38),
    "Brooklyn": (40.68, -73.97),
    "Chicago": (41.88, -87.63),
    "Cleveland": (41.50, -81.69),
    "Milwaukee": (43.04, -87.92),
    "Indiana": (39.76, -86.16),
    "Detroit": (42.33, -83.05),
    "Miami": (25.78, -80.19),
    "Atlanta": (33.76, -84.39),
    "Charlotte": (35.23, -80.84),
    "Washington": (38.90, -77.02),
    "Orlando": (28.54, -81.38),
    "Denver": (39.75, -105.00),
    "Portland": (45.53, -122.67),
    "Minnesota": (44.98, -93.27),
    "Oklahoma City": (35.46, -97.52),
    "Utah": (40.77, -111.89),
    "Los Angeles": (34.05, -118.24),
    "Golden State": (37.77, -122.42),
    "Sacramento": (38.58, -121.49),
    "Phoenix": (33.45, -112.07),
    "Dallas": (32.79, -96.81),
    "Houston": (29.76, -95.37),
    "San Antonio": (29.42, -98.49),
    "Memphis": (35.14, -90.05),
    "New Orleans": (29.95, -90.07),
}


def _haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> int:
    import math

    R = 3959
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlon / 2) ** 2
    )
    return int(R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a)))


def _build_distance_matrix() -> None:
    if CITY_DISTANCES:
        return
    cities = list(_CITY_COORDS.keys())
    for c1 in cities:
        CITY_DISTANCES[c1] = {}
        lat1, lon1 = _CITY_COORDS[c1]
        for c2 in cities:
            if c1 == c2:
                CITY_DISTANCES[c1][c2] = 0
            else:
                lat2, lon2 = _CITY_COORDS[c2]
                CITY_DISTANCES[c1][c2] = _haversine(lat1, lon1, lat2, lon2)


ALTITUDE_CITIES: set[str] = {"Denver", "Utah"}

DIVISIONS: dict[str, list[str]] = {
    "Atlantic": ["BOS", "NYT", "PHI", "TOR", "BKN"],
    "Central": ["CHI", "CLE", "MIL", "IND", "DET"],
    "Southeast": ["MIA", "ATL", "CHA", "WAS", "ORL"],
    "Northwest": ["DEN", "POR", "MIN", "OKC", "UTA"],
    "Pacific": ["LAV", "GSS", "SAC", "PHX", "LAW"],
    "Southwest": ["DAL", "HOU", "SAS", "MEM", "NOP"],
}

CONFERENCE_DIVISIONS: dict[str, list[str]] = {
    "East": ["Atlantic", "Central", "Southeast"],
    "West": ["Northwest", "Pacific", "Southwest"],
}

TEAM_CITY: dict[str, str] = {
    "BOS": "Boston",
    "NYT": "New York",
    "PHI": "Philadelphia",
    "TOR": "Toronto",
    "BKN": "Brooklyn",
    "CHI": "Chicago",
    "CLE": "Cleveland",
    "MIL": "Milwaukee",
    "IND": "Indiana",
    "DET": "Detroit",
    "MIA": "Miami",
    "ATL": "Atlanta",
    "CHA": "Charlotte",
    "WAS": "Washington",
    "ORL": "Orlando",
    "DEN": "Denver",
    "POR": "Portland",
    "MIN": "Minnesota",
    "OKC": "Oklahoma City",
    "UTA": "Utah",
    "LAV": "Los Angeles",
    "GSS": "Golden State",
    "SAC": "Sacramento",
    "PHX": "Phoenix",
    "LAW": "Los Angeles",
    "DAL": "Dallas",
    "HOU": "Houston",
    "SAS": "San Antonio",
    "MEM": "Memphis",
    "NOP": "New Orleans",
}


def get_team_division(team_id: str) -> str:
    for div, teams in DIVISIONS.items():
        if team_id in teams:
            return div
    return ""


def get_team_conference(team_id: str) -> str:
    div = get_team_division(team_id)
    for conf, divs in CONFERENCE_DIVISIONS.items():
        if div in divs:
            return conf
    return ""


def get_conference_teams(conference: str) -> list[str]:
    teams: list[str] = []
    for div in CONFERENCE_DIVISIONS.get(conference, []):
        teams.extend(DIVISIONS.get(div, []))
    return teams


def get_travel_distance(city1: str, city2: str) -> int:
    _build_distance_matrix()
    return CITY_DISTANCES.get(city1, {}).get(city2, 0)


def is_altitude_city(city: str) -> bool:
    return city in ALTITUDE_CITIES


@dataclass
class ScheduledGame:
    home_team_id: str
    away_team_id: str
    date: str
    game_number: int = 0
    is_back_to_back_home: bool = False
    is_back_to_back_away: bool = False
    travel_distance: int = 0


@dataclass
class TeamScheduleContext:
    team_id: str
    games_played: int = 0
    home_games: int = 0
    away_games: int = 0
    last_game_date: str = ""
    last_location: str = ""
    current_road_trip: int = 0
    current_home_stand: int = 0
    games_last_5_days: list[str] = field(default_factory=list)
    opponent_counts: dict[str, int] = field(default_factory=dict)
    home_opponent_counts: dict[str, int] = field(default_factory=dict)
    away_opponent_counts: dict[str, int] = field(default_factory=dict)


class ScheduleGenerator:

    def __init__(self, seed: int | None = None) -> None:
        _build_distance_matrix()
        self._rng = random.Random(seed)

    def generate_season_schedule(
        self, team_ids: list[str], season_year: int = 2026
    ) -> list[ScheduledGame]:
        matchups = self._generate_matchups(team_ids)
        self._rng.shuffle(matchups)
        dates = self._generate_date_slots(season_year)
        schedule = self._assign_dates(matchups, dates, team_ids)
        self._annotate_schedule(schedule, team_ids)
        return schedule

    def _generate_matchups(self, team_ids: list[str]) -> list[tuple[str, str]]:
        matchups: list[tuple[str, str]] = []

        four_game_pairs: set[tuple[str, str]] = set()
        for conf_name in ("East", "West"):
            conf_teams = get_conference_teams(conf_name)
            non_div_pairs: list[tuple[str, str]] = []
            for i, t1 in enumerate(conf_teams):
                for t2 in conf_teams[i + 1 :]:
                    if get_team_division(t1) != get_team_division(t2):
                        non_div_pairs.append((t1, t2))

            for _attempt in range(50):
                trial_pairs: set[tuple[str, str]] = set()
                extras_needed: dict[str, int] = {t: 6 for t in conf_teams}
                shuffled = list(non_div_pairs)
                self._rng.shuffle(shuffled)
                for t1, t2 in shuffled:
                    if extras_needed[t1] > 0 and extras_needed[t2] > 0:
                        trial_pairs.add((t1, t2))
                        extras_needed[t1] -= 1
                        extras_needed[t2] -= 1
                if all(v == 0 for v in extras_needed.values()):
                    four_game_pairs.update(trial_pairs)
                    break
            else:
                four_game_pairs.update(trial_pairs)

        for i, t1 in enumerate(team_ids):
            for t2 in team_ids[i + 1 :]:
                conf1 = get_team_conference(t1)
                conf2 = get_team_conference(t2)

                if conf1 != conf2:
                    total = 2
                elif get_team_division(t1) == get_team_division(t2):
                    total = 4
                else:
                    key = (t1, t2) if (t1, t2) in four_game_pairs else (t2, t1)
                    total = 4 if key in four_game_pairs else 3

                home_first = total // 2
                away_first = total - home_first
                if self._rng.random() < 0.5:
                    home_first, away_first = away_first, home_first
                for _ in range(home_first):
                    matchups.append((t1, t2))
                for _ in range(away_first):
                    matchups.append((t2, t1))

        return matchups

    def _generate_date_slots(self, season_year: int) -> list[str]:
        start_month = 10
        start_day = 22
        dates: list[str] = []

        days_in_month = {
            1: 31, 2: 28, 3: 31, 4: 30, 5: 31, 6: 30,
            7: 31, 8: 31, 9: 30, 10: 31, 11: 30, 12: 31,
        }
        if season_year % 4 == 0:
            days_in_month[2] = 29

        month, day, year = start_month, start_day, season_year
        end_month, end_day, end_year = 4, 13, season_year + 1

        while True:
            dates.append(f"{year}-{month:02d}-{day:02d}")
            if year == end_year and month == end_month and day == end_day:
                break
            day += 1
            if day > days_in_month.get(month, 30):
                day = 1
                month += 1
                if month > 12:
                    month = 1
                    year += 1

        return dates

    def _assign_dates(
        self,
        matchups: list[tuple[str, str]],
        dates: list[str],
        team_ids: list[str],
    ) -> list[ScheduledGame]:
        schedule: list[ScheduledGame] = []
        team_dates: dict[str, set[str]] = {t: set() for t in team_ids}
        team_consecutive: dict[str, list[str]] = {t: [] for t in team_ids}

        remaining = list(matchups)
        self._rng.shuffle(remaining)

        games_per_date = max(1, len(remaining) // len(dates) + 1)

        for date in dates:
            if not remaining:
                break

            daily_games: list[tuple[str, str]] = []
            used_teams: set[str] = set()
            candidates = list(remaining)
            self._rng.shuffle(candidates)

            for home, away in candidates:
                if len(daily_games) >= games_per_date:
                    break
                if home in used_teams or away in used_teams:
                    continue
                if date in team_dates[home] or date in team_dates[away]:
                    continue
                if not self._check_rest(home, team_consecutive, date):
                    continue
                if not self._check_rest(away, team_consecutive, date):
                    continue

                daily_games.append((home, away))
                used_teams.add(home)
                used_teams.add(away)
                team_dates[home].add(date)
                team_dates[away].add(date)
                team_consecutive[home].append(date)
                team_consecutive[away].append(date)
                remaining.remove((home, away))

            for home, away in daily_games:
                schedule.append(ScheduledGame(
                    home_team_id=home,
                    away_team_id=away,
                    date=date,
                ))

        for home, away in remaining:
            for date in dates:
                if date not in team_dates[home] and date not in team_dates[away]:
                    schedule.append(ScheduledGame(
                        home_team_id=home,
                        away_team_id=away,
                        date=date,
                    ))
                    team_dates[home].add(date)
                    team_dates[away].add(date)
                    team_consecutive[home].append(date)
                    team_consecutive[away].append(date)
                    break

        schedule.sort(key=lambda g: g.date)
        return schedule

    def _check_rest(
        self, team: str, consecutive: dict[str, list[str]], date: str
    ) -> bool:
        recent = consecutive[team]
        if len(recent) < 2:
            return True
        last_two = recent[-2:]
        if self._days_between(last_two[0], date) <= 2 and self._days_between(
            last_two[1], date
        ) <= 1:
            return False
        if len(recent) >= 4:
            window = recent[-4:]
            if self._days_between(window[0], date) <= 5:
                return False
        return True

    def _days_between(self, date1: str, date2: str) -> int:
        y1, m1, d1 = (int(x) for x in date1.split("-"))
        y2, m2, d2 = (int(x) for x in date2.split("-"))
        days1 = y1 * 365 + m1 * 30 + d1
        days2 = y2 * 365 + m2 * 30 + d2
        return abs(days2 - days1)

    def _annotate_schedule(
        self, schedule: list[ScheduledGame], team_ids: list[str]
    ) -> None:
        team_prev_date: dict[str, str] = {}
        game_number = 0

        for game in schedule:
            game_number += 1
            game.game_number = game_number

            home_city = TEAM_CITY.get(game.home_team_id, "")
            away_city = TEAM_CITY.get(game.away_team_id, "")

            away_prev_city = team_prev_date.get(game.away_team_id + "_city", away_city)
            game.travel_distance = get_travel_distance(away_prev_city, home_city)

            home_prev = team_prev_date.get(game.home_team_id)
            if home_prev and self._days_between(home_prev, game.date) <= 1:
                game.is_back_to_back_home = True

            away_prev = team_prev_date.get(game.away_team_id)
            if away_prev and self._days_between(away_prev, game.date) <= 1:
                game.is_back_to_back_away = True

            team_prev_date[game.home_team_id] = game.date
            team_prev_date[game.away_team_id] = game.date
            team_prev_date[game.home_team_id + "_city"] = home_city
            team_prev_date[game.away_team_id + "_city"] = home_city

    def generate_playoff_schedule(
        self,
        home_team_id: str,
        away_team_id: str,
        round_number: int,
        start_date: str,
    ) -> list[ScheduledGame]:
        pattern = [
            home_team_id, home_team_id,
            away_team_id, away_team_id,
            home_team_id,
            away_team_id,
            home_team_id,
        ]

        rest_days = 2 if round_number <= 2 else 1
        games: list[ScheduledGame] = []
        current_date = start_date

        for i, host in enumerate(pattern):
            visitor = away_team_id if host == home_team_id else home_team_id
            games.append(ScheduledGame(
                home_team_id=host,
                away_team_id=visitor,
                date=current_date,
                game_number=i + 1,
            ))
            current_date = self._advance_date(current_date, rest_days + 1)

        return games

    def _advance_date(self, date: str, days: int) -> str:
        y, m, d = (int(x) for x in date.split("-"))
        days_in_month = {
            1: 31, 2: 28, 3: 31, 4: 30, 5: 31, 6: 30,
            7: 31, 8: 31, 9: 30, 10: 31, 11: 30, 12: 31,
        }
        if y % 4 == 0:
            days_in_month[2] = 29

        for _ in range(days):
            d += 1
            if d > days_in_month.get(m, 30):
                d = 1
                m += 1
                if m > 12:
                    m = 1
                    y += 1

        return f"{y}-{m:02d}-{d:02d}"


class TravelTracker:

    def __init__(self) -> None:
        _build_distance_matrix()
        self._team_history: dict[str, list[dict]] = {}

    def record_game(
        self, team_id: str, date: str, city: str, is_home: bool
    ) -> None:
        if team_id not in self._team_history:
            self._team_history[team_id] = []
        self._team_history[team_id].append({
            "date": date,
            "city": city,
            "is_home": is_home,
        })

    def get_context_for_game(
        self, team_id: str, game_date: str, opponent_city: str, is_home: bool
    ) -> dict:
        from ..models.game import GameContext

        history = self._team_history.get(team_id, [])
        home_city = TEAM_CITY.get(team_id, "")
        game_city = home_city if is_home else opponent_city

        days_rest = 2
        is_b2b = False
        is_second_b2b = False
        games_in_5 = 0
        travel_dist = 0
        road_trip_len = 0

        if history:
            last = history[-1]
            days_rest = self._calc_days_between(last["date"], game_date)
            if days_rest <= 1:
                is_b2b = True
                if len(history) >= 2:
                    prev_prev = history[-2]
                    prev_rest = self._calc_days_between(prev_prev["date"], last["date"])
                    if prev_rest <= 1:
                        is_second_b2b = True

            last_city = last["city"]
            travel_dist = get_travel_distance(last_city, game_city)

            cutoff_idx = max(0, len(history) - 10)
            for entry in history[cutoff_idx:]:
                if self._calc_days_between(entry["date"], game_date) <= 5:
                    games_in_5 += 1

            for entry in reversed(history):
                if entry["is_home"]:
                    break
                road_trip_len += 1

        altitude = is_altitude_city(game_city)

        return GameContext(
            is_back_to_back=is_b2b,
            is_second_of_back_to_back=is_second_b2b,
            days_rest=days_rest,
            games_in_last_5_days=games_in_5,
            travel_distance=travel_dist,
            is_home=is_home,
            altitude_game=altitude,
            road_trip_length=road_trip_len,
        )

    def get_season_travel_miles(self, team_id: str) -> int:
        history = self._team_history.get(team_id, [])
        total = 0
        for i in range(1, len(history)):
            prev_city = history[i - 1]["city"]
            curr_city = history[i]["city"]
            total += get_travel_distance(prev_city, curr_city)
        return total

    def _calc_days_between(self, d1: str, d2: str) -> int:
        y1, m1, day1 = (int(x) for x in d1.split("-"))
        y2, m2, day2 = (int(x) for x in d2.split("-"))
        jd1 = y1 * 365 + m1 * 30 + day1
        jd2 = y2 * 365 + m2 * 30 + day2
        return abs(jd2 - jd1)
