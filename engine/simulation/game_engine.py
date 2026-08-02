from __future__ import annotations

import random
import math
from ..models.player import Player
from ..models.team import Team
from ..models.game import Game, GameResult, GameState, TeamBoxScore, TeamGameStats, PlayerGameStats, ShotAttempt
from ..models.league import LeagueSettings
from .possession import PossessionEngine
from .fatigue import FatigueSystem
from .injury import InjurySystem
from ..ai.coach_ai import CoachAI
from .shot_selection import ShotSelector


class GameEngine:
    """Full game simulation orchestrator using possession-by-possession logic."""

    def __init__(
        self,
        home_team: Team,
        away_team: Team,
        home_players: list[Player],
        away_players: list[Player],
        settings: LeagueSettings | None = None,
    ):
        self.home_team = home_team
        self.away_team = away_team
        self.home_players = home_players
        self.away_players = away_players
        self.settings = settings
        self.fatigue_system = FatigueSystem()
        self.injury_system = InjurySystem()
        self.home_coach = CoachAI(home_team, home_players)
        self.away_coach = CoachAI(away_team, away_players)
        self.player_stats: dict[str, PlayerGameStats] = {
            p.id: PlayerGameStats(player_id=p.id) for p in home_players + away_players
        }
        self.quarter_scores: dict[str, list[int]] = {"home": [], "away": []}
        self._player_map: dict[str, Player] = {
            p.id: p for p in home_players + away_players
        }
        self._home_player_ids: set[str] = {p.id for p in home_players}
        self._away_player_ids: set[str] = {p.id for p in away_players}
        self._home_starters: list[str] = []
        self._away_starters: list[str] = []
        self._home_biggest_lead = 0
        self._away_biggest_lead = 0
        self._total_possessions = 0

    def simulate_full_game(self) -> GameResult:
        home_lineup = self.get_starting_lineup(self.home_team, self.home_players)
        away_lineup = self.get_starting_lineup(self.away_team, self.away_players)
        self._home_starters = [p.id for p in home_lineup]
        self._away_starters = [p.id for p in away_lineup]

        state = GameState(
            possession_team="home",
            home_lineup=[p.id for p in home_lineup],
            away_lineup=[p.id for p in away_lineup],
        )

        for q in range(1, 5):
            state.game_clock = 720.0
            h_before = state.home_score
            a_before = state.away_score
            state = self.simulate_quarter(state, q)
            self.quarter_scores["home"].append(state.home_score - h_before)
            self.quarter_scores["away"].append(state.away_score - a_before)

        ot_count = 0
        while state.home_score == state.away_score and ot_count < 4:
            h_before = state.home_score
            a_before = state.away_score
            state = self.simulate_overtime(state)
            self.quarter_scores["home"].append(state.home_score - h_before)
            self.quarter_scores["away"].append(state.away_score - a_before)
            ot_count += 1

        if state.home_score == state.away_score:
            if random.random() < 0.5:
                state.home_score += random.randint(1, 3)
            else:
                state.away_score += random.randint(1, 3)

        self._total_possessions = state.possession_count
        home_box = self.compile_box_score(self.home_team.id, self.player_stats)
        away_box = self.compile_box_score(self.away_team.id, self.player_stats)
        winning_team_id = (
            self.home_team.id if state.home_score > state.away_score else self.away_team.id
        )

        return GameResult(
            home_score=state.home_score,
            away_score=state.away_score,
            overtime=ot_count,
            winning_team_id=winning_team_id,
            home_box_score=home_box,
            away_box_score=away_box,
            quarter_scores=self.quarter_scores,
        )

    def simulate_quarter(self, state: GameState, quarter: int) -> GameState:
        state.quarter = quarter
        possession_engine = PossessionEngine(
            [self._player_map[pid] for pid in state.home_lineup],
            [self._player_map[pid] for pid in state.away_lineup],
        )
        possession_count = 0

        while state.game_clock > 0:
            if state.possession_team == "home":
                offense = [self._player_map[pid] for pid in state.home_lineup]
                defense = [self._player_map[pid] for pid in state.away_lineup]
            else:
                offense = [self._player_map[pid] for pid in state.away_lineup]
                defense = [self._player_map[pid] for pid in state.home_lineup]

            result = possession_engine.simulate_possession(state, offense, defense)
            self._update_stats(result, offense, defense)

            pts = result["points"]
            if state.possession_team == "home":
                state.home_score += pts
            else:
                state.away_score += pts

            if pts > 0:
                off_lineup = (
                    state.home_lineup if state.possession_team == "home" else state.away_lineup
                )
                def_lineup = (
                    state.away_lineup if state.possession_team == "home" else state.home_lineup
                )
                for pid in off_lineup:
                    self.player_stats[pid].plus_minus += pts
                for pid in def_lineup:
                    self.player_stats[pid].plus_minus -= pts

            home_lead = state.home_score - state.away_score
            if home_lead > self._home_biggest_lead:
                self._home_biggest_lead = home_lead
            if -home_lead > self._away_biggest_lead:
                self._away_biggest_lead = -home_lead

            time_consumed = random.uniform(14, 18)
            state.game_clock -= time_consumed
            minutes_consumed = time_consumed / 60.0

            for pid in state.home_lineup + state.away_lineup:
                self.player_stats[pid].minutes += minutes_consumed
                self.fatigue_system.update_fatigue(self._player_map[pid], 0.4)

            home_bench_ids = [
                p.id for p in self.home_players if p.id not in state.home_lineup
            ]
            away_bench_ids = [
                p.id for p in self.away_players if p.id not in state.away_lineup
            ]
            for pid in home_bench_ids + away_bench_ids:
                self.fatigue_system.recover_fatigue(self._player_map[pid], 0.4)

            possession_count += 1
            state.possession_count += 1

            if possession_count % 3 == 0:
                home_on = [self._player_map[pid] for pid in state.home_lineup]
                home_bench = [
                    p for p in self.home_players if p.id not in state.home_lineup
                ]
                new_on, _ = self.handle_substitutions(
                    home_on, home_bench, quarter, state.game_clock,
                    state.home_score - state.away_score,
                )
                state.home_lineup = [p.id for p in new_on]

                away_on = [self._player_map[pid] for pid in state.away_lineup]
                away_bench = [
                    p for p in self.away_players if p.id not in state.away_lineup
                ]
                new_on, _ = self.handle_substitutions(
                    away_on, away_bench, quarter, state.game_clock,
                    state.away_score - state.home_score,
                )
                state.away_lineup = [p.id for p in new_on]

            state.possession_team = (
                "away" if state.possession_team == "home" else "home"
            )

            target = random.choice(offense + defense)
            injury = self.injury_system.check_injury(target, "")
            if injury:
                target.status.current_injury = injury
                target.status.health = "injured"
                if target.id in state.home_lineup:
                    bench = [
                        p for p in self.home_players
                        if p.id not in state.home_lineup
                        and p.status.health == "healthy"
                    ]
                    if bench:
                        sub = max(bench, key=lambda p: p.ratings.overall)
                        state.home_lineup = [
                            sub.id if pid == target.id else pid
                            for pid in state.home_lineup
                        ]
                elif target.id in state.away_lineup:
                    bench = [
                        p for p in self.away_players
                        if p.id not in state.away_lineup
                        and p.status.health == "healthy"
                    ]
                    if bench:
                        sub = max(bench, key=lambda p: p.ratings.overall)
                        state.away_lineup = [
                            sub.id if pid == target.id else pid
                            for pid in state.away_lineup
                        ]

        return state

    def simulate_overtime(self, state: GameState) -> GameState:
        state.game_clock = 300.0
        return self.simulate_quarter(state, state.quarter + 1)

    def get_starting_lineup(
        self, team: Team, players: list[Player]
    ) -> list[Player]:
        healthy = [p for p in players if p.status.health == "healthy"]
        healthy.sort(key=lambda p: p.ratings.overall, reverse=True)
        return healthy[:5]

    def handle_substitutions(
        self,
        on_court: list[Player],
        bench: list[Player],
        quarter: int,
        game_clock: float,
        score_diff: int,
    ) -> tuple[list[Player], list[Player]]:
        new_on = list(on_court)
        new_bench = list(bench)
        subs_made = 0

        for player in on_court:
            if subs_made >= 2:
                break
            fouls = self.player_stats[player.id].personal_fouls
            if not self.fatigue_system.should_substitute(player, quarter, fouls):
                continue
            available = [p for p in new_bench if p.status.health == "healthy"]
            if not available:
                continue
            sub = max(available, key=lambda p: p.ratings.overall)
            idx = new_on.index(player)
            new_on[idx] = sub
            new_bench.remove(sub)
            new_bench.append(player)
            subs_made += 1

        return new_on, new_bench

    def compile_box_score(
        self, team_id: str, player_stats: dict[str, PlayerGameStats]
    ) -> TeamBoxScore:
        if team_id == self.home_team.id:
            team_pids = self._home_player_ids
            starters = self._home_starters
            biggest_lead = self._home_biggest_lead
        else:
            team_pids = self._away_player_ids
            starters = self._away_starters
            biggest_lead = self._away_biggest_lead

        stats_list: list[PlayerGameStats] = []
        total_points = 0
        bench_points = 0
        total_turnovers = 0
        paint_points = 0

        for pid in team_pids:
            ps = player_stats[pid]
            ps.total_rebounds = ps.offensive_rebounds + ps.defensive_rebounds
            ps.minutes = round(ps.minutes, 1)
            stats_list.append(ps)
            total_points += ps.points
            total_turnovers += ps.turnovers
            if pid not in starters:
                bench_points += ps.points
            for shot in ps.shot_chart:
                if shot.made and ShotSelector.is_paint_shot(shot.zone_id):
                    paint_points += 2

        stats_list.sort(key=lambda ps: ps.minutes, reverse=True)
        team_rebounds = sum(ps.total_rebounds for ps in stats_list)
        total_player_minutes = sum(ps.minutes for ps in stats_list)
        game_minutes = total_player_minutes / 5.0 if total_player_minutes > 0 else 48.0
        pace = (
            (self._total_possessions / 2.0) / game_minutes * 48.0
            if game_minutes > 0
            else 100.0
        )

        team_stats = TeamGameStats(
            fast_break_points=int(total_points * 0.15),
            points_in_paint=paint_points,
            second_chance_points=int(total_points * 0.10),
            bench_points=bench_points,
            turnovers=total_turnovers,
            team_rebounds=team_rebounds,
            biggest_lead=biggest_lead,
            pace=round(pace, 1),
        )

        return TeamBoxScore(
            team_id=team_id,
            player_stats=stats_list,
            team_stats=team_stats,
        )

    def check_end_of_quarter(self, state: GameState) -> bool:
        return state.game_clock <= 0.0

    def determine_winner(self, home_score: int, away_score: int) -> str:
        return "home" if home_score > away_score else "away"

    def _update_stats(
        self, result: dict, offense: list[Player], defense: list[Player]
    ) -> None:
        shooter_id = result["shooter_id"]

        if result["turnover"]:
            weights = [
                float(p.ratings.ball_handling + p.tendencies.usage_desire)
                for p in offense
            ]
            handler = _weighted_choice(offense, weights)
            self.player_stats[handler.id].turnovers += 1
            steal_weights = [float(p.ratings.stealing) for p in defense]
            stealer = _weighted_choice(defense, steal_weights)
            self.player_stats[stealer.id].steals += 1
            return

        if result["foul"] is not None and shooter_id:
            num_ft = result["foul"]["free_throws"]
            made_ft = result["points"]
            self.player_stats[shooter_id].free_throws_attempted += num_ft
            self.player_stats[shooter_id].free_throws_made += made_ft
            self.player_stats[shooter_id].points += made_ft
            fouler = random.choice(defense)
            self.player_stats[fouler.id].personal_fouls += 1
            return

        shot = result["shot_attempt"]
        if shot is None or not shooter_id:
            return

        ps = self.player_stats[shooter_id]
        ps.field_goals_attempted += 1
        ps.shot_chart.append(shot)
        is_three = ShotSelector.is_three_pointer(shot.zone_id)
        if is_three:
            ps.three_pointers_attempted += 1

        if shot.made:
            ps.field_goals_made += 1
            ps.points += 3 if is_three else 2
            if is_three:
                ps.three_pointers_made += 1
            if result["assist_by"]:
                self.player_stats[result["assist_by"]].assists += 1
        else:
            reb = result["rebound"]
            if reb:
                rid = reb["rebounder_id"]
                if reb["offensive"]:
                    self.player_stats[rid].offensive_rebounds += 1
                else:
                    self.player_stats[rid].defensive_rebounds += 1
            if random.random() < 0.08:
                block_weights = [float(p.ratings.shot_blocking) for p in defense]
                blocker = _weighted_choice(defense, block_weights)
                self.player_stats[blocker.id].blocks += 1


class FastSimEngine:
    """Lightweight game simulation using statistical distributions."""

    def __init__(
        self,
        home_team: Team,
        away_team: Team,
        home_players: list[Player],
        away_players: list[Player],
        settings: LeagueSettings | None = None,
    ):
        self.home_team = home_team
        self.away_team = away_team
        self.home_players = home_players
        self.away_players = away_players
        self.settings = settings

    def simulate_game(self) -> GameResult:
        home_strength = self.calculate_team_strength(self.home_team, self.home_players)
        away_strength = self.calculate_team_strength(self.away_team, self.away_players)

        base_score = 110
        home_advantage = 3.0
        home_mod = (home_strength - 0.5) * 15
        away_mod = (away_strength - 0.5) * 15

        home_score = int(random.gauss(base_score + home_advantage + home_mod, 12))
        away_score = int(random.gauss(base_score + away_mod, 12))
        home_score = max(85, min(145, home_score))
        away_score = max(85, min(145, away_score))

        if home_score == away_score:
            if random.random() < 0.5:
                home_score += random.randint(1, 5)
            else:
                away_score += random.randint(1, 5)

        quarter_scores = {
            "home": self._split_score_into_quarters(home_score),
            "away": self._split_score_into_quarters(away_score),
        }

        home_box = self.generate_box_score(
            self.home_team, self.home_players, home_score, away_score
        )
        away_box = self.generate_box_score(
            self.away_team, self.away_players, away_score, home_score
        )
        winning_team_id = (
            self.home_team.id if home_score > away_score else self.away_team.id
        )

        return GameResult(
            home_score=home_score,
            away_score=away_score,
            overtime=0,
            winning_team_id=winning_team_id,
            home_box_score=home_box,
            away_box_score=away_box,
            quarter_scores=quarter_scores,
        )

    def calculate_team_strength(
        self, team: Team, players: list[Player]
    ) -> float:
        healthy = [p for p in players if p.status.health == "healthy"]
        healthy.sort(key=lambda p: p.ratings.overall, reverse=True)
        top_8 = healthy[:8]
        if not top_8:
            return 0.0
        avg = sum(p.ratings.overall for p in top_8) / len(top_8)
        return max(0.0, min(1.0, (avg - 65) / 35))

    def generate_box_score(
        self,
        team: Team,
        players: list[Player],
        team_score: int,
        opponent_score: int,
    ) -> TeamBoxScore:
        stat_dicts = self.distribute_stats(players, team_score)

        player_stats_list: list[PlayerGameStats] = []
        bench_points = 0
        total_turnovers = 0
        total_rebounds = 0

        for i, sd in enumerate(stat_dicts):
            oreb = sd["offensive_rebounds"]
            dreb = sd["defensive_rebounds"]
            ps = PlayerGameStats(
                player_id=sd["player_id"],
                minutes=sd["minutes"],
                points=sd["points"],
                field_goals_made=sd["field_goals_made"],
                field_goals_attempted=sd["field_goals_attempted"],
                three_pointers_made=sd["three_pointers_made"],
                three_pointers_attempted=sd["three_pointers_attempted"],
                free_throws_made=sd["free_throws_made"],
                free_throws_attempted=sd["free_throws_attempted"],
                offensive_rebounds=oreb,
                defensive_rebounds=dreb,
                total_rebounds=oreb + dreb,
                assists=sd["assists"],
                steals=sd["steals"],
                blocks=sd["blocks"],
                turnovers=sd["turnovers"],
                personal_fouls=random.randint(1, 4),
                plus_minus=int(
                    (team_score - opponent_score) * sd["minutes"] / 48.0
                    + random.gauss(0, 3)
                ),
            )
            player_stats_list.append(ps)
            if i >= 5:
                bench_points += sd["points"]
            total_turnovers += sd["turnovers"]
            total_rebounds += oreb + dreb

        score_diff = team_score - opponent_score
        team_stats = TeamGameStats(
            fast_break_points=int(team_score * 0.15),
            points_in_paint=int(team_score * 0.46),
            second_chance_points=int(team_score * 0.10),
            bench_points=bench_points,
            turnovers=total_turnovers,
            team_rebounds=total_rebounds,
            biggest_lead=max(0, score_diff + random.randint(0, 12)),
            pace=round(random.uniform(96, 104), 1),
        )

        return TeamBoxScore(
            team_id=team.id,
            player_stats=player_stats_list,
            team_stats=team_stats,
        )

    def distribute_stats(
        self, players: list[Player], team_score: int
    ) -> list[dict]:
        sorted_players = sorted(
            players, key=lambda p: p.ratings.overall, reverse=True
        )
        result: list[dict] = []

        for i, p in enumerate(sorted_players):
            if i < 5:
                minutes = random.uniform(28, 36)
            elif i < 10:
                minutes = random.uniform(12, 24)
            else:
                minutes = random.uniform(0, 8)
            result.append({
                "player_id": p.id,
                "minutes": round(minutes, 1),
                "_overall": p.ratings.overall,
                "_player": p,
            })

        weights = [d["_overall"] * d["minutes"] for d in result]
        total_weight = sum(weights) or 1.0
        remaining = team_score
        for i, d in enumerate(result):
            if i == len(result) - 1:
                d["points"] = max(0, remaining)
            else:
                share = (weights[i] / total_weight) * team_score
                pts = max(0, int(share + random.gauss(0, 2)))
                pts = min(pts, remaining)
                d["points"] = pts
                remaining -= pts

        for d in result:
            pts = d["points"]
            if pts == 0 or d["minutes"] < 1:
                d.update({
                    "field_goals_attempted": 0, "field_goals_made": 0,
                    "three_pointers_attempted": 0, "three_pointers_made": 0,
                    "free_throws_attempted": 0, "free_throws_made": 0,
                })
                continue

            fta = max(0, int(pts * 0.25 + random.gauss(0, 1)))
            ftm = max(0, min(fta, int(fta * 0.77 + random.gauss(0, 0.5))))
            field_pts = max(0, pts - ftm)
            fga = max(1, int(field_pts / 1.05 + random.gauss(0, 1)))
            fgm = max(0, min(fga, int(fga * 0.45 + random.gauss(0, 1))))
            tpa = max(0, min(fga, int(fga * 0.35 + random.gauss(0, 1))))
            tpm = max(0, min(tpa, min(fgm, int(tpa * 0.36 + random.gauss(0, 0.5)))))

            d.update({
                "field_goals_attempted": fga, "field_goals_made": fgm,
                "three_pointers_attempted": tpa, "three_pointers_made": tpm,
                "free_throws_attempted": fta, "free_throws_made": ftm,
            })

        reb_weights = []
        for d in result:
            p = d["_player"]
            w = (p.ratings.rebounding * 0.6 + p.bio.height * 0.4) * (d["minutes"] / 48.0)
            reb_weights.append(max(w, 0.01))
        total_rw = sum(reb_weights)
        for i, d in enumerate(result):
            rebs = max(0, int((reb_weights[i] / total_rw) * 44 + random.gauss(0, 1)))
            d["offensive_rebounds"] = max(0, int(rebs * 0.27))
            d["defensive_rebounds"] = rebs - d["offensive_rebounds"]

        ast_weights = []
        for d in result:
            p = d["_player"]
            ast_weights.append(max(p.ratings.passing_vision * (d["minutes"] / 48.0), 0.01))
        total_aw = sum(ast_weights)
        for i, d in enumerate(result):
            d["assists"] = max(
                0, int((ast_weights[i] / total_aw) * 24 + random.gauss(0, 1))
            )

        stl_weights = []
        for d in result:
            p = d["_player"]
            stl_weights.append(max(p.ratings.stealing * (d["minutes"] / 48.0), 0.01))
        total_sw = sum(stl_weights)
        for i, d in enumerate(result):
            d["steals"] = max(
                0, int((stl_weights[i] / total_sw) * 7 + random.gauss(0, 0.5))
            )

        blk_weights = []
        for d in result:
            p = d["_player"]
            blk_weights.append(max(p.ratings.shot_blocking * (d["minutes"] / 48.0), 0.01))
        total_bw = sum(blk_weights)
        for i, d in enumerate(result):
            d["blocks"] = max(
                0, int((blk_weights[i] / total_bw) * 5 + random.gauss(0, 0.5))
            )

        total_min = sum(d["minutes"] for d in result) or 1.0
        for d in result:
            share = (d["minutes"] / total_min) * 14
            d["turnovers"] = max(0, int(share + random.gauss(0, 0.5)))

        for d in result:
            d.pop("_overall", None)
            d.pop("_player", None)

        return result

    def _split_score_into_quarters(self, total: int) -> list[int]:
        quarters: list[int] = []
        remaining = total
        for i in range(3):
            base = remaining / (4 - i)
            q = max(15, int(base + random.gauss(0, 3)))
            q = min(q, remaining)
            quarters.append(q)
            remaining -= q
        quarters.append(max(0, remaining))
        return quarters


def _weighted_choice(items: list, weights: list[float]):
    total = sum(weights)
    if total <= 0:
        return random.choice(items)
    r = random.random() * total
    cumulative = 0.0
    for i, w in enumerate(weights):
        cumulative += w
        if r <= cumulative:
            return items[i]
    return items[-1]
