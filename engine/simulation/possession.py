from __future__ import annotations

import random
import math
from ..models.player import Player
from ..models.game import GameState, ShotAttempt, PlayerGameStats
from ..models.team import Team
from .shot_selection import ShotSelector, ZONE_BASE_PERCENTAGES


class PossessionEngine:
    """Core possession-by-possession simulation engine."""

    def __init__(
        self,
        home_players: list[Player],
        away_players: list[Player],
        settings: dict | None = None,
    ):
        self.home_players = home_players
        self.away_players = away_players
        self.settings = settings or {}

    def simulate_possession(
        self,
        state: GameState,
        offense_players: list[Player],
        defense_players: list[Player],
    ) -> dict:
        """Simulate a single possession and return the outcome details."""
        ball_handler = self.select_ball_handler(offense_players)
        primary_defender = random.choice(defense_players)
        fatigue = ball_handler.status.fatigue

        if self.check_turnover(ball_handler, defense_players, fatigue):
            return {
                "points": 0,
                "shot_attempt": None,
                "turnover": True,
                "foul": None,
                "rebound": None,
                "assist_by": None,
                "shooter_id": None,
            }

        teammates = [p for p in offense_players if p.id != ball_handler.id]
        play_type = self.select_play_type(ball_handler, teammates, "")

        foul = self.check_foul(ball_handler, primary_defender, play_type)
        if foul is not None:
            ft_result = self.simulate_free_throws(ball_handler, foul["free_throws"])
            return {
                "points": ft_result["points"],
                "shot_attempt": None,
                "turnover": False,
                "foul": foul,
                "rebound": None,
                "assist_by": None,
                "shooter_id": ball_handler.id,
            }

        assisted = False
        assist_by = None
        if play_type in ("spot_up", "catch_and_shoot"):
            assisted = random.random() < 0.70
        elif play_type == "isolation":
            assisted = random.random() < 0.20
        else:
            assisted = random.random() < 0.45

        if assisted and teammates:
            passer_weights = [
                p.ratings.passing_vision * 0.6 + p.ratings.passing_accuracy * 0.4
                for p in teammates
            ]
            assist_by = _weighted_choice(teammates, passer_weights).id

        selector = ShotSelector(ball_handler)
        zone_id = selector.select_zone(play_type, state.shot_clock, is_contested=True)

        probability = self.calculate_shot_probability(
            ball_handler, zone_id, primary_defender, fatigue, is_home=True
        )

        made = random.random() < probability
        is_three = ShotSelector.is_three_pointer(zone_id)
        points_value = 3 if is_three else 2

        if made:
            shot_type = _determine_shot_type(zone_id, ball_handler)
            shot_attempt = ShotAttempt(
                zone_id=zone_id,
                shot_type=shot_type,
                made=True,
                assisted=assisted,
                is_contested=True,
                assisted_by_player_id=assist_by,
                quarter=state.quarter,
            )
            return {
                "points": points_value,
                "shot_attempt": shot_attempt,
                "turnover": False,
                "foul": None,
                "rebound": None,
                "assist_by": assist_by,
                "shooter_id": ball_handler.id,
            }

        shot_type = _determine_shot_type(zone_id, ball_handler)
        shot_attempt = ShotAttempt(
            zone_id=zone_id,
            shot_type=shot_type,
            made=False,
            assisted=assisted,
            is_contested=True,
            assisted_by_player_id=assist_by,
            quarter=state.quarter,
        )
        rebound = self.simulate_rebound(offense_players, defense_players, zone_id)
        return {
            "points": 0,
            "shot_attempt": shot_attempt,
            "turnover": False,
            "foul": None,
            "rebound": rebound,
            "assist_by": None,
            "shooter_id": ball_handler.id,
        }

    def check_turnover(
        self, ball_handler: Player, defenders: list[Player], fatigue: float
    ) -> bool:
        """Determine whether the ball handler commits a turnover."""
        base_rate = 0.12
        handling_factor = 1.0 - (ball_handler.ratings.ball_handling / 150)
        fatigue_factor = 1.0 + fatigue * 0.05
        best_defender_steal = max(d.ratings.stealing for d in defenders) / 1500
        prob = base_rate * handling_factor * fatigue_factor + best_defender_steal
        prob = max(0.03, min(0.25, prob))
        return random.random() < prob

    def select_ball_handler(self, players: list[Player]) -> Player:
        """Choose the primary ball handler from the on-court players."""
        weights = [
            p.ratings.ball_handling * 0.4
            + p.ratings.passing_vision * 0.3
            + p.tendencies.usage_desire * 0.3
            for p in players
        ]
        return _weighted_choice(players, weights)

    def select_play_type(
        self,
        ball_handler: Player,
        teammates: list[Player],
        scheme: str,
    ) -> str:
        """Select the offensive play type based on personnel and scheme."""
        play_types = [
            "isolation",
            "pick_and_roll",
            "spot_up",
            "post_up",
            "transition",
            "cut",
            "catch_and_shoot",
        ]
        t = ball_handler.tendencies
        weights = [
            t.iso_frequency,
            t.pick_and_roll_ball_handler,
            t.spot_up_frequency,
            t.post_up_frequency,
            t.transition_frequency,
            t.cut_frequency,
            t.catch_and_shoot_frequency,
        ]
        return _weighted_choice(play_types, weights)

    def attempt_shot(
        self,
        shooter: Player,
        defender: Player | None,
        zone_id: str,
        is_contested: bool,
    ) -> ShotAttempt:
        """Create and resolve a shot attempt."""
        fatigue = shooter.status.fatigue
        probability = self.calculate_shot_probability(
            shooter, zone_id, defender if is_contested else None, fatigue, is_home=True
        )
        made = random.random() < probability
        shot_type = _determine_shot_type(zone_id, shooter)
        return ShotAttempt(
            zone_id=zone_id,
            shot_type=shot_type,
            made=made,
            assisted=False,
            is_contested=is_contested,
        )

    def calculate_shot_probability(
        self,
        shooter: Player,
        zone_id: str,
        defender: Player | None,
        fatigue: float,
        is_home: bool,
    ) -> float:
        """Calculate the probability of making a shot given all factors."""
        base_pct = ZONE_BASE_PERCENTAGES.get(zone_id, 0.35)
        skill_attr = ShotSelector.get_skill_for_zone(zone_id)
        skill_rating = getattr(shooter.ratings, skill_attr, 50)
        skill_mod = 0.5 + (skill_rating / 100)

        contest = 0.0
        if defender:
            if ShotSelector.is_paint_shot(zone_id):
                defender_rating = defender.ratings.interior_defense
            else:
                defender_rating = defender.ratings.perimeter_defense
            contest = (defender_rating / 100) * 0.15

        fatigue_penalty = fatigue * 0.10
        home_bonus = 0.015 if is_home else 0.0

        final = base_pct * skill_mod - contest - fatigue_penalty + home_bonus
        return max(0.05, min(0.85, final))

    def simulate_rebound(
        self,
        offense_players: list[Player],
        defense_players: list[Player],
        zone_id: str,
    ) -> dict:
        """Simulate a rebound after a missed shot."""
        offense_scores = []
        for p in offense_players:
            height_norm = p.bio.height / 90.0
            score = (
                p.ratings.offensive_rebounding * 0.6
                + p.ratings.rebounding * 0.2
                + p.ratings.strength * 0.1
                + height_norm * 100 * 0.1
            ) * (p.ratings.hustle / 100)
            offense_scores.append(max(score, 0.01))

        defense_scores = []
        for p in defense_players:
            height_norm = p.bio.height / 90.0
            score = (
                p.ratings.rebounding * 0.6
                + p.ratings.strength * 0.2
                + height_norm * 100 * 0.1
                + p.ratings.defensive_iq * 0.1
            )
            defense_scores.append(max(score, 0.01))

        total_off = sum(offense_scores)
        total_def = sum(defense_scores)

        # ~27% league-wide OREB rate, scaled by relative scores
        base_oreb_rate = 0.27
        ratio = total_off / (total_off + total_def) if (total_off + total_def) > 0 else 0.27
        oreb_prob = base_oreb_rate * (ratio / 0.5) if ratio > 0 else base_oreb_rate
        oreb_prob = max(0.05, min(0.45, oreb_prob))

        if random.random() < oreb_prob:
            rebounder = _weighted_choice(offense_players, offense_scores)
            return {"offensive": True, "rebounder_id": rebounder.id}

        rebounder = _weighted_choice(defense_players, defense_scores)
        return {"offensive": False, "rebounder_id": rebounder.id}

    def check_foul(
        self,
        offensive_player: Player,
        defensive_player: Player,
        play_type: str,
    ) -> dict | None:
        """Check whether a foul occurs on the play."""
        if play_type in ("drive", "cut"):
            base_rate = 0.12
        elif play_type == "post_up":
            base_rate = 0.08
        else:
            base_rate = 0.04

        draw_foul_factor = (offensive_player.ratings.draw_foul - 50) * 0.001
        foul_prone_factor = (defensive_player.tendencies.foul_proneness - 50) * 0.001
        prob = base_rate + draw_foul_factor + foul_prone_factor

        if random.random() < prob:
            return {"type": "shooting", "free_throws": 2}
        return None

    def simulate_free_throws(
        self, shooter: Player, num_free_throws: int
    ) -> dict:
        """Simulate a trip to the free-throw line."""
        ft_rating = shooter.ratings.free_throw
        make_rate = 0.40 + (ft_rating / 100) * 0.50

        made = 0
        for _ in range(num_free_throws):
            if random.random() < make_rate:
                made += 1

        return {"made": made, "attempted": num_free_throws, "points": made}


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
        if shooter.ratings.vertical > 80:
            return "dunk"
        return "layup"
    if zone_id == "post_up":
        return "hook"
    if zone_id.startswith("midrange_") or zone_id == "paint_non_ra":
        return "jumper"
    if zone_id.startswith("three_") or zone_id == "backcourt":
        return "three"
    return "jumper"
