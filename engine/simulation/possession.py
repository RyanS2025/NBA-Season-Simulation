from __future__ import annotations

import random
from ..models.player import Player
from ..models.game import GameState, ShotAttempt
from .shot_selection import ShotSelector, ZONE_BASE_PERCENTAGES
from .fatigue import FatigueSystem
from .matchups import MatchupEngine, FloorSpacing
from .momentum import MomentumEngine, ClutchModifiers
from .chemistry import ChemistryEngine, ChemistryModifiers


class PossessionEngine:
    """Possession-by-possession engine integrating matchups, chemistry,
    momentum, fatigue, and coaching schemes."""

    def __init__(
        self,
        fatigue_system: FatigueSystem,
        matchup_engine: MatchupEngine,
        momentum_engine: MomentumEngine,
        chemistry_engine: ChemistryEngine,
    ):
        self.fatigue = fatigue_system
        self.matchups = matchup_engine
        self.momentum = momentum_engine
        self.chemistry = chemistry_engine

    def simulate_possession(
        self,
        state: GameState,
        offense: list[Player],
        defense: list[Player],
        assignments: dict[str, str],
        chemistry_mods: ChemistryModifiers,
        spacing: FloorSpacing,
        play_weights: dict[str, float],
        is_home: bool,
        is_elimination: bool = False,
    ) -> dict:
        """Simulate one possession with full system integration."""
        score_diff = state.home_score - state.away_score
        if not is_home:
            score_diff = -score_diff

        is_clutch = MomentumEngine.is_clutch_time(
            state.quarter, state.game_clock, score_diff
        )
        is_super_clutch = MomentumEngine.is_super_clutch(
            state.quarter, state.game_clock, score_diff
        )

        ball_handler = self._select_ball_handler(offense, play_weights)
        play_type = self._select_play_type(ball_handler, play_weights)

        clutch_mods = MomentumEngine.get_clutch_modifier(
            ball_handler, is_clutch, is_super_clutch,
            is_elimination=is_elimination,
        )

        to_check = self._check_turnover(
            ball_handler, defense, assignments, chemistry_mods,
            clutch_mods, spacing, state,
        )
        if to_check["turnover"]:
            return to_check

        foul = self._check_foul(ball_handler, defense, assignments, play_type)
        if foul is not None:
            defender_id = foul.get("defender_id")
            ft_result = self._simulate_free_throws(
                ball_handler, foul["free_throws"], is_home, clutch_mods
            )
            return {
                "points": ft_result["points"],
                "shot_attempt": None,
                "turnover": False,
                "foul": foul,
                "rebound": None,
                "assist_by": None,
                "shooter_id": ball_handler.id,
                "defender_id": defender_id,
                "play_type": play_type,
                "steal": False,
                "block": False,
                "and_one": False,
            }

        shooter, assisted, assist_by = self._resolve_shooter(
            ball_handler, offense, play_type, chemistry_mods
        )

        defender = self._get_defender(shooter, defense, assignments)
        selector = ShotSelector(shooter)
        zone_id = selector.select_zone(
            play_type, state.shot_clock, is_contested=(defender is not None)
        )

        probability = self._calculate_shot_probability(
            shooter, zone_id, defender, is_home, play_type,
            chemistry_mods, clutch_mods, spacing, state,
        )

        made = random.random() < probability
        is_three = ShotSelector.is_three_pointer(zone_id)
        points_value = 3 if is_three else 2

        contest_level = 0.0
        if defender:
            contest_level = self._contest_level(shooter, defender, zone_id)

        shot_type = _determine_shot_type(zone_id, shooter)
        shot_attempt = ShotAttempt(
            zone_id=zone_id,
            shot_type=shot_type,
            made=made,
            assisted=assisted,
            is_contested=defender is not None,
            assisted_by_player_id=assist_by,
            quarter=state.quarter,
            shot_clock=state.shot_clock,
            game_clock=state.game_clock,
            is_clutch=is_clutch,
            defender_id=defender.id if defender else None,
            contest_level=contest_level,
        )

        if made:
            and_one = self._check_and_one(shooter, defender, play_type)
            and_one_pts = 0
            if and_one:
                ft_res = self._simulate_free_throws(
                    shooter, 1, is_home, clutch_mods
                )
                and_one_pts = ft_res["points"]

            return {
                "points": points_value + and_one_pts,
                "shot_attempt": shot_attempt,
                "turnover": False,
                "foul": None,
                "rebound": None,
                "assist_by": assist_by,
                "shooter_id": shooter.id,
                "defender_id": defender.id if defender else None,
                "play_type": play_type,
                "steal": False,
                "block": False,
                "and_one": and_one,
            }

        block = self._check_block(shooter, defender, zone_id)
        rebound = self._simulate_rebound(offense, defense, zone_id)
        return {
            "points": 0,
            "shot_attempt": shot_attempt,
            "turnover": False,
            "foul": None,
            "rebound": rebound,
            "assist_by": None,
            "shooter_id": shooter.id,
            "defender_id": defender.id if defender else None,
            "play_type": play_type,
            "steal": False,
            "block": block,
            "and_one": False,
        }

    def _select_ball_handler(
        self, players: list[Player], play_weights: dict[str, float]
    ) -> Player:
        target_id = play_weights.get("_target_player_id")
        if target_id:
            for p in players:
                if p.id == target_id and random.random() < 0.35:
                    return p

        weights = []
        for p in players:
            w = (
                self.fatigue.get_effective_rating(p, "ball_handling") * 0.35
                + self.fatigue.get_effective_rating(p, "passing_vision") * 0.25
                + p.tendencies.usage_desire * 0.40
            )
            weights.append(max(w, 1.0))
        return _weighted_choice(players, weights)

    def _select_play_type(
        self, ball_handler: Player, play_weights: dict[str, float]
    ) -> str:
        play_types = [
            "isolation", "pick_and_roll", "spot_up", "post_up",
            "transition", "cut", "catch_and_shoot",
        ]
        weights = [max(play_weights.get(pt, 1.0), 0.01) for pt in play_types]
        return _weighted_choice(play_types, weights)

    def _check_turnover(
        self,
        ball_handler: Player,
        defense: list[Player],
        assignments: dict[str, str],
        chem_mods: ChemistryModifiers,
        clutch_mods: ClutchModifiers,
        spacing: FloorSpacing,
        state: GameState,
    ) -> dict:
        base_rate = 0.11
        bh = self.fatigue.get_effective_rating(ball_handler, "ball_handling")
        handling_factor = 1.0 - (bh / 160.0)

        best_steal = max(
            self.fatigue.get_effective_rating(d, "stealing") for d in defense
        )
        steal_pressure = best_steal / 1200.0

        chem_to = chem_mods.turnover_rate_mod
        clutch_to = clutch_mods.turnover_mod

        spacing_factor = (1.0 - spacing.spacing_factor) * 0.04

        prob = (
            base_rate * handling_factor
            + steal_pressure
            + chem_to
            + clutch_to
            + spacing_factor
        )
        prob = max(0.04, min(0.22, prob))

        if random.random() < prob:
            steal = random.random() < 0.55
            stealer_id = None
            if steal:
                steal_weights = [
                    self.fatigue.get_effective_rating(d, "stealing")
                    for d in defense
                ]
                stealer = _weighted_choice(defense, steal_weights)
                stealer_id = stealer.id

            return {
                "points": 0,
                "shot_attempt": None,
                "turnover": True,
                "foul": None,
                "rebound": None,
                "assist_by": None,
                "shooter_id": None,
                "ball_handler_id": ball_handler.id,
                "stealer_id": stealer_id,
                "play_type": "turnover",
                "steal": steal,
                "block": False,
                "and_one": False,
                "defender_id": None,
            }

        return {"turnover": False}

    def _resolve_shooter(
        self,
        ball_handler: Player,
        offense: list[Player],
        play_type: str,
        chem_mods: ChemistryModifiers,
    ) -> tuple[Player, bool, str | None]:
        if play_type in ("isolation", "post_up"):
            base_assist_rate = 0.15
        elif play_type in ("spot_up", "catch_and_shoot"):
            base_assist_rate = 0.75
        elif play_type in ("cut",):
            base_assist_rate = 0.85
        elif play_type == "pick_and_roll":
            base_assist_rate = 0.55
        elif play_type == "transition":
            base_assist_rate = 0.60
        else:
            base_assist_rate = 0.45

        assist_rate = base_assist_rate + chem_mods.assist_probability_mod
        assist_rate = max(0.05, min(0.90, assist_rate))

        if random.random() < assist_rate:
            teammates = [p for p in offense if p.id != ball_handler.id]
            if teammates:
                if play_type in ("spot_up", "catch_and_shoot"):
                    shoot_weights = [
                        self.fatigue.get_effective_rating(p, "three_point") * 0.6
                        + p.tendencies.catch_and_shoot_frequency * 0.4
                        for p in teammates
                    ]
                elif play_type == "cut":
                    shoot_weights = [
                        self.fatigue.get_effective_rating(p, "finishing") * 0.5
                        + p.tendencies.cut_frequency * 0.3
                        + p.ratings.speed * 0.2
                        for p in teammates
                    ]
                else:
                    shoot_weights = [
                        p.tendencies.usage_desire * 0.4
                        + self.fatigue.get_effective_rating(p, "mid_range") * 0.3
                        + self.fatigue.get_effective_rating(p, "three_point") * 0.3
                        for p in teammates
                    ]

                shooter = _weighted_choice(teammates, shoot_weights)
                return shooter, True, ball_handler.id

        return ball_handler, False, None

    def _get_defender(
        self,
        shooter: Player,
        defense: list[Player],
        assignments: dict[str, str],
    ) -> Player | None:
        for def_id, off_id in assignments.items():
            if off_id == shooter.id:
                for d in defense:
                    if d.id == def_id:
                        return d

        if defense:
            return random.choice(defense)
        return None

    def _calculate_shot_probability(
        self,
        shooter: Player,
        zone_id: str,
        defender: Player | None,
        is_home: bool,
        play_type: str,
        chem_mods: ChemistryModifiers,
        clutch_mods: ClutchModifiers,
        spacing: FloorSpacing,
        state: GameState,
    ) -> float:
        base_pct = ZONE_BASE_PERCENTAGES.get(zone_id, 0.35)

        skill_attr = ShotSelector.get_skill_for_zone(zone_id)
        skill_val = self.fatigue.get_effective_rating(shooter, skill_attr)
        skill_mod = 0.5 + (skill_val / 100.0)

        matchup_mod = 1.0
        if defender:
            scheme = "man_to_man"
            matchup_mod = self.matchups.get_shot_modifier(
                shooter, defender, zone_id, scheme
            )

        hot_hand = self.momentum.get_hot_hand_modifier(shooter.id)

        team_side = "home" if is_home else "away"
        crowd_mod = self.momentum.get_crowd_shooting_modifier(is_home)

        momentum_val = self.momentum.get_momentum(team_side)
        momentum_mod = momentum_val * 0.03

        clutch_shooting = clutch_mods.shooting_mod

        spacing_mod = 0.0
        if ShotSelector.is_paint_shot(zone_id):
            spacing_mod = (spacing.driving_lane_quality - 0.5) * 0.06
        elif zone_id == "post_up":
            spacing_mod = (spacing.post_up_space - 0.5) * 0.05

        home_bonus = 0.015 if is_home else 0.0

        play_type_bonus = 0.0
        if play_type == "transition" and ShotSelector.is_paint_shot(zone_id):
            play_type_bonus = 0.05
        elif play_type == "catch_and_shoot":
            play_type_bonus = 0.02
        elif play_type == "cut" and zone_id == "restricted_area":
            play_type_bonus = 0.04

        final = (
            base_pct * skill_mod * matchup_mod
            + hot_hand
            + crowd_mod
            + momentum_mod
            + clutch_shooting
            + spacing_mod
            + home_bonus
            + play_type_bonus
        )

        return max(0.05, min(0.85, final))

    def _contest_level(
        self, shooter: Player, defender: Player, zone_id: str
    ) -> float:
        if ShotSelector.is_paint_shot(zone_id):
            d_rating = (
                self.fatigue.get_effective_rating(defender, "interior_defense") * 0.5
                + self.fatigue.get_effective_rating(defender, "shot_blocking") * 0.3
                + defender.bio.height * 0.2
            )
        elif ShotSelector.is_three_pointer(zone_id):
            d_rating = (
                self.fatigue.get_effective_rating(defender, "perimeter_defense") * 0.5
                + self.fatigue.get_effective_rating(defender, "acceleration") * 0.3
                + defender.tendencies.closeout_aggression * 0.2
            )
        else:
            d_rating = (
                self.fatigue.get_effective_rating(defender, "perimeter_defense") * 0.4
                + self.fatigue.get_effective_rating(defender, "lateral_quickness") * 0.3
                + defender.tendencies.closeout_aggression * 0.3
            )
        return max(0.0, min(1.0, d_rating / 100.0))

    def _check_foul(
        self,
        offensive_player: Player,
        defense: list[Player],
        assignments: dict[str, str],
        play_type: str,
    ) -> dict | None:
        if play_type in ("cut", "transition"):
            base_rate = 0.10
        elif play_type == "post_up":
            base_rate = 0.08
        elif play_type == "pick_and_roll":
            base_rate = 0.09
        elif play_type == "isolation":
            base_rate = 0.07
        else:
            base_rate = 0.04

        draw_foul = (offensive_player.ratings.draw_foul - 50) * 0.001

        defender = self._get_defender(offensive_player, defense, assignments)
        foul_prone = 0.0
        defender_id = None
        if defender:
            foul_prone = (defender.tendencies.foul_proneness - 50) * 0.001
            defender_id = defender.id

        prob = base_rate + draw_foul + foul_prone
        prob = max(0.02, min(0.18, prob))

        if random.random() < prob:
            ft_count = 2
            if play_type in ("spot_up", "catch_and_shoot") and random.random() < 0.6:
                ft_count = 3
            return {
                "type": "shooting",
                "free_throws": ft_count,
                "defender_id": defender_id,
            }
        return None

    def _check_and_one(
        self,
        shooter: Player,
        defender: Player | None,
        play_type: str,
    ) -> bool:
        if play_type in ("cut", "transition"):
            base = 0.06
        elif play_type == "isolation":
            base = 0.04
        else:
            base = 0.03

        draw = (shooter.ratings.draw_foul - 50) * 0.0008
        foul_p = 0.0
        if defender:
            foul_p = (defender.tendencies.foul_proneness - 50) * 0.0005

        return random.random() < (base + draw + foul_p)

    def _check_block(
        self, shooter: Player, defender: Player | None, zone_id: str
    ) -> bool:
        if defender is None:
            return False
        if not ShotSelector.is_paint_shot(zone_id) and zone_id != "post_up":
            return random.random() < 0.01

        block_rating = self.fatigue.get_effective_rating(defender, "shot_blocking")
        height_adv = max(0, defender.bio.height - shooter.bio.height) * 0.5
        prob = (block_rating + height_adv) / 1500.0
        return random.random() < max(0.01, min(0.12, prob))

    def _simulate_free_throws(
        self,
        shooter: Player,
        count: int,
        is_home: bool,
        clutch_mods: ClutchModifiers,
    ) -> dict:
        ft_rating = self.fatigue.get_effective_rating(shooter, "free_throw")
        base_rate = 0.40 + (ft_rating / 100.0) * 0.50

        crowd_ft = self.momentum.get_crowd_ft_modifier(is_home)
        rate = base_rate + clutch_mods.free_throw_mod + crowd_ft
        rate = max(0.30, min(0.98, rate))

        made = sum(1 for _ in range(count) if random.random() < rate)
        return {"made": made, "attempted": count, "points": made}

    def _simulate_rebound(
        self,
        offense: list[Player],
        defense: list[Player],
        zone_id: str,
    ) -> dict:
        off_scores = []
        for p in offense:
            height_norm = p.bio.height / 90.0
            score = (
                self.fatigue.get_effective_rating(p, "offensive_rebounding") * 0.55
                + self.fatigue.get_effective_rating(p, "rebounding") * 0.15
                + p.ratings.strength * 0.15
                + height_norm * 100 * 0.15
            ) * (p.ratings.hustle / 100.0)
            off_scores.append(max(score, 0.01))

        def_scores = []
        for p in defense:
            height_norm = p.bio.height / 90.0
            score = (
                self.fatigue.get_effective_rating(p, "rebounding") * 0.55
                + p.ratings.strength * 0.20
                + height_norm * 100 * 0.15
                + self.fatigue.get_effective_rating(p, "defensive_iq") * 0.10
            )
            def_scores.append(max(score, 0.01))

        total_off = sum(off_scores)
        total_def = sum(def_scores)

        base_oreb_rate = 0.27
        ratio = total_off / (total_off + total_def) if (total_off + total_def) > 0 else 0.27
        oreb_prob = base_oreb_rate * (ratio / 0.5)
        oreb_prob = max(0.08, min(0.40, oreb_prob))

        if random.random() < oreb_prob:
            rebounder = _weighted_choice(offense, off_scores)
            return {"offensive": True, "rebounder_id": rebounder.id}

        rebounder = _weighted_choice(defense, def_scores)
        return {"offensive": False, "rebounder_id": rebounder.id}


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


def _determine_shot_type(zone_id: str, shooter: Player) -> str:
    if zone_id == "restricted_area":
        if shooter.ratings.vertical > 80 and random.random() < 0.45:
            return "dunk"
        return "layup"
    if zone_id == "post_up":
        if random.random() < 0.4:
            return "hook"
        return "fadeaway"
    if zone_id == "paint_non_ra":
        return "floater" if random.random() < 0.35 else "jumper"
    if zone_id.startswith("midrange_"):
        return "pullup" if random.random() < 0.3 else "jumper"
    if zone_id.startswith("three_") or zone_id == "backcourt":
        return "three"
    return "jumper"
