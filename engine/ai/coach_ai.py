from __future__ import annotations
from ..models.player import Player
from ..models.team import Team, CoachingStaff
from ..models.game import GameState


class CoachAI:
    def __init__(self, team: Team, players: list[Player]):
        self.team = team
        self.players = players

    def set_starting_lineup(self) -> list[str]:
        sorted_players = sorted(self.players, key=lambda p: p.ratings.overall, reverse=True)
        starters = []
        has_pg = False
        has_c = False

        for p in sorted_players:
            if len(starters) >= 5:
                break
            pos = p.bio.position
            if not has_pg and pos in ("PG", "SG"):
                starters.append(p)
                has_pg = True
            elif not has_c and pos in ("C", "PF"):
                starters.append(p)
                has_c = True
            elif len(starters) < 5:
                starters.append(p)

        # Fill remaining slots if position search left gaps
        for p in sorted_players:
            if len(starters) >= 5:
                break
            if p not in starters:
                starters.append(p)

        return [p.id for p in starters[:5]]

    def set_rotation(self, minutes_target: dict[str, float] | None = None) -> dict[str, float]:
        if minutes_target is not None:
            return minutes_target

        sorted_players = sorted(self.players, key=lambda p: p.ratings.overall, reverse=True)
        rotation = {}

        for i, p in enumerate(sorted_players):
            if i < 5:
                scale = (p.ratings.overall - 60) / (99 - 60)
                scale = max(0.0, min(1.0, scale))
                rotation[p.id] = 30 + scale * 6
            elif i < 8:
                scale = (p.ratings.overall - 50) / (99 - 50)
                scale = max(0.0, min(1.0, scale))
                rotation[p.id] = 18 + scale * 6
            elif i < 10:
                scale = (p.ratings.overall - 40) / (99 - 40)
                scale = max(0.0, min(1.0, scale))
                rotation[p.id] = 8 + scale * 6
            else:
                rotation[p.id] = max(0.0, min(4.0, (p.ratings.overall / 99) * 4))

        # Normalize to approximate 240 total minutes
        total = sum(rotation.values())
        if total > 0:
            factor = 240.0 / total
            rotation = {pid: round(mins * factor, 1) for pid, mins in rotation.items()}

        return rotation

    def decide_substitution(
        self, state: GameState, on_court: list[Player], bench: list[Player]
    ) -> list[tuple[str, str]] | None:
        subs = []
        used_bench = set()

        for player in on_court:
            if len(subs) >= 2:
                break

            needs_sub = False
            if player.status.fatigue > 0.70:
                needs_sub = True

            stats = self._find_player_stats(state, player.id)
            fouls = stats.personal_fouls if stats else 0
            if state.quarter <= 3 and fouls >= 4:
                needs_sub = True
            elif state.quarter >= 4 and fouls >= 5:
                needs_sub = True

            if not needs_sub:
                continue

            best_replacement = None
            best_rating = -1
            for bp in bench:
                if bp.id in used_bench:
                    continue
                match_bonus = 10 if bp.bio.position == player.bio.position else 0
                effective = bp.ratings.overall + match_bonus
                if effective > best_rating:
                    best_rating = effective
                    best_replacement = bp

            if best_replacement:
                subs.append((player.id, best_replacement.id))
                used_bench.add(best_replacement.id)

        return subs if subs else None

    def call_timeout(self, state: GameState, momentum: float) -> bool:
        if momentum < -8:
            return True

        if state.possession_team == "home":
            our_score, their_score = state.home_score, state.away_score
        else:
            our_score, their_score = state.away_score, state.home_score

        deficit = their_score - our_score
        if deficit > 15 and state.quarter >= 3:
            return True

        if state.quarter == 4 and state.game_clock <= 120:
            if abs(our_score - their_score) <= 5:
                return True

        return False

    def adjust_strategy(self, score_diff: int, quarter: int, game_clock: float) -> dict:
        if score_diff <= -10:
            return {"pace": "push", "defense": "aggressive", "three_rate": 1.3}
        if score_diff >= 10:
            return {"pace": "slow", "defense": "conservative", "three_rate": 0.8}
        return {"pace": "normal", "defense": "balanced", "three_rate": 1.0}

    def get_defensive_assignment(self, defender: Player, opponents: list[Player]) -> str:
        position_matches = [o for o in opponents if o.bio.position == defender.bio.position]
        if position_matches:
            best = min(position_matches, key=lambda o: abs(o.ratings.overall - defender.ratings.overall))
            return best.id

        best = min(opponents, key=lambda o: abs(o.ratings.overall - defender.ratings.overall))
        return best.id

    def set_offensive_scheme(self, opponent: Team) -> str:
        top3 = sorted(self.players, key=lambda p: p.ratings.overall, reverse=True)[:3]

        avg_ball_handling = sum(p.ratings.ball_handling for p in top3) / len(top3)
        avg_post = sum(p.ratings.post_game for p in top3) / len(top3)
        avg_speed = sum(p.ratings.speed for p in top3) / len(top3)
        avg_passing = sum(p.ratings.passing_vision for p in top3) / len(top3)

        best_metric = max(
            ("isolation", avg_ball_handling),
            ("post_up_heavy", avg_post),
            ("fast_break", avg_speed),
            ("motion", avg_passing),
            key=lambda x: x[1],
        )

        if best_metric[0] == "isolation" and avg_ball_handling > 75:
            return "isolation"
        if best_metric[0] == "post_up_heavy" and avg_post > 70:
            return "post_up_heavy"
        if best_metric[0] == "fast_break" and avg_speed > 78:
            return "fast_break"
        if avg_passing > 70:
            return "motion"

        return "pick_and_roll_heavy"

    def set_defensive_scheme(self, opponent: Team) -> str:
        top_players = sorted(self.players, key=lambda p: p.ratings.overall, reverse=True)[:5]
        avg_lateral = sum(p.ratings.lateral_quickness for p in top_players) / len(top_players)
        avg_interior = sum(p.ratings.interior_defense for p in top_players) / len(top_players)
        avg_perimeter = sum(p.ratings.perimeter_defense for p in top_players) / len(top_players)

        versatile_count = sum(
            1 for p in top_players
            if p.ratings.perimeter_defense > 65 and p.ratings.interior_defense > 60
        )

        if versatile_count >= 3 and avg_lateral > 70:
            return "switching"

        if avg_interior > 75:
            return "zone_2_3"

        return "man_to_man"

    def manage_foul_trouble(self, player: Player, fouls: int, quarter: int) -> bool:
        star_bonus = 1 if player.ratings.overall >= 85 else 0

        if fouls >= 3 + star_bonus and quarter <= 2:
            return True
        if fouls >= 4 + star_bonus and quarter <= 3:
            return True
        if fouls >= 5 + star_bonus and quarter == 4:
            return True

        return False

    def playoff_rotation_adjustment(self, series_game: int) -> dict[str, float]:
        sorted_players = sorted(self.players, key=lambda p: p.ratings.overall, reverse=True)
        rotation = {}

        for i, p in enumerate(sorted_players):
            if i < 5:
                scale = (p.ratings.overall - 60) / (99 - 60)
                scale = max(0.0, min(1.0, scale))
                rotation[p.id] = 36 + scale * 6
            elif i < 8:
                scale = (p.ratings.overall - 50) / (99 - 50)
                scale = max(0.0, min(1.0, scale))
                rotation[p.id] = 12 + scale * 8
            else:
                rotation[p.id] = 0.0

        total = sum(rotation.values())
        if total > 0:
            factor = 240.0 / total
            rotation = {pid: round(mins * factor, 1) for pid, mins in rotation.items()}

        return rotation

    def garbage_time_check(self, score_diff: int, quarter: int, game_clock: float) -> bool:
        if quarter == 4 and abs(score_diff) >= 25:
            return True
        if quarter == 4 and game_clock < 180 and abs(score_diff) >= 20:
            return True
        return False

    def _find_player_stats(self, state: GameState, player_id: str):
        return None
