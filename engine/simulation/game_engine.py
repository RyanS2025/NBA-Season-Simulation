from __future__ import annotations

import random
from ..models.player import Player
from ..models.team import Team
from ..models.game import (
    GameResult, GameState, GameContext,
    TeamBoxScore, TeamGameStats, PlayerGameStats,
)
from ..models.league import LeagueSettings
from .possession import PossessionEngine
from .fatigue import FatigueSystem
from .injury import InjurySystem
from .matchups import MatchupEngine
from .momentum import MomentumEngine
from .chemistry import ChemistryEngine
from ..ai.coach_ai import CoachAI
from .shot_selection import ShotSelector


class GameEngine:
    """Full game simulation with all subsystems integrated."""

    def __init__(
        self,
        home_team: Team,
        away_team: Team,
        home_players: list[Player],
        away_players: list[Player],
        home_context: GameContext | None = None,
        away_context: GameContext | None = None,
        familiarity: dict[tuple[str, str], float] | None = None,
        settings: LeagueSettings | None = None,
        is_playoff: bool = False,
        series_history: list[dict] | None = None,
    ):
        self.home_team = home_team
        self.away_team = away_team
        self.home_players = home_players
        self.away_players = away_players
        self.home_context = home_context or GameContext()
        self.away_context = away_context or GameContext(is_home=False)
        self.familiarity = familiarity or {}
        self.settings = settings
        self.is_playoff = is_playoff

        self.fatigue_system = FatigueSystem()
        self.matchup_engine = MatchupEngine()
        self.momentum_engine = MomentumEngine(is_playoff=is_playoff)
        self.chemistry_engine = ChemistryEngine()
        self.injury_system = InjurySystem()

        self.possession_engine = PossessionEngine(
            self.fatigue_system,
            self.matchup_engine,
            self.momentum_engine,
            self.chemistry_engine,
        )

        self.home_coach = CoachAI(home_team, home_players)
        self.away_coach = CoachAI(away_team, away_players)

        self.player_stats: dict[str, PlayerGameStats] = {
            p.id: PlayerGameStats(player_id=p.id)
            for p in home_players + away_players
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
        self._home_biggest_run = 0
        self._away_biggest_run = 0
        self._total_possessions = 0
        self._series_history = series_history

    def simulate_full_game(self) -> GameResult:
        """Run a complete game simulation."""
        for p in self.home_players:
            self.fatigue_system.apply_pregame_fatigue(p, self.home_context)
        for p in self.away_players:
            self.fatigue_system.apply_pregame_fatigue(p, self.away_context)

        self.home_coach.prepare_game_plan(
            self.away_team, self.away_players, self.home_context,
            series_history=self._series_history,
        )
        self.away_coach.prepare_game_plan(
            self.home_team, self.home_players, self.away_context,
            series_history=self._series_history,
        )

        home_lineup_ids = self.home_coach.set_starting_lineup(
            self.home_context, self.away_players
        )
        away_lineup_ids = self.away_coach.set_starting_lineup(
            self.away_context, self.home_players
        )
        self._home_starters = list(home_lineup_ids)
        self._away_starters = list(away_lineup_ids)

        self.home_coach.set_rotation(is_playoff=self.is_playoff)
        self.away_coach.set_rotation(is_playoff=self.is_playoff)

        state = GameState(
            possession_team=random.choice(["home", "away"]),
            home_lineup=home_lineup_ids,
            away_lineup=away_lineup_ids,
            is_playoff=self.is_playoff,
        )

        for q in range(1, 5):
            state.game_clock = 720.0
            state.home_fouls_quarter = 0
            state.away_fouls_quarter = 0
            h_before = state.home_score
            a_before = state.away_score
            state = self._simulate_quarter(state, q)
            self.quarter_scores["home"].append(state.home_score - h_before)
            self.quarter_scores["away"].append(state.away_score - a_before)

        ot_count = 0
        while state.home_score == state.away_score and ot_count < 6:
            state.game_clock = 300.0
            state.home_fouls_quarter = 0
            state.away_fouls_quarter = 0
            h_before = state.home_score
            a_before = state.away_score
            state.quarter = 4 + ot_count + 1
            state = self._simulate_quarter(state, state.quarter)
            self.quarter_scores["home"].append(state.home_score - h_before)
            self.quarter_scores["away"].append(state.away_score - a_before)
            ot_count += 1

        if state.home_score == state.away_score:
            if random.random() < 0.5:
                state.home_score += 1
            else:
                state.away_score += 1

        self._total_possessions = state.possession_count

        home_box = self._compile_box_score(self.home_team.id)
        away_box = self._compile_box_score(self.away_team.id)

        winning_team_id = (
            self.home_team.id
            if state.home_score > state.away_score
            else self.away_team.id
        )

        return GameResult(
            home_score=state.home_score,
            away_score=state.away_score,
            overtime=ot_count,
            winning_team_id=winning_team_id,
            home_box_score=home_box,
            away_box_score=away_box,
            quarter_scores=self.quarter_scores,
            lead_changes=state.lead_changes,
            times_tied=state.times_tied,
            home_biggest_run=self._home_biggest_run,
            away_biggest_run=self._away_biggest_run,
        )

    def _simulate_quarter(self, state: GameState, quarter: int) -> GameState:
        state.quarter = quarter

        while state.game_clock > 0:
            is_home_poss = state.possession_team == "home"

            if is_home_poss:
                offense = [self._player_map[pid] for pid in state.home_lineup]
                defense = [self._player_map[pid] for pid in state.away_lineup]
                coach = self.home_coach
                opp_coach = self.away_coach
            else:
                offense = [self._player_map[pid] for pid in state.away_lineup]
                defense = [self._player_map[pid] for pid in state.home_lineup]
                coach = self.away_coach
                opp_coach = self.home_coach

            assignments = self.matchup_engine.calculate_assignments(
                offense, defense, coach.game_plan.defensive_scheme
            )

            chem_mods = self.chemistry_engine.get_chemistry_modifiers(
                offense, self.familiarity
            )

            spacing = self.matchup_engine.calculate_floor_spacing(offense)

            play_weights = coach.get_play_call(
                offense[0], offense, state,
                momentum=self.momentum_engine.get_momentum(
                    "home" if is_home_poss else "away"
                ),
            )

            if coach.game_plan.target_player_id:
                play_weights["_target_player_id"] = coach.game_plan.target_player_id

            opp_run = state.away_run if is_home_poss else state.home_run
            if self._should_timeout(state, coach, opp_coach, opp_run, is_home_poss):
                self.momentum_engine.call_timeout(
                    "home" if is_home_poss else "away"
                )

            coach.make_in_game_adjustment(state, self.player_stats, opp_run)

            result = self.possession_engine.simulate_possession(
                state, offense, defense, assignments, chem_mods, spacing,
                play_weights, is_home=is_home_poss,
                is_elimination=self.home_context.is_elimination,
            )

            pts = result["points"]
            if is_home_poss:
                state.home_score += pts
            else:
                state.away_score += pts

            self._update_stats(result, offense, defense, state, is_home_poss)
            self._track_runs_and_leads(state, pts, is_home_poss)

            self.momentum_engine.update_after_possession(
                result, "home" if is_home_poss else "away",
                {
                    "quarter": state.quarter,
                    "game_clock": state.game_clock,
                    "home_score": state.home_score,
                    "away_score": state.away_score,
                    "is_playoff": self.is_playoff,
                },
            )

            time_consumed = random.uniform(12, 20)
            state.game_clock -= time_consumed
            state.shot_clock = 24.0
            minutes_consumed = time_consumed / 60.0

            for pid in state.home_lineup:
                self.player_stats[pid].minutes += minutes_consumed
                self.fatigue_system.update_fatigue_possession(
                    self._player_map[pid], is_on_offense=is_home_poss
                )
            for pid in state.away_lineup:
                self.player_stats[pid].minutes += minutes_consumed
                self.fatigue_system.update_fatigue_possession(
                    self._player_map[pid], is_on_offense=(not is_home_poss)
                )

            for p in self.home_players:
                if p.id not in state.home_lineup:
                    self.fatigue_system.recover_fatigue_possession(p)
            for p in self.away_players:
                if p.id not in state.away_lineup:
                    self.fatigue_system.recover_fatigue_possession(p)

            state.possession_count += 1

            if state.possession_count % 3 == 0:
                self._handle_substitutions(state, quarter)

            if result.get("turnover") and result.get("steal"):
                state.is_transition = True
            else:
                state.is_transition = False

            state.last_possession_result = result.get("play_type")
            state.possession_team = "away" if is_home_poss else "home"

            if state.possession_count % 8 == 0:
                self._check_injuries(state, offense + defense)

        return state

    def _should_timeout(
        self,
        state: GameState,
        coach: CoachAI,
        opp_coach: CoachAI,
        opp_run: int,
        is_home_poss: bool,
    ) -> bool:
        score_diff = state.home_score - state.away_score
        if not is_home_poss:
            score_diff = -score_diff

        team_side = "home" if is_home_poss else "away"
        if team_side == "home":
            timeouts = self.momentum_engine.momentum.home_timeouts_remaining
        else:
            timeouts = self.momentum_engine.momentum.away_timeouts_remaining

        return coach.should_call_timeout(
            score_diff, opp_run, state.quarter, state.game_clock,
            team_side, timeouts,
        )

    def _track_runs_and_leads(
        self, state: GameState, pts: int, is_home_poss: bool
    ) -> None:
        if pts > 0:
            if is_home_poss:
                state.home_run += pts
                state.away_run = 0
            else:
                state.away_run += pts
                state.home_run = 0

            if state.home_run > self._home_biggest_run:
                self._home_biggest_run = state.home_run
            if state.away_run > self._away_biggest_run:
                self._away_biggest_run = state.away_run

        lead = state.home_score - state.away_score
        if lead == 0:
            state.times_tied += 1
        elif state.last_lead_team is not None:
            current_leader = "home" if lead > 0 else "away"
            if current_leader != state.last_lead_team:
                state.lead_changes += 1
                state.last_lead_team = current_leader
        if lead != 0:
            state.last_lead_team = "home" if lead > 0 else "away"

        home_lead = state.home_score - state.away_score
        if home_lead > self._home_biggest_lead:
            self._home_biggest_lead = home_lead
        away_lead = -home_lead
        if away_lead > self._away_biggest_lead:
            self._away_biggest_lead = away_lead

    def _handle_substitutions(self, state: GameState, quarter: int) -> None:
        score_diff = state.home_score - state.away_score

        home_on = [self._player_map[pid] for pid in state.home_lineup]
        home_bench = [
            p for p in self.home_players
            if p.id not in state.home_lineup and p.status.health == "healthy"
        ]
        subs = self.home_coach.decide_substitution(
            home_on, home_bench, self.player_stats,
            quarter, state.game_clock, score_diff, self.is_playoff,
        )
        for out_id, in_id in subs:
            state.home_lineup = [
                in_id if pid == out_id else pid for pid in state.home_lineup
            ]

        away_on = [self._player_map[pid] for pid in state.away_lineup]
        away_bench = [
            p for p in self.away_players
            if p.id not in state.away_lineup and p.status.health == "healthy"
        ]
        subs = self.away_coach.decide_substitution(
            away_on, away_bench, self.player_stats,
            quarter, state.game_clock, -score_diff, self.is_playoff,
        )
        for out_id, in_id in subs:
            state.away_lineup = [
                in_id if pid == out_id else pid for pid in state.away_lineup
            ]

    def _check_injuries(
        self, state: GameState, on_court: list[Player]
    ) -> None:
        target = random.choice(on_court)
        injury = self.injury_system.check_injury(target, "")
        if not injury:
            return

        target.status.current_injury = injury
        target.status.health = "injured"

        if target.id in state.home_lineup:
            bench = [
                p for p in self.home_players
                if p.id not in state.home_lineup and p.status.health == "healthy"
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
                if p.id not in state.away_lineup and p.status.health == "healthy"
            ]
            if bench:
                sub = max(bench, key=lambda p: p.ratings.overall)
                state.away_lineup = [
                    sub.id if pid == target.id else pid
                    for pid in state.away_lineup
                ]

    def _update_stats(
        self,
        result: dict,
        offense: list[Player],
        defense: list[Player],
        state: GameState,
        is_home_poss: bool,
    ) -> None:
        pts = result["points"]
        shooter_id = result.get("shooter_id")

        if is_home_poss:
            off_lineup = state.home_lineup
            def_lineup = state.away_lineup
        else:
            off_lineup = state.away_lineup
            def_lineup = state.home_lineup

        if pts > 0:
            for pid in off_lineup:
                self.player_stats[pid].plus_minus += pts
            for pid in def_lineup:
                self.player_stats[pid].plus_minus -= pts

        if result.get("turnover"):
            handler_id = result.get("ball_handler_id")
            if handler_id and handler_id in self.player_stats:
                self.player_stats[handler_id].turnovers += 1
            elif shooter_id and shooter_id in self.player_stats:
                self.player_stats[shooter_id].turnovers += 1
            else:
                handler = random.choice(offense)
                self.player_stats[handler.id].turnovers += 1

            stealer_id = result.get("stealer_id")
            if stealer_id and stealer_id in self.player_stats:
                self.player_stats[stealer_id].steals += 1
            return

        foul_info = result.get("foul")
        if foul_info is not None and shooter_id:
            num_ft = foul_info["free_throws"]
            made_ft = pts
            ps = self.player_stats[shooter_id]
            ps.free_throws_attempted += num_ft
            ps.free_throws_made += made_ft
            ps.points += made_ft

            fouler_id = foul_info.get("defender_id")
            if fouler_id and fouler_id in self.player_stats:
                self.player_stats[fouler_id].personal_fouls += 1
            else:
                fouler = random.choice(defense)
                self.player_stats[fouler.id].personal_fouls += 1

            if is_home_poss:
                state.away_fouls_quarter += 1
            else:
                state.home_fouls_quarter += 1
            return

        shot = result.get("shot_attempt")
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
            base_pts = 3 if is_three else 2
            ps.points += base_pts
            if is_three:
                ps.three_pointers_made += 1
            if shot.is_contested:
                ps.contested_shots_made += 1
                ps.contested_shots_attempted += 1

            if ShotSelector.is_paint_shot(shot.zone_id):
                ps.points_in_paint += base_pts

            if shot.is_clutch:
                ps.clutch_points += base_pts

            if state.is_transition:
                ps.fast_break_points += base_pts

            assist_id = result.get("assist_by")
            if assist_id and assist_id in self.player_stats:
                self.player_stats[assist_id].assists += 1

            if result.get("and_one") and shooter_id in self.player_stats:
                and_one_pts = pts - base_pts
                if and_one_pts > 0:
                    ps.free_throws_attempted += 1
                    ps.free_throws_made += and_one_pts
                    ps.points += and_one_pts
                if is_home_poss:
                    state.away_fouls_quarter += 1
                else:
                    state.home_fouls_quarter += 1
        else:
            if shot.is_contested:
                ps.contested_shots_attempted += 1

            if result.get("block"):
                defender_id = result.get("defender_id")
                if defender_id and defender_id in self.player_stats:
                    self.player_stats[defender_id].blocks += 1

            reb = result.get("rebound")
            if reb:
                rid = reb["rebounder_id"]
                if rid in self.player_stats:
                    if reb["offensive"]:
                        self.player_stats[rid].offensive_rebounds += 1
                    else:
                        self.player_stats[rid].defensive_rebounds += 1

    def _compile_box_score(self, team_id: str) -> TeamBoxScore:
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
        fast_break = 0
        second_chance = 0
        total_assists = 0

        for pid in team_pids:
            ps = self.player_stats[pid]
            ps.total_rebounds = ps.offensive_rebounds + ps.defensive_rebounds
            ps.minutes = round(ps.minutes, 1)
            stats_list.append(ps)
            total_points += ps.points
            total_turnovers += ps.turnovers
            total_assists += ps.assists
            paint_points += ps.points_in_paint
            fast_break += ps.fast_break_points
            if pid not in starters:
                bench_points += ps.points

        stats_list.sort(key=lambda ps: ps.minutes, reverse=True)
        team_rebounds = sum(ps.total_rebounds for ps in stats_list)
        total_minutes = sum(ps.minutes for ps in stats_list)
        game_minutes = total_minutes / 5.0 if total_minutes > 0 else 48.0
        pace = (
            (self._total_possessions / 2.0) / game_minutes * 48.0
            if game_minutes > 0 else 100.0
        )

        possessions = max(self._total_possessions / 2.0, 1.0)
        off_rating = round((total_points / possessions) * 100, 1)

        opp_team_id = (
            self.away_team.id if team_id == self.home_team.id
            else self.home_team.id
        )
        opp_pids = (
            self._away_player_ids if team_id == self.home_team.id
            else self._home_player_ids
        )
        opp_pts = sum(self.player_stats[pid].points for pid in opp_pids)
        def_rating = round((opp_pts / possessions) * 100, 1)

        pts_off_to = 0
        for pid in opp_pids:
            pts_off_to += self.player_stats[pid].turnovers
        pts_off_to = int(pts_off_to * 1.1)

        team_stats = TeamGameStats(
            fast_break_points=fast_break,
            points_in_paint=paint_points,
            second_chance_points=int(total_points * 0.10),
            bench_points=bench_points,
            turnovers=total_turnovers,
            team_rebounds=team_rebounds,
            biggest_lead=biggest_lead,
            pace=round(pace, 1),
            points_off_turnovers=pts_off_to,
            assists=total_assists,
            biggest_run=(
                self._home_biggest_run if team_id == self.home_team.id
                else self._away_biggest_run
            ),
            lead_changes=0,
            times_tied=0,
            offensive_rating=off_rating,
            defensive_rating=def_rating,
        )

        return TeamBoxScore(
            team_id=team_id,
            player_stats=stats_list,
            team_stats=team_stats,
        )


class FastSimEngine:
    """Lightweight game simulation for non-watched games."""

    def __init__(
        self,
        home_team: Team,
        away_team: Team,
        home_players: list[Player],
        away_players: list[Player],
        home_context: GameContext | None = None,
        away_context: GameContext | None = None,
        settings: LeagueSettings | None = None,
    ):
        self.home_team = home_team
        self.away_team = away_team
        self.home_players = home_players
        self.away_players = away_players
        self.home_context = home_context or GameContext()
        self.away_context = away_context or GameContext(is_home=False)
        self.settings = settings

    def simulate_game(self) -> GameResult:
        home_str = self._team_strength(self.home_players, self.home_context)
        away_str = self._team_strength(self.away_players, self.away_context)

        base_score = 110
        home_advantage = 3.0
        home_mod = (home_str - 0.5) * 15
        away_mod = (away_str - 0.5) * 15

        home_score = int(
            random.gauss(base_score + home_advantage + home_mod, 11)
        )
        away_score = int(random.gauss(base_score + away_mod, 11))
        home_score = max(85, min(145, home_score))
        away_score = max(85, min(145, away_score))

        ot = 0
        while home_score == away_score:
            ot += 1
            home_score += random.randint(2, 8)
            away_score += random.randint(2, 8)
            if ot > 4:
                if random.random() < 0.5:
                    home_score += 1
                else:
                    away_score += 1

        quarter_scores = {
            "home": self._split_score(home_score),
            "away": self._split_score(away_score),
        }

        home_box = self._generate_box(
            self.home_team, self.home_players, home_score, away_score
        )
        away_box = self._generate_box(
            self.away_team, self.away_players, away_score, home_score
        )

        winning_team_id = (
            self.home_team.id if home_score > away_score
            else self.away_team.id
        )

        return GameResult(
            home_score=home_score,
            away_score=away_score,
            overtime=ot,
            winning_team_id=winning_team_id,
            home_box_score=home_box,
            away_box_score=away_box,
            quarter_scores=quarter_scores,
        )

    def _team_strength(
        self, players: list[Player], context: GameContext
    ) -> float:
        healthy = [p for p in players if p.status.health == "healthy"]
        healthy.sort(key=lambda p: p.ratings.overall, reverse=True)
        top_8 = healthy[:8]
        if not top_8:
            return 0.0

        weights = [1.5, 1.3, 1.2, 1.0, 1.0, 0.8, 0.7, 0.6]
        total = sum(
            p.ratings.overall * weights[i]
            for i, p in enumerate(top_8)
        )
        avg = total / sum(weights[:len(top_8)])
        base = max(0.0, min(1.0, (avg - 65) / 35))

        fatigue_penalty = 0.0
        if context.is_second_of_back_to_back:
            fatigue_penalty = 0.04
        elif context.is_back_to_back:
            fatigue_penalty = 0.02

        if context.travel_distance > 2000:
            fatigue_penalty += 0.02
        if context.altitude_game:
            fatigue_penalty += 0.01

        return max(0.0, base - fatigue_penalty)

    def _generate_box(
        self,
        team: Team,
        players: list[Player],
        team_score: int,
        opp_score: int,
    ) -> TeamBoxScore:
        stat_dicts = self._distribute_stats(players, team_score)
        player_stats: list[PlayerGameStats] = []
        bench_points = 0
        total_to = 0
        total_reb = 0
        total_ast = 0

        for i, sd in enumerate(stat_dicts):
            oreb = sd["offensive_rebounds"]
            dreb = sd["defensive_rebounds"]
            ps = PlayerGameStats(
                player_id=sd["player_id"],
                minutes=sd["minutes"],
                points=sd["points"],
                field_goals_made=sd["fgm"],
                field_goals_attempted=sd["fga"],
                three_pointers_made=sd["tpm"],
                three_pointers_attempted=sd["tpa"],
                free_throws_made=sd["ftm"],
                free_throws_attempted=sd["fta"],
                offensive_rebounds=oreb,
                defensive_rebounds=dreb,
                total_rebounds=oreb + dreb,
                assists=sd["assists"],
                steals=sd["steals"],
                blocks=sd["blocks"],
                turnovers=sd["turnovers"],
                personal_fouls=random.randint(1, 4),
                plus_minus=int(
                    (team_score - opp_score) * sd["minutes"] / 48.0
                    + random.gauss(0, 3)
                ),
            )
            player_stats.append(ps)
            if i >= 5:
                bench_points += sd["points"]
            total_to += sd["turnovers"]
            total_reb += oreb + dreb
            total_ast += sd["assists"]

        diff = team_score - opp_score
        team_stats = TeamGameStats(
            fast_break_points=int(team_score * 0.14),
            points_in_paint=int(team_score * 0.46),
            second_chance_points=int(team_score * 0.10),
            bench_points=bench_points,
            turnovers=total_to,
            team_rebounds=total_reb,
            biggest_lead=max(0, diff + random.randint(0, 12)),
            pace=round(random.uniform(96, 104), 1),
            assists=total_ast,
            offensive_rating=round(team_score / 1.0, 1),
            defensive_rating=round(opp_score / 1.0, 1),
        )

        return TeamBoxScore(
            team_id=team.id,
            player_stats=player_stats,
            team_stats=team_stats,
        )

    def _distribute_stats(
        self, players: list[Player], team_score: int
    ) -> list[dict]:
        sorted_p = sorted(
            players, key=lambda p: p.ratings.overall, reverse=True
        )
        result: list[dict] = []

        for i, p in enumerate(sorted_p):
            if i < 5:
                minutes = random.uniform(28, 36)
            elif i < 8:
                minutes = random.uniform(14, 24)
            elif i < 10:
                minutes = random.uniform(6, 14)
            else:
                minutes = random.uniform(0, 6)
            result.append({
                "player_id": p.id,
                "minutes": round(minutes, 1),
                "_ovr": p.ratings.overall,
                "_p": p,
            })

        weights = [d["_ovr"] * d["minutes"] for d in result]
        total_w = sum(weights) or 1.0
        remaining = team_score
        for i, d in enumerate(result):
            if i == len(result) - 1:
                d["points"] = max(0, remaining)
            else:
                share = (weights[i] / total_w) * team_score
                pts = max(0, int(share + random.gauss(0, 2)))
                pts = min(pts, remaining)
                d["points"] = pts
                remaining -= pts

        for d in result:
            pts = d["points"]
            if pts == 0 or d["minutes"] < 1:
                d.update(fgm=0, fga=0, tpm=0, tpa=0, ftm=0, fta=0)
                continue

            fta = max(0, int(pts * 0.25 + random.gauss(0, 1)))
            ftm = max(0, min(fta, int(fta * 0.77 + random.gauss(0, 0.5))))
            field_pts = max(0, pts - ftm)
            fga = max(1, int(field_pts / 1.05 + random.gauss(0, 1)))
            fgm = max(0, min(fga, int(fga * 0.46 + random.gauss(0, 1))))
            tpa = max(0, min(fga, int(fga * 0.38 + random.gauss(0, 1))))
            tpm = max(
                0, min(tpa, min(fgm, int(tpa * 0.36 + random.gauss(0, 0.5))))
            )
            d.update(fgm=fgm, fga=fga, tpm=tpm, tpa=tpa, ftm=ftm, fta=fta)

        reb_weights = []
        for d in result:
            p = d["_p"]
            w = (
                p.ratings.rebounding * 0.6 + p.bio.height * 0.4
            ) * (d["minutes"] / 48.0)
            reb_weights.append(max(w, 0.01))
        total_rw = sum(reb_weights)
        for i, d in enumerate(result):
            rebs = max(
                0, int((reb_weights[i] / total_rw) * 44 + random.gauss(0, 1))
            )
            d["offensive_rebounds"] = max(0, int(rebs * 0.27))
            d["defensive_rebounds"] = rebs - d["offensive_rebounds"]

        for stat_name, rating_attr, league_total in [
            ("assists", "passing_vision", 24),
            ("steals", "stealing", 7),
            ("blocks", "shot_blocking", 5),
        ]:
            sw = []
            for d in result:
                p = d["_p"]
                sw.append(
                    max(getattr(p.ratings, rating_attr) * (d["minutes"] / 48.0), 0.01)
                )
            total_sw = sum(sw)
            for i, d in enumerate(result):
                d[stat_name] = max(
                    0,
                    int((sw[i] / total_sw) * league_total + random.gauss(0, 0.5)),
                )

        total_min = sum(d["minutes"] for d in result) or 1.0
        for d in result:
            share = (d["minutes"] / total_min) * 14
            d["turnovers"] = max(0, int(share + random.gauss(0, 0.5)))

        for d in result:
            d.pop("_ovr", None)
            d.pop("_p", None)

        return result

    def _split_score(self, total: int) -> list[int]:
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
