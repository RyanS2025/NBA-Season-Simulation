from __future__ import annotations

from dataclasses import dataclass, field
from ..models.player import Player
from ..models.team import Team
from ..models.game import GameState, GameContext, PlayerGameStats


@dataclass
class GamePlan:
    offensive_scheme: str = "motion"
    defensive_scheme: str = "man_to_man"
    pace: str = "normal"
    three_point_rate: float = 1.0
    post_up_rate: float = 1.0
    iso_rate: float = 1.0
    transition_rate: float = 1.0
    double_team_star: bool = False
    target_player_id: str | None = None
    deny_player_id: str | None = None


@dataclass
class RotationPlan:
    starters: list[str] = field(default_factory=list)
    rotation_order: list[list[str]] = field(default_factory=list)
    minutes_target: dict[str, float] = field(default_factory=dict)
    sub_patterns: list[dict] = field(default_factory=list)


@dataclass
class InGameAdjustment:
    adjustment_type: str = ""
    description: str = ""
    trigger: str = ""
    new_value: str = ""


class CoachAI:
    """Coaching AI with in-game adjustments, series adaptations, and matchup hunting."""

    def __init__(self, team: Team, players: list[Player]):
        self.team = team
        self.players = players
        self.game_plan = GamePlan()
        self.rotation = RotationPlan()
        self._adjustments_made: list[InGameAdjustment] = []
        self._series_history: list[dict] = []
        self._opponent_tendencies: dict[str, float] = {}

    def prepare_game_plan(
        self,
        opponent: Team,
        opponent_players: list[Player],
        context: GameContext,
        series_history: list[dict] | None = None,
    ) -> GamePlan:
        """Build a full game plan based on opponent scouting and series context."""
        plan = GamePlan()

        plan.offensive_scheme = self._choose_offensive_scheme(opponent_players)
        plan.defensive_scheme = self._choose_defensive_scheme(opponent_players)
        plan.pace = self._choose_pace(opponent_players)

        opp_best = max(opponent_players, key=lambda p: p.ratings.overall)
        if opp_best.ratings.overall >= 90:
            best_defenders = sorted(
                self.players,
                key=lambda p: p.ratings.perimeter_defense + p.ratings.interior_defense,
                reverse=True,
            )
            if best_defenders:
                plan.deny_player_id = opp_best.id
                if opp_best.ratings.overall >= 94:
                    plan.double_team_star = True

        our_best = max(self.players, key=lambda p: p.ratings.overall)
        if our_best.ratings.overall >= 85:
            plan.target_player_id = our_best.id

        if series_history:
            plan = self._apply_series_adjustments(plan, series_history, opponent_players)

        three_shooters = sum(
            1 for p in self.players[:8] if p.ratings.three_point >= 78
        )
        plan.three_point_rate = 0.8 + three_shooters * 0.06

        bigs_with_post = [
            p for p in self.players[:8]
            if p.bio.position in ("C", "PF") and p.ratings.post_game >= 75
        ]
        if bigs_with_post:
            opp_interior = max(
                (p.ratings.interior_defense for p in opponent_players[:5]), default=70
            )
            if opp_interior < 75:
                plan.post_up_rate = 1.3

        self.game_plan = plan
        return plan

    def set_starting_lineup(
        self,
        context: GameContext | None = None,
        opponent_players: list[Player] | None = None,
    ) -> list[str]:
        """Choose starting 5 with position balance and matchup consideration."""
        healthy = [p for p in self.players if p.status.health == "healthy"]
        healthy.sort(key=lambda p: p.ratings.overall, reverse=True)

        starters: list[Player] = []
        positions_filled: dict[str, bool] = {
            "PG": False, "SG": False, "SF": False, "PF": False, "C": False
        }

        for p in healthy:
            pos = p.bio.position
            if not positions_filled.get(pos, True):
                starters.append(p)
                positions_filled[pos] = True
            if len(starters) >= 5:
                break

        for p in healthy:
            if p in starters:
                continue
            if len(starters) >= 5:
                break
            unfilled = [pos for pos, filled in positions_filled.items() if not filled]
            if unfilled:
                starters.append(p)
                positions_filled[unfilled[0]] = True
            elif len(starters) < 5:
                starters.append(p)

        self.rotation.starters = [p.id for p in starters[:5]]
        return self.rotation.starters

    def set_rotation(self, is_playoff: bool = False) -> dict[str, float]:
        """Build minute allocations for the rotation."""
        sorted_players = sorted(
            [p for p in self.players if p.status.health == "healthy"],
            key=lambda p: p.ratings.overall,
            reverse=True,
        )

        if is_playoff:
            templates = [40, 38, 36, 28, 24, 18, 14, 10, 0, 0]
        else:
            templates = [34, 33, 32, 30, 28, 22, 18, 14, 10, 6]

        rotation: dict[str, float] = {}
        for i, p in enumerate(sorted_players):
            if i < len(templates):
                base = float(templates[i])
            else:
                base = 0.0

            age = p.bio.age
            if age >= 35:
                base *= 0.88
            elif age >= 33:
                base *= 0.93

            rotation[p.id] = round(base, 1)

        total = sum(rotation.values())
        if total > 0:
            factor = 240.0 / total
            rotation = {pid: round(mins * factor, 1) for pid, mins in rotation.items()}

        self.rotation.minutes_target = rotation
        return rotation

    def decide_substitution(
        self,
        on_court: list[Player],
        bench: list[Player],
        player_stats: dict[str, PlayerGameStats],
        quarter: int,
        game_clock: float,
        score_diff: int,
        is_playoff: bool = False,
    ) -> list[tuple[str, str]]:
        """Decide substitutions based on fatigue, fouls, matchups, and game state."""
        subs: list[tuple[str, str]] = []
        used_bench: set[str] = set()

        is_garbage = self._is_garbage_time(score_diff, quarter, game_clock)

        for player in on_court:
            if len(subs) >= 2:
                break

            stats = player_stats.get(player.id)
            fouls = stats.personal_fouls if stats else 0
            minutes = stats.minutes if stats else 0.0

            needs_sub = False
            reason = ""

            fatigue_threshold = 0.80 if is_playoff else 0.72
            if player.ratings.overall >= 93:
                fatigue_threshold += 0.05
            if player.status.fatigue > fatigue_threshold:
                needs_sub = True
                reason = "fatigue"

            if fouls >= 6:
                needs_sub = True
                reason = "fouled_out"
            elif fouls >= 5 and quarter <= 3:
                if not (player.ratings.overall >= 93 and quarter == 3):
                    needs_sub = True
                    reason = "foul_trouble"
            elif fouls >= 4 and quarter <= 2:
                if player.ratings.overall < 88:
                    needs_sub = True
                    reason = "foul_trouble"
            elif fouls >= 3 and quarter == 1:
                needs_sub = True
                reason = "foul_trouble"

            if is_garbage and player.ratings.overall >= 85:
                needs_sub = True
                reason = "garbage_time"

            target_mins = self.rotation.minutes_target.get(player.id, 30.0)
            if not is_playoff and minutes >= target_mins * 0.90:
                needs_sub = True
                reason = "minutes_limit"

            if not needs_sub:
                continue

            best_sub = self._find_best_substitute(
                player, bench, used_bench, reason, is_garbage
            )
            if best_sub:
                subs.append((player.id, best_sub.id))
                used_bench.add(best_sub.id)

        return subs

    def make_in_game_adjustment(
        self,
        game_state: GameState,
        player_stats: dict[str, PlayerGameStats],
        opponent_run: int,
    ) -> list[InGameAdjustment]:
        """Make tactical adjustments based on game flow."""
        adjustments: list[InGameAdjustment] = []
        score_diff = game_state.home_score - game_state.away_score
        if game_state.possession_team == "away":
            score_diff = -score_diff

        if opponent_run >= 8:
            if self.game_plan.defensive_scheme == "man_to_man":
                self.game_plan.defensive_scheme = "zone_2_3"
                adjustments.append(InGameAdjustment(
                    "defense", "Switch to zone to stop opponent run",
                    f"opponent {opponent_run}-0 run", "zone_2_3",
                ))
            self.game_plan.pace = "slow"
            adjustments.append(InGameAdjustment(
                "pace", "Slow down to reset", f"opponent run", "slow",
            ))

        if score_diff <= -12 and game_state.quarter >= 3:
            self.game_plan.pace = "push"
            self.game_plan.three_point_rate = 1.4
            adjustments.append(InGameAdjustment(
                "offense", "Push pace and shoot threes to come back",
                f"down {abs(score_diff)}", "push_pace_threes",
            ))

        if score_diff >= 15 and game_state.quarter >= 3:
            self.game_plan.pace = "slow"
            self.game_plan.three_point_rate = 0.8
            self.game_plan.post_up_rate = 1.3
            adjustments.append(InGameAdjustment(
                "offense", "Slow pace and work inside to burn clock",
                f"up {score_diff}", "milk_clock",
            ))

        if game_state.quarter == 4 and game_state.game_clock <= 300:
            if abs(score_diff) <= 5:
                self.game_plan.offensive_scheme = "isolation"
                self.game_plan.defensive_scheme = "man_to_man"
                adjustments.append(InGameAdjustment(
                    "crunch_time", "Go to best player in isolation, tighten defense",
                    "close game Q4", "crunch_time_mode",
                ))

        opp_fouls = (
            game_state.home_fouls_quarter
            if game_state.possession_team == "away"
            else game_state.away_fouls_quarter
        )
        if opp_fouls >= 4:
            self.game_plan.iso_rate = 1.4
            adjustments.append(InGameAdjustment(
                "offense", "Attack the basket to get to the line",
                f"opponent in bonus ({opp_fouls} fouls)", "attack_basket",
            ))

        self._adjustments_made.extend(adjustments)
        return adjustments

    def should_call_timeout(
        self,
        score_diff: int,
        opponent_run: int,
        quarter: int,
        game_clock: float,
        team_side: str,
        timeouts_remaining: int,
    ) -> bool:
        """Decide whether to call a timeout."""
        if timeouts_remaining <= 0:
            return False

        if opponent_run >= 7:
            return True

        if opponent_run >= 5 and quarter >= 3:
            return True

        if quarter == 4 and game_clock <= 120:
            if abs(score_diff) <= 5:
                return True

        if quarter == 4 and game_clock <= 30:
            if score_diff > 0 and score_diff <= 3:
                return True

        if quarter == 4 and score_diff <= -18 and timeouts_remaining >= 3:
            return False

        return False

    def get_defensive_assignments(
        self,
        defenders: list[Player],
        offensive_players: list[Player],
    ) -> dict[str, str]:
        """Assign each defender to an offensive player based on scheme and matchups."""
        scheme = self.game_plan.defensive_scheme

        if scheme in ("zone_2_3", "zone_3_2"):
            return self._zone_assignments(defenders)

        if scheme == "switching":
            return self._switching_assignments(defenders, offensive_players)

        return self._man_assignments(defenders, offensive_players)

    def _man_assignments(
        self, defenders: list[Player], attackers: list[Player]
    ) -> dict[str, str]:
        """Optimal man-to-man assignment via greedy cost matching."""
        assignments: dict[str, str] = {}
        assigned_attackers: set[str] = set()

        deny_id = self.game_plan.deny_player_id
        if deny_id:
            target = next((a for a in attackers if a.id == deny_id), None)
            if target:
                best_defender = max(
                    defenders,
                    key=lambda d: (
                        d.ratings.perimeter_defense * 0.5
                        + d.ratings.lateral_quickness * 0.3
                        + d.ratings.stealing * 0.2
                    ),
                )
                assignments[best_defender.id] = target.id
                assigned_attackers.add(target.id)

        remaining_defenders = [d for d in defenders if d.id not in assignments]
        remaining_attackers = [a for a in attackers if a.id not in assigned_attackers]

        for defender in remaining_defenders:
            if not remaining_attackers:
                break
            best_match = min(
                remaining_attackers,
                key=lambda a: self._matchup_cost(defender, a),
            )
            assignments[defender.id] = best_match.id
            remaining_attackers.remove(best_match)

        return assignments

    def _switching_assignments(
        self, defenders: list[Player], attackers: list[Player]
    ) -> dict[str, str]:
        """Switching defense: assign by lateral quickness ranking."""
        sorted_def = sorted(
            defenders,
            key=lambda d: d.ratings.lateral_quickness + d.ratings.perimeter_defense,
            reverse=True,
        )
        sorted_att = sorted(
            attackers,
            key=lambda a: a.ratings.ball_handling + a.ratings.speed,
            reverse=True,
        )
        assignments: dict[str, str] = {}
        for d, a in zip(sorted_def, sorted_att):
            assignments[d.id] = a.id
        return assignments

    def _zone_assignments(self, defenders: list[Player]) -> dict[str, str]:
        """Zone assignments return zone areas instead of player IDs."""
        zones = ["top_left", "top_right", "bottom_left", "bottom_right", "middle"]
        sorted_def = sorted(
            defenders,
            key=lambda d: d.ratings.interior_defense + d.ratings.shot_blocking,
            reverse=True,
        )
        assignments: dict[str, str] = {}
        for i, d in enumerate(sorted_def[:5]):
            if i == 0:
                assignments[d.id] = "middle"
            else:
                assignments[d.id] = zones[i]
        return assignments

    def _matchup_cost(self, defender: Player, attacker: Player) -> float:
        """Lower cost = better matchup for the defender."""
        position_map = {"PG": 1, "SG": 2, "SF": 3, "PF": 4, "C": 5}
        pos_diff = abs(
            position_map.get(defender.bio.position, 3)
            - position_map.get(attacker.bio.position, 3)
        )
        pos_cost = pos_diff * 15

        height_diff = attacker.bio.height - defender.bio.height
        height_cost = max(0, height_diff) * 3

        speed_diff = attacker.ratings.speed - defender.ratings.lateral_quickness
        speed_cost = max(0, speed_diff) * 0.5

        strength_diff = attacker.ratings.strength - defender.ratings.strength
        strength_cost = max(0, strength_diff) * 0.3

        skill_gap = attacker.ratings.overall - (
            defender.ratings.perimeter_defense * 0.4
            + defender.ratings.interior_defense * 0.3
            + defender.ratings.defensive_iq * 0.3
        )
        skill_cost = max(0, skill_gap) * 0.4

        return pos_cost + height_cost + speed_cost + strength_cost + skill_cost

    def _choose_offensive_scheme(self, opponent_players: list[Player]) -> str:
        top3 = sorted(self.players, key=lambda p: p.ratings.overall, reverse=True)[:3]

        avg_bh = sum(p.ratings.ball_handling for p in top3) / max(len(top3), 1)
        avg_post = sum(p.ratings.post_game for p in top3) / max(len(top3), 1)
        avg_speed = sum(p.ratings.speed for p in top3) / max(len(top3), 1)
        avg_passing = sum(p.ratings.passing_vision for p in top3) / max(len(top3), 1)

        opp_def = sum(p.ratings.perimeter_defense for p in opponent_players[:5]) / 5
        opp_interior = sum(p.ratings.interior_defense for p in opponent_players[:5]) / 5

        scores = {
            "motion": avg_passing * 0.4 + avg_bh * 0.3 + 50 * 0.3,
            "isolation": avg_bh * 0.5 + top3[0].ratings.overall * 0.3 + (100 - opp_def) * 0.2,
            "pick_and_roll_heavy": avg_bh * 0.3 + avg_speed * 0.3 + (100 - opp_def) * 0.4,
            "post_up_heavy": avg_post * 0.5 + (100 - opp_interior) * 0.5,
            "fast_break": avg_speed * 0.5 + avg_passing * 0.3 + 40 * 0.2,
        }

        return max(scores, key=scores.get)  # type: ignore[arg-type]

    def _choose_defensive_scheme(self, opponent_players: list[Player]) -> str:
        top5 = sorted(self.players, key=lambda p: p.ratings.overall, reverse=True)[:5]

        avg_lateral = sum(p.ratings.lateral_quickness for p in top5) / 5
        avg_interior = sum(p.ratings.interior_defense for p in top5) / 5

        versatile_count = sum(
            1 for p in top5
            if p.ratings.perimeter_defense > 65 and p.ratings.interior_defense > 60
        )

        opp_three_shooters = sum(
            1 for p in opponent_players[:8] if p.ratings.three_point >= 80
        )

        if versatile_count >= 3 and avg_lateral > 72:
            return "switching"
        if opp_three_shooters <= 1 and avg_interior > 75:
            return "zone_2_3"
        return "man_to_man"

    def _choose_pace(self, opponent_players: list[Player]) -> str:
        our_speed = sum(
            p.ratings.speed for p in sorted(
                self.players, key=lambda p: p.ratings.overall, reverse=True
            )[:5]
        ) / 5
        opp_speed = sum(p.ratings.speed for p in opponent_players[:5]) / 5

        if self.team.coaching and self.team.coaching.pace_preference > 65:
            return "push"
        if self.team.coaching and self.team.coaching.pace_preference < 35:
            return "slow"
        if our_speed > opp_speed + 8:
            return "push"
        if our_speed < opp_speed - 8:
            return "slow"
        return "normal"

    def _apply_series_adjustments(
        self,
        plan: GamePlan,
        series_history: list[dict],
        opponent_players: list[Player],
    ) -> GamePlan:
        """Adjust game plan based on what happened earlier in a playoff series."""
        losses = [g for g in series_history if not g.get("won", True)]

        if not losses:
            return plan

        opp_avg_paint = sum(g.get("opp_paint_points", 0) for g in losses) / max(len(losses), 1)
        if opp_avg_paint > 50:
            plan.defensive_scheme = "zone_2_3"

        opp_avg_three = sum(g.get("opp_three_made", 0) for g in losses) / max(len(losses), 1)
        if opp_avg_three > 14:
            plan.defensive_scheme = "switching"

        opp_star_ppg = max(
            (g.get("opp_star_points", 0) for g in losses), default=0
        )
        if opp_star_ppg > 35:
            plan.double_team_star = True

        return plan

    def _find_best_substitute(
        self,
        player_out: Player,
        bench: list[Player],
        used: set[str],
        reason: str,
        is_garbage: bool,
    ) -> Player | None:
        """Find the best available bench player to substitute in."""
        available = [
            p for p in bench
            if p.id not in used and p.status.health == "healthy"
        ]
        if not available:
            return None

        if is_garbage:
            return min(available, key=lambda p: p.ratings.overall)

        def score(candidate: Player) -> float:
            pos_match = 15 if candidate.bio.position == player_out.bio.position else 0
            freshness = (1.0 - candidate.status.fatigue) * 10
            skill = candidate.ratings.overall * 0.5
            return pos_match + freshness + skill

        return max(available, key=score)

    def _is_garbage_time(
        self, score_diff: int, quarter: int, game_clock: float
    ) -> bool:
        if quarter == 4 and abs(score_diff) >= 25:
            return True
        if quarter == 4 and game_clock < 180 and abs(score_diff) >= 20:
            return True
        if quarter == 4 and game_clock < 120 and abs(score_diff) >= 15:
            return True
        return False

    def get_play_call(
        self,
        ball_handler: Player,
        lineup: list[Player],
        game_state: GameState,
        momentum: float = 0.0,
    ) -> dict:
        """Choose play type based on game plan, lineup, and situation."""
        plan = self.game_plan
        score_diff = game_state.home_score - game_state.away_score
        if game_state.possession_team == "away":
            score_diff = -score_diff

        play_weights = {
            "isolation": ball_handler.tendencies.iso_frequency * plan.iso_rate,
            "pick_and_roll": ball_handler.tendencies.pick_and_roll_ball_handler,
            "spot_up": ball_handler.tendencies.spot_up_frequency * plan.three_point_rate,
            "post_up": ball_handler.tendencies.post_up_frequency * plan.post_up_rate,
            "transition": ball_handler.tendencies.transition_frequency * plan.transition_rate,
            "cut": ball_handler.tendencies.cut_frequency,
            "catch_and_shoot": ball_handler.tendencies.catch_and_shoot_frequency * plan.three_point_rate,
        }

        if game_state.is_transition:
            play_weights["transition"] *= 3.0
            play_weights["cut"] *= 1.5

        if game_state.quarter == 4 and game_state.game_clock <= 120:
            if abs(score_diff) <= 5:
                play_weights["isolation"] *= 2.0
                play_weights["pick_and_roll"] *= 1.5
                play_weights["transition"] *= 0.5

        if plan.target_player_id and ball_handler.id == plan.target_player_id:
            play_weights["isolation"] *= 1.5
            play_weights["pick_and_roll"] *= 1.3

        if game_state.game_clock <= 5:
            play_weights["isolation"] *= 3.0

        screeners = [
            p for p in lineup
            if p.id != ball_handler.id
            and p.tendencies.pick_and_roll_screener > 60
        ]
        if not screeners:
            play_weights["pick_and_roll"] *= 0.3

        return play_weights

    def end_of_quarter_management(
        self, game_clock: float, shot_clock: float, quarter: int
    ) -> dict:
        """Handle end-of-quarter strategy."""
        result = {
            "go_for_two_for_one": False,
            "is_last_shot": False,
            "hold_for_last_shot": False,
        }

        if game_clock <= shot_clock:
            result["is_last_shot"] = True

        if 30 <= game_clock <= 40 and shot_clock >= 20:
            result["go_for_two_for_one"] = True

        if quarter == 4 and game_clock <= 24:
            result["hold_for_last_shot"] = True

        return result
