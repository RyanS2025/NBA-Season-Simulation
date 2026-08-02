from __future__ import annotations

import random
from datetime import datetime, timedelta
from ..models.team import Team
from ..models.player import Player
from ..models.game import Game, GameResult
from ..models.league import League, LeagueSettings, SeasonAwards
from .game_engine import GameEngine, FastSimEngine


class SeasonEngine:
    """Season state machine: schedule generation, day simulation, standings."""

    def __init__(
        self, league: League, teams: list[Team], players: list[Player]
    ):
        self.league = league
        self.teams = teams
        self.players = players

    def generate_schedule(
        self,
        teams: list[dict],
        games_per_season: int,
        start_date: str,
    ) -> list[Game]:
        """Generate a full regular-season schedule."""
        team_lookup = {t["id"]: t for t in teams}

        pair_games: dict[tuple[str, str], int] = {}
        for i, t1 in enumerate(teams):
            for t2 in teams[i + 1:]:
                pair = (min(t1["id"], t2["id"]), max(t1["id"], t2["id"]))
                if t1["division"] == t2["division"]:
                    pair_games[pair] = 4
                elif t1["conference"] != t2["conference"]:
                    pair_games[pair] = 2
                else:
                    pair_games[pair] = 3

        team_game_count: dict[str, int] = {t["id"]: 0 for t in teams}
        for (a, b), count in pair_games.items():
            team_game_count[a] += count
            team_game_count[b] += count

        bumpable = [
            (a, b) for (a, b), c in pair_games.items()
            if c == 3 and team_lookup[a]["conference"] == team_lookup[b]["conference"]
        ]
        random.shuffle(bumpable)
        for a, b in bumpable:
            if team_game_count[a] < games_per_season and team_game_count[b] < games_per_season:
                pair_games[(a, b)] = 4
                team_game_count[a] += 1
                team_game_count[b] += 1

        all_matchups: list[tuple[str, str]] = []
        for (a, b), count in pair_games.items():
            home_a = count // 2
            home_b = count - home_a
            all_matchups.extend([(a, b)] * home_a)
            all_matchups.extend([(b, a)] * home_b)
        random.shuffle(all_matchups)

        start_dt = datetime.strptime(start_date, "%Y-%m-%d")
        num_days = int(games_per_season * 2.2)
        max_gpd = min(15, len(teams) // 2)
        min_gpd = max(5, len(teams) // 6)

        team_last_offsets: dict[str, list[int]] = {t["id"]: [] for t in teams}
        scheduled: list[tuple[str, str, int]] = []
        remaining = list(all_matchups)

        for day in range(num_days):
            if not remaining:
                break
            target = random.randint(min_gpd, max_gpd)
            teams_today: set[str] = set()
            today_count = 0
            deferred: list[tuple[str, str]] = []

            for home, away in remaining:
                if today_count >= target:
                    deferred.append((home, away))
                    continue
                if home in teams_today or away in teams_today:
                    deferred.append((home, away))
                    continue
                skip = False
                for tid in (home, away):
                    offsets = team_last_offsets[tid]
                    if (len(offsets) >= 2
                            and offsets[-1] == day - 1
                            and offsets[-2] == day - 2):
                        skip = True
                        break
                if skip:
                    deferred.append((home, away))
                    continue

                scheduled.append((home, away, day))
                teams_today.add(home)
                teams_today.add(away)
                team_last_offsets[home].append(day)
                team_last_offsets[away].append(day)
                today_count += 1

            remaining = deferred

        day = num_days
        while remaining:
            today_set: set[str] = set()
            deferred = []
            for home, away in remaining:
                if home in today_set or away in today_set:
                    deferred.append((home, away))
                    continue
                scheduled.append((home, away, day))
                today_set.add(home)
                today_set.add(away)
            remaining = deferred
            day += 1
            if day > num_days + 100:
                break

        scheduled.sort(key=lambda x: x[2])
        games: list[Game] = []
        for i, (home, away, day_off) in enumerate(scheduled):
            date_str = (start_dt + timedelta(days=day_off)).strftime("%Y-%m-%d")
            games.append(Game(
                id=f"game_{i}",
                home_team_id=home,
                away_team_id=away,
                date=date_str,
                is_playoff=False,
            ))
        return games

    def simulate_day(
        self,
        date: str,
        games: list[Game],
        teams: list[Team],
        players: list[Player],
    ) -> list[GameResult]:
        """Simulate all games scheduled for a given date."""
        today = [g for g in games if g.date == date and g.result is None]
        if not today:
            return []

        team_map = {t.id: t for t in teams}
        player_map = self._build_player_map(teams, players)
        results: list[GameResult] = []

        for game in today:
            home = team_map[game.home_team_id]
            away = team_map[game.away_team_id]
            engine = FastSimEngine(
                home, away,
                player_map.get(home.id, []),
                player_map.get(away.id, []),
            )
            result = engine.simulate_game()
            game.result = result
            results.append(result)

        return results

    def simulate_to_date(
        self,
        target_date: str,
        schedule: list[Game],
        teams: list[Team],
        players: list[Player],
    ) -> list[GameResult]:
        """Simulate all games from the current date up to the target date."""
        unplayed = [g for g in schedule if g.result is None and g.date <= target_date]
        dates = sorted({g.date for g in unplayed})
        all_results: list[GameResult] = []
        for date in dates:
            results = self.simulate_day(date, unplayed, teams, players)
            all_results.extend(results)
        return all_results

    def get_standings(self, teams: list[Team]) -> dict[str, list[Team]]:
        """Return teams grouped by conference, sorted by record."""
        by_conf: dict[str, list[Team]] = {}
        for t in teams:
            by_conf.setdefault(t.info.conference, []).append(t)
        for conf in by_conf:
            by_conf[conf].sort(
                key=lambda t: (
                    t.season_record.wins,
                    t.season_record.wins / max(t.season_record.wins + t.season_record.losses, 1),
                    t.season_record.points_for - t.season_record.points_against,
                ),
                reverse=True,
            )
        return by_conf

    def get_playoff_seedings(
        self, teams: list[Team]
    ) -> dict[str, list[Team]]:
        """Determine playoff seedings per conference."""
        standings = self.get_standings(teams)
        return {conf: sorted_teams[:10] for conf, sorted_teams in standings.items()}

    def check_auto_stop(
        self, current_date: str, settings: LeagueSettings
    ) -> str | None:
        """Check if simulation should pause at a key date. Returns phase name or None."""
        key_dates = {
            "extension_deadline": "2026-12-15",
            "trade_deadline": "2027-02-06",
            "all_star_break": "2027-02-16",
            "playoffs_start": "2027-04-15",
            "draft_lottery": "2027-05-12",
            "draft_night": "2027-06-26",
            "free_agency": "2027-06-30",
        }
        for phase, date_str in key_dates.items():
            if current_date == date_str and getattr(settings.auto_stop_points, phase, False):
                return phase
        return None

    def advance_phase(self, current_phase: str) -> str:
        """Transition to the next season phase."""
        phases = [
            "preseason", "regular_season", "playoffs",
            "offseason", "draft", "free_agency",
        ]
        if current_phase not in phases:
            return "preseason"
        return phases[(phases.index(current_phase) + 1) % len(phases)]

    def get_games_on_date(
        self, schedule: list[Game], date: str
    ) -> list[Game]:
        """Filter schedule to games on a specific date."""
        return [g for g in schedule if g.date == date]

    def update_standings(
        self, teams: list[Team], result: GameResult
    ) -> None:
        """Update team season records based on a game result."""
        team_map = {t.id: t for t in teams}
        if result.home_box_score is None or result.away_box_score is None:
            return
        home_id = result.home_box_score.team_id
        away_id = result.away_box_score.team_id
        home = team_map[home_id]
        away = team_map[away_id]

        home.season_record.points_for += result.home_score
        home.season_record.points_against += result.away_score
        away.season_record.points_for += result.away_score
        away.season_record.points_against += result.home_score

        if result.winning_team_id == home_id:
            home.season_record.wins += 1
            home.season_record.home_wins += 1
            away.season_record.losses += 1
            away.season_record.away_losses += 1
            winner, loser = home, away
        else:
            away.season_record.wins += 1
            away.season_record.away_wins += 1
            home.season_record.losses += 1
            home.season_record.home_losses += 1
            winner, loser = away, home

        winner.season_record.streak = (
            winner.season_record.streak + 1 if winner.season_record.streak > 0 else 1
        )
        loser.season_record.streak = (
            loser.season_record.streak - 1 if loser.season_record.streak < 0 else -1
        )

    def _build_player_map(
        self, teams: list[Team], players: list[Player]
    ) -> dict[str, list[Player]]:
        player_lookup = {p.id: p for p in players}
        result: dict[str, list[Player]] = {}
        for t in teams:
            result[t.id] = [
                player_lookup[rs.player_id]
                for rs in t.roster
                if rs.player_id in player_lookup
            ]
        return result


class PlayoffEngine:
    """Playoff bracket management and series simulation."""

    def __init__(self, settings: LeagueSettings):
        self.settings = settings

    def generate_bracket(
        self,
        east_seeds: list[Team],
        west_seeds: list[Team],
    ) -> list[dict]:
        """Create the full playoff bracket from conference seedings."""
        bracket: list[dict] = []
        pairings = [(1, 8), (2, 7), (3, 6), (4, 5)]
        for conf, seeds in [("Eastern", east_seeds), ("Western", west_seeds)]:
            for high, low in pairings:
                if high - 1 < len(seeds) and low - 1 < len(seeds):
                    bracket.append({
                        "round": 1,
                        "conference": conf,
                        "home_team_id": seeds[high - 1].id,
                        "away_team_id": seeds[low - 1].id,
                        "home_seed": high,
                        "away_seed": low,
                        "home_wins": 0,
                        "away_wins": 0,
                        "is_complete": False,
                        "winner_id": None,
                    })
        return bracket

    def simulate_series(
        self,
        home_team: Team,
        away_team: Team,
        home_players: list[Player],
        away_players: list[Player],
    ) -> dict:
        """Simulate a best-of-seven playoff series."""
        home_court = [True, True, False, False, True, False, True]
        home_wins = 0
        away_wins = 0
        game_results: list[GameResult] = []

        for game_num in range(7):
            if home_wins == 4 or away_wins == 4:
                break
            if home_court[game_num]:
                engine = FastSimEngine(home_team, away_team, home_players, away_players)
            else:
                engine = FastSimEngine(away_team, home_team, away_players, home_players)
            result = engine.simulate_game()
            game_results.append(result)
            if result.winning_team_id == home_team.id:
                home_wins += 1
            else:
                away_wins += 1

        winner_id = home_team.id if home_wins == 4 else away_team.id
        loser_id = away_team.id if winner_id == home_team.id else home_team.id
        return {
            "winner_id": winner_id,
            "loser_id": loser_id,
            "home_wins": home_wins,
            "away_wins": away_wins,
            "games_played": len(game_results),
            "game_results": game_results,
        }

    def advance_bracket(
        self, bracket: list[dict], completed_series: dict
    ) -> list[dict]:
        """Advance winners into the next round of the bracket."""
        winner = completed_series["winner_id"]
        loser = completed_series["loser_id"]
        completed_round = -1
        completed_conf = ""

        for entry in bracket:
            if entry["is_complete"]:
                continue
            if {entry["home_team_id"], entry["away_team_id"]} == {winner, loser}:
                entry["home_wins"] = completed_series["home_wins"]
                entry["away_wins"] = completed_series["away_wins"]
                entry["is_complete"] = True
                entry["winner_id"] = winner
                completed_round = entry["round"]
                completed_conf = entry["conference"]
                break
        else:
            return bracket

        round_series = [
            e for e in bracket
            if e["round"] == completed_round and e["conference"] == completed_conf
        ]
        if not all(e["is_complete"] for e in round_series):
            return bracket

        if completed_round <= 2:
            existing = [
                e for e in bracket
                if e["round"] == completed_round + 1 and e["conference"] == completed_conf
            ]
            if existing:
                return bracket

            # Re-seed: best remaining seed vs worst, etc.
            winners_seeded = []
            for e in round_series:
                seed = e["home_seed"] if e["winner_id"] == e["home_team_id"] else e["away_seed"]
                winners_seeded.append((e["winner_id"], seed))
            winners_seeded.sort(key=lambda x: x[1])

            for i in range(len(winners_seeded) // 2):
                high = winners_seeded[i]
                low = winners_seeded[-(i + 1)]
                bracket.append({
                    "round": completed_round + 1,
                    "conference": completed_conf,
                    "home_team_id": high[0],
                    "away_team_id": low[0],
                    "home_seed": high[1],
                    "away_seed": low[1],
                    "home_wins": 0,
                    "away_wins": 0,
                    "is_complete": False,
                    "winner_id": None,
                })

        elif completed_round == 3:
            conf_finals = [e for e in bracket if e["round"] == 3]
            if not all(e["is_complete"] for e in conf_finals) or len(conf_finals) < 2:
                return bracket
            if any(e["round"] == 4 for e in bracket):
                return bracket

            champs = []
            for e in conf_finals:
                seed = e["home_seed"] if e["winner_id"] == e["home_team_id"] else e["away_seed"]
                champs.append((e["winner_id"], seed))
            champs.sort(key=lambda x: x[1])

            bracket.append({
                "round": 4,
                "conference": "Finals",
                "home_team_id": champs[0][0],
                "away_team_id": champs[1][0],
                "home_seed": champs[0][1],
                "away_seed": champs[1][1],
                "home_wins": 0,
                "away_wins": 0,
                "is_complete": False,
                "winner_id": None,
            })

        return bracket

    def generate_play_in(
        self, seeds_7_to_10: list[Team], players: list[Player]
    ) -> list[Team]:
        """Run the play-in tournament and return the qualifying teams."""
        if len(seeds_7_to_10) < 4:
            return seeds_7_to_10[:2]

        team_map = {t.id: t for t in seeds_7_to_10}
        player_lookup = {p.id: p for p in players}

        def get_players(team: Team) -> list[Player]:
            return [
                player_lookup[rs.player_id]
                for rs in team.roster
                if rs.player_id in player_lookup
            ]

        seed7, seed8, seed9, seed10 = seeds_7_to_10[:4]

        engine = FastSimEngine(seed7, seed8, get_players(seed7), get_players(seed8))
        r1 = engine.simulate_game()
        game1_winner = team_map[r1.winning_team_id]
        game1_loser = seed8 if r1.winning_team_id == seed7.id else seed7

        engine = FastSimEngine(seed9, seed10, get_players(seed9), get_players(seed10))
        r2 = engine.simulate_game()
        game2_winner = team_map[r2.winning_team_id]

        engine = FastSimEngine(
            game1_loser, game2_winner,
            get_players(game1_loser), get_players(game2_winner),
        )
        r3 = engine.simulate_game()
        game3_winner = team_map[r3.winning_team_id]

        return [game1_winner, game3_winner]
