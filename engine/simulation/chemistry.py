from __future__ import annotations

from dataclasses import dataclass, field
from ..models.player import Player
from ..models.team import Team


# ---------------------------------------------------------------------------
# Return-type dataclasses
# ---------------------------------------------------------------------------

@dataclass
class PairwiseResult:
    """Chemistry score between two individual players."""
    player_a_id: str
    player_b_id: str
    personality_score: float
    playstyle_score: float
    age_score: float
    familiarity: float
    total: float


@dataclass
class LineupChemistry:
    """Aggregate chemistry snapshot for a five-man unit on the court."""
    offensive_boost: float       # -0.10 .. +0.10
    defensive_boost: float       # -0.10 .. +0.10
    spacing_rating: float        # 0.0 .. 1.0
    passing_synergy: float       # 0.0 .. 1.0
    leadership_factor: float     # 0.0 .. 1.0


@dataclass
class TeamChemistry:
    """Season-level locker-room chemistry for a full roster."""
    overall: int                     # 0-100
    leader_count: int
    ego_count: int
    team_player_count: int
    new_player_count: int
    winning_modifier: int
    star_ego_penalty: int
    coaching_fit: float


@dataclass
class ChemistryModifiers:
    """Multiplicative / additive modifiers consumed by PossessionEngine."""
    assist_probability_mod: float      # e.g. +0.15 means +15 %
    turnover_rate_mod: float           # e.g. +0.10 means +10 %
    defensive_rotation_mod: float      # positive = better help defense
    spacing_mod: float                 # positive = better driving lanes
    clutch_mod: float                  # positive = better in crunch time


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_POSITION_COMPLEMENTARY: dict[str, set[str]] = {
    "PG": {"SG", "SF", "PF", "C"},
    "SG": {"PG", "SF", "PF", "C"},
    "SF": {"PG", "SG", "PF", "C"},
    "PF": {"PG", "SG", "SF", "C"},
    "C":  {"PG", "SG", "SF", "PF"},
}

# Positions that pair well in pick-and-roll combos
_PNR_HANDLER_POSITIONS: set[str] = {"PG", "SG", "SF"}
_PNR_SCREENER_POSITIONS: set[str] = {"PF", "C"}


def _clamp(value: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, value))


def _pair_key(id_a: str, id_b: str) -> tuple[str, str]:
    """Canonical key so (a, b) and (b, a) resolve to the same entry."""
    return (id_a, id_b) if id_a <= id_b else (id_b, id_a)


# ---------------------------------------------------------------------------
# ChemistryEngine
# ---------------------------------------------------------------------------

class ChemistryEngine:
    """Comprehensive chemistry system for the NBA GM simulator.

    All public methods are pure-functional with respect to player/team state --
    they read attributes but never mutate them.  The ``familiarity`` dict is
    the only piece of mutable shared state; callers pass it in and receive
    updated copies from evolution helpers.
    """

    # ------------------------------------------------------------------
    # 1. Pairwise Player Chemistry
    # ------------------------------------------------------------------

    @staticmethod
    def pairwise_personality(a: Player, b: Player) -> float:
        """Return a personality compatibility score between two players.

        Range roughly -30 .. +20.
        """
        score = 0.0

        a_char = a.character
        b_char = b.character

        # --- Ego clashes ---
        if a_char.ego > 80 and b_char.ego > 80:
            # Two big egos on the court together -- friction
            score -= 15.0
        elif a_char.ego > 80 or b_char.ego > 80:
            # One ego is manageable, but mild drag
            score -= 3.0

        # --- Mentor / mentee dynamic ---
        if a_char.leadership > 80 and b_char.ego < 50:
            score += 10.0
        if b_char.leadership > 80 and a_char.ego < 50:
            score += 10.0

        # --- Temperament compatibility ---
        temperament_diff = abs(a_char.temperament - b_char.temperament)
        if temperament_diff <= 15:
            score += 5.0
        elif temperament_diff >= 50:
            score -= 3.0

        # --- Toxicity (low coachability pair) ---
        if a_char.coachability < 40 and b_char.coachability < 40:
            score -= 10.0

        # --- Work-ethic alignment ---
        work_ethic_diff = abs(a_char.work_ethic - b_char.work_ethic)
        if work_ethic_diff <= 10:
            score += 3.0
        elif work_ethic_diff >= 40:
            score -= 4.0

        # --- Competitiveness alignment ---
        comp_diff = abs(a_char.competitiveness - b_char.competitiveness)
        if comp_diff <= 15:
            score += 2.0
        elif comp_diff >= 50:
            score -= 2.0

        return score

    @staticmethod
    def pairwise_playstyle(a: Player, b: Player) -> float:
        """Return a playstyle-fit score between two players.

        Considers PnR synergy, catch-and-shoot + passer combos, and
        positional complementarity.  Range roughly -5 .. +20.
        """
        score = 0.0

        # --- Pick-and-roll synergy ---
        a_pos = a.bio.position
        b_pos = b.bio.position

        # Handler + screener combo
        if (a_pos in _PNR_HANDLER_POSITIONS and b_pos in _PNR_SCREENER_POSITIONS):
            handler_tendency = a.tendencies.pick_and_roll_ball_handler
            screener_tendency = b.tendencies.pick_and_roll_screener
            pnr_synergy = (handler_tendency + screener_tendency) / 200.0  # 0..1
            score += pnr_synergy * 8.0  # up to +8

        if (b_pos in _PNR_HANDLER_POSITIONS and a_pos in _PNR_SCREENER_POSITIONS):
            handler_tendency = b.tendencies.pick_and_roll_ball_handler
            screener_tendency = a.tendencies.pick_and_roll_screener
            pnr_synergy = (handler_tendency + screener_tendency) / 200.0
            score += pnr_synergy * 8.0

        # --- Catch-and-shoot + passing vision pairing ---
        if a.tendencies.catch_and_shoot_frequency > 65 and b.ratings.passing_vision > 75:
            score += 6.0
        if b.tendencies.catch_and_shoot_frequency > 65 and a.ratings.passing_vision > 75:
            score += 6.0

        # --- Spot-up shooter + playmaker ---
        if a.tendencies.spot_up_frequency > 60 and b.ratings.passing_vision > 70:
            score += 3.0
        if b.tendencies.spot_up_frequency > 60 and a.ratings.passing_vision > 70:
            score += 3.0

        # --- Complementary positions (same position = overlap) ---
        if a_pos == b_pos:
            score -= 5.0
        elif b_pos in _POSITION_COMPLEMENTARY.get(a_pos, set()):
            score += 2.0

        # --- Alley-oop chemistry ---
        if a.tendencies.alley_oop_pass_rate > 60 and b.ratings.vertical > 80:
            score += 3.0
        if b.tendencies.alley_oop_pass_rate > 60 and a.ratings.vertical > 80:
            score += 3.0

        return score

    @staticmethod
    def pairwise_age_bonus(a: Player, b: Player) -> float:
        """Players within 3 years of each other share a generational bond."""
        diff = abs(a.bio.age - b.bio.age)
        if diff <= 3:
            return 3.0
        if diff <= 6:
            return 1.0
        return 0.0

    def calculate_pairwise_chemistry(
        self,
        a: Player,
        b: Player,
        familiarity: dict[tuple[str, str], float],
    ) -> PairwiseResult:
        """Full pairwise chemistry between two players."""
        personality = self.pairwise_personality(a, b)
        playstyle = self.pairwise_playstyle(a, b)
        age = self.pairwise_age_bonus(a, b)
        fam = familiarity.get(_pair_key(a.id, b.id), 0.0)

        # Familiarity scales the positive chemistry -- you need time on the
        # court together to unlock it.  Negative chemistry is always felt.
        positive_total = max(0.0, personality + playstyle + age)
        negative_total = min(0.0, personality + playstyle + age)
        # At 0.0 familiarity only 30 % of the positive upside is realised;
        # at 1.0 it is fully realised.
        fam_scale = 0.30 + 0.70 * fam
        total = positive_total * fam_scale + negative_total

        return PairwiseResult(
            player_a_id=a.id,
            player_b_id=b.id,
            personality_score=personality,
            playstyle_score=playstyle,
            age_score=age,
            familiarity=fam,
            total=total,
        )

    # ------------------------------------------------------------------
    # 2. Lineup Chemistry (5 players on the court)
    # ------------------------------------------------------------------

    def calculate_lineup_chemistry(
        self,
        lineup: list[Player],
        familiarity: dict[tuple[str, str], float],
    ) -> LineupChemistry:
        """Calculate aggregate chemistry metrics for a five-man unit."""

        # -- Spacing rating (floor spacing based on 3PT threats) --
        shooters = sum(1 for p in lineup if p.ratings.three_point >= 75)
        spacing_map = {0: 0.70, 1: 0.85, 2: 0.92, 3: 0.97}
        spacing_rating = spacing_map.get(shooters, 1.0)  # 4+ = 1.0

        # -- Passing synergy --
        # Average passing vision weighted by mean familiarity to receivers
        passing_synergies: list[float] = []
        for passer in lineup:
            receivers = [p for p in lineup if p.id != passer.id]
            if not receivers:
                continue
            avg_fam_to_receivers = sum(
                familiarity.get(_pair_key(passer.id, r.id), 0.0)
                for r in receivers
            ) / len(receivers)
            vision_norm = passer.ratings.passing_vision / 99.0
            accuracy_norm = passer.ratings.passing_accuracy / 99.0
            passing_synergies.append(
                (vision_norm * 0.7 + accuracy_norm * 0.3) * (0.4 + 0.6 * avg_fam_to_receivers)
            )
        passing_synergy = sum(passing_synergies) / len(passing_synergies) if passing_synergies else 0.5

        # -- Pairwise chemistry aggregate --
        pair_total = 0.0
        pair_count = 0
        for i in range(len(lineup)):
            for j in range(i + 1, len(lineup)):
                pw = self.calculate_pairwise_chemistry(lineup[i], lineup[j], familiarity)
                pair_total += pw.total
                pair_count += 1
        avg_pair = pair_total / pair_count if pair_count else 0.0

        # -- Leadership factor --
        leader_ratings = [p.character.leadership for p in lineup]
        best_leader = max(leader_ratings) if leader_ratings else 0
        leader_count = sum(1 for r in leader_ratings if r > 80)
        if leader_count >= 2:
            leadership_factor = 1.0
        elif leader_count == 1:
            leadership_factor = 0.85
        elif best_leader >= 65:
            leadership_factor = 0.70
        else:
            leadership_factor = 0.55

        # -- Defensive cohesion --
        def_iq_scores: list[float] = []
        for i in range(len(lineup)):
            for j in range(i + 1, len(lineup)):
                fam_val = familiarity.get(_pair_key(lineup[i].id, lineup[j].id), 0.0)
                avg_def_iq = (lineup[i].ratings.defensive_iq + lineup[j].ratings.defensive_iq) / 2.0
                def_iq_scores.append((avg_def_iq / 99.0) * (0.4 + 0.6 * fam_val))
        defensive_cohesion = sum(def_iq_scores) / len(def_iq_scores) if def_iq_scores else 0.5

        # -- Offensive / defensive boosts --
        # Scale avg_pair (which lives roughly in -30..+20 range) into -0.10..+0.10
        offensive_boost = _clamp(avg_pair / 200.0, -0.10, 0.10)
        # Weight by spacing and passing for offense
        offensive_boost += (spacing_rating - 0.85) * 0.10  # spread bonus
        offensive_boost += (passing_synergy - 0.50) * 0.06
        offensive_boost = _clamp(offensive_boost, -0.10, 0.10)

        defensive_boost = _clamp(avg_pair / 250.0, -0.10, 0.10)
        # Weight defensive cohesion + leadership
        defensive_boost += (defensive_cohesion - 0.50) * 0.08
        defensive_boost += (leadership_factor - 0.70) * 0.05
        defensive_boost = _clamp(defensive_boost, -0.10, 0.10)

        return LineupChemistry(
            offensive_boost=round(offensive_boost, 4),
            defensive_boost=round(defensive_boost, 4),
            spacing_rating=round(spacing_rating, 2),
            passing_synergy=round(passing_synergy, 4),
            leadership_factor=round(leadership_factor, 2),
        )

    # ------------------------------------------------------------------
    # 3. Team-Level Chemistry
    # ------------------------------------------------------------------

    def calculate_team_chemistry(
        self,
        players: list[Player],
        familiarity: dict[tuple[str, str], float],
        record: tuple[int, int],
        coaching: object | None = None,
    ) -> TeamChemistry:
        """Full-roster chemistry for season-level bookkeeping.

        Parameters
        ----------
        players : list[Player]
            All rostered players (up to 15).
        familiarity : dict
            Shared-minutes familiarity mapping.
        record : tuple[int, int]
            (wins, losses) for the current season.
        coaching : CoachingStaff or None
            The team's coaching staff, if any.
        """
        # --- Locker room personality census ---
        leader_count = sum(1 for p in players if p.character.leadership > 80)
        ego_count = sum(1 for p in players if p.character.ego > 80)
        team_player_count = sum(
            1 for p in players
            if p.character.coachability > 75 and p.character.ego < 60
        )

        # --- New-player penalty ---
        new_count = 0
        for p in players:
            teammates = [t for t in players if t.id != p.id]
            if not teammates:
                continue
            max_fam = max(
                familiarity.get(_pair_key(p.id, t.id), 0.0) for t in teammates
            )
            if max_fam < 0.30:
                new_count += 1

        # --- Winning / losing modifier ---
        wins, losses = record
        if wins + losses == 0:
            winning_mod = 0
        elif wins > losses:
            winning_mod = 5
        else:
            diff = losses - wins
            if diff > 10:
                winning_mod = -8
            elif diff > 5:
                winning_mod = -4
            else:
                winning_mod = -1

        # --- Star-ego penalty ---
        # Sort players by overall descending; top-2 are the "stars"
        sorted_by_overall = sorted(players, key=lambda p: p.ratings.overall, reverse=True)
        top_stars = sorted_by_overall[:2]
        star_ego_penalty = 0
        if len(top_stars) >= 2:
            both_stars_big_ego = all(s.character.ego > 85 for s in top_stars)
            other_egos = sum(
                1 for p in players
                if p.id not in {s.id for s in top_stars} and p.character.ego > 80
            )
            if both_stars_big_ego and other_egos >= 2:
                star_ego_penalty = -12
            elif both_stars_big_ego:
                star_ego_penalty = -6

        # --- Coaching fit ---
        if players:
            avg_coachability = sum(p.character.coachability for p in players) / len(players)
        else:
            avg_coachability = 50.0
        if coaching is not None and hasattr(coaching, "head_coach"):
            coach_adapt = getattr(coaching.head_coach, "adaptability", 50)
            coaching_fit = (avg_coachability / 99.0) * (coach_adapt / 99.0)
        else:
            coaching_fit = avg_coachability / 99.0 * 0.5  # no coach info = half value

        # --- Aggregate ---
        base = 50.0
        leader_bonus = min(leader_count * 5, 15)       # up to +15
        ego_drag = ego_count * -3                       # each big ego drags
        team_player_bonus = min(team_player_count * 3, 12)
        new_penalty = new_count * -3
        coaching_bonus = (coaching_fit - 0.25) * 20     # -5 .. +15 roughly

        raw = (
            base
            + leader_bonus
            + ego_drag
            + team_player_bonus
            + new_penalty
            + winning_mod
            + star_ego_penalty
            + coaching_bonus
        )
        overall = int(_clamp(raw, 0, 100))

        return TeamChemistry(
            overall=overall,
            leader_count=leader_count,
            ego_count=ego_count,
            team_player_count=team_player_count,
            new_player_count=new_count,
            winning_modifier=winning_mod,
            star_ego_penalty=star_ego_penalty,
            coaching_fit=round(coaching_fit, 4),
        )

    # ------------------------------------------------------------------
    # 4. Chemistry Effects on Gameplay  (modifiers for PossessionEngine)
    # ------------------------------------------------------------------

    def get_chemistry_modifiers(
        self,
        lineup: list[Player],
        familiarity: dict[tuple[str, str], float],
    ) -> ChemistryModifiers:
        """Translate lineup chemistry into concrete gameplay modifiers.

        The returned ``ChemistryModifiers`` can be fed straight into the
        possession engine to adjust assist rates, turnovers, etc.
        """
        lc = self.calculate_lineup_chemistry(lineup, familiarity)

        # --- Assist probability modifier ---
        # High chemistry => up to +15 % assist rate
        # Bad chemistry  => up to -10 % assist rate
        # Driven mainly by passing_synergy + offensive_boost
        assist_raw = (lc.passing_synergy - 0.5) * 0.30 + lc.offensive_boost
        assist_probability_mod = _clamp(assist_raw, -0.10, 0.15)

        # --- Turnover rate modifier ---
        # Bad chemistry => up to +10 % extra turnovers
        # Great chemistry => -8 % turnovers
        # Inversely related to passing_synergy and familiarity
        avg_fam = self._lineup_avg_familiarity(lineup, familiarity)
        to_raw = (0.5 - lc.passing_synergy) * 0.20 + (0.5 - avg_fam) * 0.10 - lc.offensive_boost * 0.5
        turnover_rate_mod = _clamp(to_raw, -0.08, 0.10)

        # --- Defensive rotation modifier ---
        # Positive = better help-defense rotations
        def_raw = lc.defensive_boost + (lc.leadership_factor - 0.70) * 0.06
        defensive_rotation_mod = _clamp(def_raw, -0.10, 0.10)

        # --- Spacing modifier ---
        # Feeds driving lane quality -- 0.0 at neutral spacing
        spacing_mod = (lc.spacing_rating - 0.85) * 0.50
        spacing_mod = _clamp(spacing_mod, -0.10, 0.10)

        # --- Clutch modifier ---
        # Based on leadership + avg clutch rating of lineup
        avg_clutch = sum(p.character.clutch for p in lineup) / len(lineup) if lineup else 50.0
        clutch_raw = (avg_clutch - 50.0) / 500.0 + (lc.leadership_factor - 0.70) * 0.10
        clutch_mod = _clamp(clutch_raw, -0.08, 0.10)

        return ChemistryModifiers(
            assist_probability_mod=round(assist_probability_mod, 4),
            turnover_rate_mod=round(turnover_rate_mod, 4),
            defensive_rotation_mod=round(defensive_rotation_mod, 4),
            spacing_mod=round(spacing_mod, 4),
            clutch_mod=round(clutch_mod, 4),
        )

    # ------------------------------------------------------------------
    # 5. Chemistry Evolution
    # ------------------------------------------------------------------

    @staticmethod
    def update_familiarity_after_game(
        home_lineup_minutes: dict[str, float],
        away_lineup_minutes: dict[str, float],
        familiarity: dict[tuple[str, str], float],
    ) -> dict[tuple[str, str], float]:
        """Grow familiarity between teammates who shared the court.

        Parameters
        ----------
        home_lineup_minutes : dict[str, float]
            Mapping of player_id -> total minutes played for the home team.
        away_lineup_minutes : dict[str, float]
            Same for the away team.
        familiarity : dict
            Current familiarity state.  A **new dict** is returned; the
            original is not mutated.

        Returns
        -------
        dict
            Updated familiarity mapping.

        Notes
        -----
        Familiarity gain is proportional to overlapping minutes.  If two
        players each played 30 minutes, their maximum shared time is 30 min.
        We estimate shared minutes as ``min(mins_a, mins_b)`` -- an
        approximation that works well for a typical rotation.  The growth
        rate is ~0.01 per game where both play starter minutes (~30 min).
        """
        updated = dict(familiarity)

        for minutes_map in (home_lineup_minutes, away_lineup_minutes):
            ids = list(minutes_map.keys())
            for i in range(len(ids)):
                for j in range(i + 1, len(ids)):
                    p_a, p_b = ids[i], ids[j]
                    shared = min(minutes_map[p_a], minutes_map[p_b])
                    if shared <= 0:
                        continue
                    # ~0.01 gain when both play 30 min together
                    # Scale proportionally; cap at 0.02 per game
                    gain = (shared / 30.0) * 0.01
                    gain = min(gain, 0.02)
                    key = _pair_key(p_a, p_b)
                    current = updated.get(key, 0.0)
                    updated[key] = min(1.0, current + gain)

        return updated

    @staticmethod
    def process_trade(
        traded_player_id: str,
        new_team_players: list[str],
        familiarity: dict[tuple[str, str], float],
    ) -> dict[tuple[str, str], float]:
        """Adjust familiarity after a player is traded to a new team.

        * Familiarity between the traded player and new teammates resets
          to 0.05 (they are professionals -- not total strangers).
        * Familiarity with former teammates is preserved at its current
          level (they still remember how to play together if reunited).

        Parameters
        ----------
        traded_player_id : str
            The player who changed teams.
        new_team_players : list[str]
            Player IDs currently on the *destination* roster (not including
            the traded player).
        familiarity : dict
            Current familiarity state.

        Returns
        -------
        dict
            Updated familiarity mapping.
        """
        updated = dict(familiarity)

        for teammate_id in new_team_players:
            key = _pair_key(traded_player_id, teammate_id)
            # Only reset if not already familiar (e.g., former teammate
            # re-acquired via trade).  We set to 0.05 if they have no
            # prior relationship OR if their existing familiarity is below
            # the baseline.
            current = updated.get(key, 0.0)
            if current < 0.05:
                updated[key] = 0.05

        return updated

    @staticmethod
    def process_free_agent_signing(
        signed_player_id: str,
        roster_player_ids: list[str],
        familiarity: dict[tuple[str, str], float],
    ) -> dict[tuple[str, str], float]:
        """Adjust familiarity when a free agent signs with a team.

        Same logic as a trade -- baseline 0.05 with new teammates,
        existing familiarity preserved.
        """
        updated = dict(familiarity)
        for teammate_id in roster_player_ids:
            key = _pair_key(signed_player_id, teammate_id)
            current = updated.get(key, 0.0)
            if current < 0.05:
                updated[key] = 0.05
        return updated

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _lineup_avg_familiarity(
        lineup: list[Player],
        familiarity: dict[tuple[str, str], float],
    ) -> float:
        """Mean familiarity across all pairs in a lineup."""
        total = 0.0
        count = 0
        for i in range(len(lineup)):
            for j in range(i + 1, len(lineup)):
                total += familiarity.get(_pair_key(lineup[i].id, lineup[j].id), 0.0)
                count += 1
        return total / count if count else 0.0
