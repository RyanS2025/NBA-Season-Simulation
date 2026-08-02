from __future__ import annotations

from dataclasses import dataclass
from ..models.player import Player


# ---------------------------------------------------------------------------
# Position ordering used to evaluate positional compatibility
# ---------------------------------------------------------------------------

_POSITION_INDEX: dict[str, int] = {
    "PG": 0,
    "SG": 1,
    "SF": 2,
    "PF": 3,
    "C": 4,
}

# Zone responsibility labels returned for zone-based schemes
_ZONE_2_3_AREAS: list[str] = [
    "left_wing_zone",
    "right_wing_zone",
    "left_block_zone",
    "middle_zone",
    "right_block_zone",
]

_ZONE_3_2_AREAS: list[str] = [
    "left_wing_zone",
    "top_key_zone",
    "right_wing_zone",
    "left_block_zone",
    "right_block_zone",
]


# ---------------------------------------------------------------------------
# Return-value dataclasses
# ---------------------------------------------------------------------------


@dataclass
class MatchupAdvantage:
    """Quantifies how much an offensive player benefits from a given matchup."""

    post_advantage: float
    perimeter_advantage: float
    shooting_advantage: float
    overall_advantage: float
    mismatch_type: str | None
    mismatch_severity: float


@dataclass
class FloorSpacing:
    """Describes how well the offensive lineup spaces the floor."""

    spacing_factor: float
    driving_lane_quality: float
    post_up_space: float


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _clamp(value: float, lo: float, hi: float) -> float:
    """Clamp *value* between *lo* and *hi*."""
    if value < lo:
        return lo
    if value > hi:
        return hi
    return value


def _position_distance(pos_a: str, pos_b: str) -> int:
    """Return the absolute gap between two positions on the 0-4 scale."""
    idx_a = _POSITION_INDEX.get(pos_a, 2)
    idx_b = _POSITION_INDEX.get(pos_b, 2)
    return abs(idx_a - idx_b)


def _best_scorer(players: list[Player]) -> Player:
    """Return the player with the highest overall rating."""
    return max(players, key=lambda p: p.ratings.overall)


# ---------------------------------------------------------------------------
# MatchupEngine
# ---------------------------------------------------------------------------


class MatchupEngine:
    """Deep matchup system for individual defensive assignments and advantages."""

    # ------------------------------------------------------------------
    # 1. Defensive Assignment Matrix
    # ------------------------------------------------------------------

    def calculate_assignments(
        self,
        offense: list[Player],
        defense: list[Player],
        scheme: str,
    ) -> dict[str, str]:
        """Return a mapping of ``defender_id -> offensive_player_id``.

        Parameters
        ----------
        offense:
            The five offensive players currently on the court.
        defense:
            The five defensive players currently on the court.
        scheme:
            One of ``"man_to_man"``, ``"switching"``, ``"zone_2_3"``,
            ``"zone_3_2"``, ``"box_and_one"``.
        """

        if scheme == "man_to_man":
            return self._assign_man_to_man(offense, defense)
        if scheme == "switching":
            return self._assign_switching(offense, defense)
        if scheme == "zone_2_3":
            return self._assign_zone(defense, _ZONE_2_3_AREAS)
        if scheme == "zone_3_2":
            return self._assign_zone(defense, _ZONE_3_2_AREAS)
        if scheme == "box_and_one":
            return self._assign_box_and_one(offense, defense)
        # Fallback to man-to-man for unrecognised schemes
        return self._assign_man_to_man(offense, defense)

    # -- man-to-man via cost-matrix minimisation (Hungarian-style greedy) ----

    def _assign_man_to_man(
        self,
        offense: list[Player],
        defense: list[Player],
    ) -> dict[str, str]:
        """Greedy cost-minimisation assignment.

        Cost for pairing *defender* on *offensive_player*:
            position_gap * 20  +  speed_diff * 0.4  +  height_diff * 0.3
        Lower cost is better.
        """

        n = min(len(offense), len(defense))
        cost_matrix: list[list[float]] = []
        for d in defense[:n]:
            row: list[float] = []
            for o in offense[:n]:
                pos_cost = _position_distance(d.bio.position, o.bio.position) * 20.0
                speed_cost = abs(d.ratings.speed - o.ratings.speed) * 0.4
                height_cost = abs(d.bio.height - o.bio.height) * 0.3
                row.append(pos_cost + speed_cost + height_cost)
            cost_matrix.append(row)

        # Greedy assignment: pick the lowest unmatched cost each iteration
        assigned_off: set[int] = set()
        assigned_def: set[int] = set()
        assignments: dict[str, str] = {}

        # Build flat list of (cost, def_idx, off_idx) and sort
        flat: list[tuple[float, int, int]] = []
        for di in range(n):
            for oi in range(n):
                flat.append((cost_matrix[di][oi], di, oi))
        flat.sort(key=lambda t: t[0])

        for cost, di, oi in flat:
            if di in assigned_def or oi in assigned_off:
                continue
            assignments[defense[di].id] = offense[oi].id
            assigned_def.add(di)
            assigned_off.add(oi)
            if len(assignments) == n:
                break

        return assignments

    # -- switching: best lateral quickness on best ball handlers -------------

    def _assign_switching(
        self,
        offense: list[Player],
        defense: list[Player],
    ) -> dict[str, str]:
        """Switching defence: pair defenders with the best lateral quickness
        against the offence's best ball handlers."""

        sorted_off = sorted(
            offense, key=lambda p: p.ratings.ball_handling, reverse=True
        )
        sorted_def = sorted(
            defense, key=lambda p: p.ratings.lateral_quickness, reverse=True
        )

        assignments: dict[str, str] = {}
        n = min(len(sorted_off), len(sorted_def))
        for i in range(n):
            assignments[sorted_def[i].id] = sorted_off[i].id
        return assignments

    # -- zone: area-based responsibilities -----------------------------------

    @staticmethod
    def _assign_zone(
        defense: list[Player],
        zone_areas: list[str],
    ) -> dict[str, str]:
        """Zone defence: each defender is mapped to an area string rather
        than an individual opponent.  Perimeter-oriented players are assigned
        to wing zones; interior-oriented players to block / middle zones.
        """

        # Score each defender as perimeter-biased (high) or interior-biased (low)
        scored = sorted(
            defense,
            key=lambda p: (
                p.ratings.perimeter_defense * 0.5
                + p.ratings.lateral_quickness * 0.3
                + p.ratings.speed * 0.2
                - p.ratings.interior_defense * 0.3
                - p.bio.height * 0.2
            ),
            reverse=True,
        )

        assignments: dict[str, str] = {}
        n = min(len(scored), len(zone_areas))
        for i in range(n):
            assignments[scored[i].id] = zone_areas[i]
        return assignments

    # -- box-and-one: one man defender, other four in a box zone -------------

    def _assign_box_and_one(
        self,
        offense: list[Player],
        defense: list[Player],
    ) -> dict[str, str]:
        """Best defender locks up opponent's best scorer; the remaining four
        defenders play a box zone (effectively a 2-2 zone)."""

        best_off = _best_scorer(offense)

        # Best defender = highest perimeter + interior composite
        best_def = max(
            defense,
            key=lambda p: (
                p.ratings.perimeter_defense * 0.5
                + p.ratings.interior_defense * 0.3
                + p.ratings.lateral_quickness * 0.2
            ),
        )

        assignments: dict[str, str] = {best_def.id: best_off.id}

        # Remaining four defenders get box zone areas
        box_areas = [
            "left_elbow_zone",
            "right_elbow_zone",
            "left_block_zone",
            "right_block_zone",
        ]
        remaining_def = [d for d in defense if d.id != best_def.id]

        # Sort remaining by perimeter-vs-interior bias (same idea as zone)
        remaining_def.sort(
            key=lambda p: (
                p.ratings.perimeter_defense * 0.5
                + p.ratings.lateral_quickness * 0.3
                - p.ratings.interior_defense * 0.2
            ),
            reverse=True,
        )

        for i, d in enumerate(remaining_def[: len(box_areas)]):
            assignments[d.id] = box_areas[i]

        return assignments

    # ------------------------------------------------------------------
    # 2. Individual Matchup Advantage
    # ------------------------------------------------------------------

    def calculate_matchup_advantage(
        self,
        offensive_player: Player,
        defensive_player: Player,
    ) -> MatchupAdvantage:
        """Evaluate the matchup between an offensive and defensive player.

        Each sub-advantage ranges from -1.0 (defender dominates) to 1.0
        (offensive player dominates).
        """

        off = offensive_player
        dfn = defensive_player

        # -- post advantage --------------------------------------------------
        height_diff = off.bio.height - dfn.bio.height          # inches
        weight_diff = off.bio.weight - dfn.bio.weight          # lbs
        strength_diff = off.ratings.strength - dfn.ratings.strength
        post_skill = off.ratings.post_game - dfn.ratings.interior_defense

        post_raw = (
            height_diff * 0.02
            + weight_diff * 0.008
            + strength_diff * 0.006
            + post_skill * 0.008
        )
        post_advantage = _clamp(post_raw, -1.0, 1.0)

        # -- perimeter advantage ----------------------------------------------
        speed_diff = off.ratings.speed - dfn.ratings.speed
        handle_diff = off.ratings.ball_handling - dfn.ratings.lateral_quickness
        accel_diff = off.ratings.acceleration - dfn.ratings.acceleration
        perim_def_factor = dfn.ratings.perimeter_defense

        perim_raw = (
            speed_diff * 0.008
            + handle_diff * 0.008
            + accel_diff * 0.005
            - perim_def_factor * 0.005
            + 0.25  # slight inherent offensive edge for having the ball
        )
        perimeter_advantage = _clamp(perim_raw, -1.0, 1.0)

        # -- shooting advantage -----------------------------------------------
        # Closeout ability approximated by acceleration + perimeter_defense + defensive_iq
        shooting_skill = (
            off.ratings.three_point * 0.5 + off.ratings.mid_range * 0.5
        )
        closeout_ability = (
            dfn.ratings.acceleration * 0.3
            + dfn.ratings.perimeter_defense * 0.4
            + dfn.ratings.defensive_iq * 0.3
        )
        shooting_raw = (shooting_skill - closeout_ability) * 0.012
        shooting_advantage = _clamp(shooting_raw, -1.0, 1.0)

        # -- mismatch detection -----------------------------------------------
        mismatch_type: str | None = None
        mismatch_severity: float = 0.0

        # Size mismatch: height diff > 4 AND weight diff > 30
        if height_diff > 4 and weight_diff > 30:
            size_severity = _clamp(
                (height_diff - 4) / 6.0 * 0.5 + (weight_diff - 30) / 40.0 * 0.5,
                0.0,
                1.0,
            )
            post_advantage = _clamp(
                post_advantage + size_severity * 0.4, -1.0, 1.0
            )
            if size_severity > mismatch_severity:
                mismatch_type = "size"
                mismatch_severity = size_severity

        # Speed mismatch: speed diff > 15
        if speed_diff > 15:
            speed_severity = _clamp((speed_diff - 15) / 20.0, 0.0, 1.0)
            perimeter_advantage = _clamp(
                perimeter_advantage + speed_severity * 0.4, -1.0, 1.0
            )
            if speed_severity > mismatch_severity:
                mismatch_type = "speed"
                mismatch_severity = speed_severity

        # Skill mismatch: overall gap > 15
        overall_gap = off.ratings.overall - dfn.ratings.overall
        if overall_gap > 15:
            skill_severity = _clamp((overall_gap - 15) / 20.0, 0.0, 1.0)
            if skill_severity > mismatch_severity:
                mismatch_type = "skill"
                mismatch_severity = skill_severity

        # -- overall advantage (weighted composite) ----------------------------
        overall_advantage = _clamp(
            post_advantage * 0.30
            + perimeter_advantage * 0.35
            + shooting_advantage * 0.35,
            -1.0,
            1.0,
        )

        return MatchupAdvantage(
            post_advantage=round(post_advantage, 4),
            perimeter_advantage=round(perimeter_advantage, 4),
            shooting_advantage=round(shooting_advantage, 4),
            overall_advantage=round(overall_advantage, 4),
            mismatch_type=mismatch_type,
            mismatch_severity=round(mismatch_severity, 4),
        )

    # ------------------------------------------------------------------
    # 3. Matchup-Aware Shot Probability Modifier
    # ------------------------------------------------------------------

    def get_shot_modifier(
        self,
        shooter: Player,
        defender: Player,
        zone_id: str,
        scheme: str,
    ) -> float:
        """Return a multiplier (0.85 to 1.15) applied to a base shot probability.

        The modifier accounts for the individual matchup and the defensive
        scheme's structural properties.
        """

        advantage = self.calculate_matchup_advantage(shooter, defender)

        # -- zone-specific weighting ------------------------------------------
        is_paint = zone_id in ("restricted_area", "paint_non_ra", "post_up")
        is_midrange = zone_id.startswith("midrange_")
        is_three = zone_id.startswith("three_") or zone_id == "backcourt"

        if is_paint:
            # Paint shots: interior_defense, shot_blocking, strength, height
            raw = advantage.post_advantage * 0.50

            block_factor = (defender.ratings.shot_blocking / 100.0) * 0.15
            strength_factor = (
                (defender.ratings.strength - shooter.ratings.strength) / 100.0
            ) * 0.08
            height_factor = (
                (defender.bio.height - shooter.bio.height) / 12.0
            ) * 0.05
            raw -= block_factor + strength_factor + height_factor

        elif is_midrange:
            # Midrange: lateral quickness, closeout aggression, perimeter defense
            raw = advantage.shooting_advantage * 0.40 + advantage.perimeter_advantage * 0.20
            closeout_factor = (
                defender.tendencies.closeout_aggression / 100.0
            ) * 0.08
            lat_factor = (defender.ratings.lateral_quickness / 100.0) * 0.06
            raw -= closeout_factor + lat_factor

        elif is_three:
            # Three-point: closeout speed (acceleration), perimeter def, def IQ
            raw = advantage.shooting_advantage * 0.50
            closeout_speed = (defender.ratings.acceleration / 100.0) * 0.10
            perim = (defender.ratings.perimeter_defense / 100.0) * 0.08
            iq_factor = (defender.ratings.defensive_iq / 100.0) * 0.05
            raw -= closeout_speed + perim + iq_factor

        else:
            # Fallback for any unrecognised zone
            raw = advantage.overall_advantage * 0.35

        # -- open look bonus from severe mismatch ------------------------------
        if advantage.mismatch_severity > 0.7:
            raw += 0.06  # effectively "open" bonus

        # -- help defence factor (zone / switching reduce paint advantage) -----
        if is_paint and scheme in ("zone_2_3", "zone_3_2", "switching"):
            raw -= 0.05

        # Map raw advantage to a multiplier in [0.85, 1.15]
        modifier = 1.0 + _clamp(raw, -0.15, 0.15)
        return round(_clamp(modifier, 0.85, 1.15), 4)

    # ------------------------------------------------------------------
    # 4. Switchability Rating
    # ------------------------------------------------------------------

    def calculate_switchability(self, player: Player) -> float:
        """Rate how well *player* can guard multiple positions (0.0-1.0).

        High values: versatile defenders (e.g. Bam Adebayo, OG Anunoby).
        Low values: traditional bigs with limited lateral quickness.
        """

        lat = player.ratings.lateral_quickness       # guards perimeter speed
        perim = player.ratings.perimeter_defense      # outer defence
        interior = player.ratings.interior_defense    # interior presence
        strength = player.ratings.strength            # hold ground vs bigs
        height = player.bio.height                    # inches

        # Ideal switchable height range: 76-82 inches (6'4" - 6'10")
        # Players inside this band get a full height bonus; outside it tapers off
        if 76 <= height <= 82:
            height_flex = 1.0
        elif height < 76:
            height_flex = max(0.0, 1.0 - (76 - height) / 8.0)
        else:
            height_flex = max(0.0, 1.0 - (height - 82) / 8.0)

        raw = (
            (lat / 100.0) * 0.30
            + (perim / 100.0) * 0.25
            + (interior / 100.0) * 0.15
            + (strength / 100.0) * 0.10
            + height_flex * 0.20
        )

        return round(_clamp(raw, 0.0, 1.0), 4)

    # ------------------------------------------------------------------
    # 5. Help Defense System
    # ------------------------------------------------------------------

    def calculate_help_defense_quality(
        self,
        defenders: list[Player],
        scheme: str,
    ) -> float:
        """Evaluate how well a defensive unit rotates and provides help (0.0-1.0).

        Zone schemes receive an automatic bonus because the defence is
        already positioned to help.
        """

        if not defenders:
            return 0.0

        total_iq = 0.0
        total_help_rate = 0.0
        total_hustle = 0.0

        for d in defenders:
            total_iq += d.ratings.defensive_iq
            total_help_rate += d.tendencies.help_defense_rate
            total_hustle += d.ratings.hustle

        n = len(defenders)
        avg_iq = total_iq / n
        avg_help = total_help_rate / n
        avg_hustle = total_hustle / n

        raw = (
            (avg_iq / 100.0) * 0.40
            + (avg_help / 100.0) * 0.35
            + (avg_hustle / 100.0) * 0.25
        )

        # Zone schemes get a structural help bonus
        if scheme in ("zone_2_3", "zone_3_2"):
            raw += 0.12
        elif scheme == "box_and_one":
            raw += 0.06
        elif scheme == "switching":
            # Switching can leave gaps; small penalty for low-IQ units
            if avg_iq < 60:
                raw -= 0.05

        return round(_clamp(raw, 0.0, 1.0), 4)

    # ------------------------------------------------------------------
    # 6. Spacing Impact on Matchups
    # ------------------------------------------------------------------

    def calculate_floor_spacing(
        self,
        offense: list[Player],
    ) -> FloorSpacing:
        """Evaluate how well the offensive lineup spaces the floor.

        A "credible 3PT threat" is any player with ``three_point >= 75``.
        More shooters force the defence to spread, opening driving lanes and
        post-up space.  Fewer shooters let the defence pack the paint.
        """

        if not offense:
            return FloorSpacing(
                spacing_factor=0.6,
                driving_lane_quality=0.3,
                post_up_space=0.3,
            )

        shooters = sum(1 for p in offense if p.ratings.three_point >= 75)

        # Average three-point ability (even non-credible threats contribute a
        # little to spacing because the defence can't *completely* ignore them)
        avg_three = sum(p.ratings.three_point for p in offense) / len(offense)

        # Base spacing factor: 0.6 (0 shooters) to 1.0 (5 shooters)
        spacing_from_count = 0.6 + shooters * 0.08
        spacing_from_skill = (avg_three / 100.0) * 0.15
        spacing_factor = _clamp(spacing_from_count + spacing_from_skill, 0.6, 1.0)

        # Driving lane quality
        # More shooters = defence can't help → better driving lanes
        lane_base = 0.3 + shooters * 0.12
        # Average ball handling also matters (someone has to actually drive)
        avg_handle = sum(p.ratings.ball_handling for p in offense) / len(offense)
        lane_skill = (avg_handle / 100.0) * 0.10
        driving_lane_quality = _clamp(lane_base + lane_skill, 0.2, 1.0)

        # Post-up space
        # If perimeter is well-spaced, the post player has room to operate
        post_base = 0.3 + shooters * 0.10
        # Also consider average off-ball movement (floor movers create space)
        avg_offball = sum(
            p.ratings.off_ball_movement for p in offense
        ) / len(offense)
        post_skill = (avg_offball / 100.0) * 0.12
        post_up_space = _clamp(post_base + post_skill, 0.2, 1.0)

        return FloorSpacing(
            spacing_factor=round(spacing_factor, 4),
            driving_lane_quality=round(driving_lane_quality, 4),
            post_up_space=round(post_up_space, 4),
        )
