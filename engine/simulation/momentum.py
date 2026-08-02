from __future__ import annotations

from dataclasses import dataclass, field

from ..models.player import Player


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------

@dataclass
class MomentumState:
    """Tracks per-team momentum and recent possession history."""

    home_momentum: float = 0.0       # -1.0 to 1.0
    away_momentum: float = 0.0       # -1.0 to 1.0
    last_n_possessions: list[dict] = field(default_factory=list)  # last 8
    home_run: int = 0                # consecutive home scores w/o away scoring
    away_run: int = 0                # consecutive away scores w/o home scoring
    home_timeouts_remaining: int = 7
    away_timeouts_remaining: int = 7


@dataclass
class PlayerHotCold:
    """Per-player heat tracker for the hot-hand / cold-streak system."""

    player_id: str
    heat: float = 0.0                # -1.0 (cold) to 1.0 (hot)
    recent_shots: list[bool] = field(default_factory=list)  # last 5


@dataclass
class CrowdEnergy:
    """Home crowd energy level."""

    energy: float = 0.5              # 0.0 to 1.0
    is_home_arena: bool = True


@dataclass
class ClutchModifiers:
    """Modifiers returned by the clutch-time system."""

    shooting_mod: float = 0.0
    turnover_mod: float = 0.0
    free_throw_mod: float = 0.0


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _clamp(value: float, lo: float, hi: float) -> float:
    """Clamp *value* into [lo, hi]."""
    if value < lo:
        return lo
    if value > hi:
        return hi
    return value


# ---------------------------------------------------------------------------
# MomentumEngine
# ---------------------------------------------------------------------------

class MomentumEngine:
    """Game-flow system: momentum, hot hand, crowd energy, clutch time.

    Instantiate once per game.  After every possession call
    ``update_after_possession`` with the raw possession result dict and the
    current game-state information to keep all sub-systems in sync.
    """

    def __init__(self, is_playoff: bool = False) -> None:
        self.momentum = MomentumState()
        self.crowd = CrowdEnergy()
        self.player_heat: dict[str, PlayerHotCold] = {}
        self.is_playoff = is_playoff

    # ------------------------------------------------------------------
    # 1. Team Momentum
    # ------------------------------------------------------------------

    def _update_momentum(self, result: dict, possession_team: str) -> None:
        """Adjust momentum values after a single possession."""
        is_home = possession_team == "home"
        points = result.get("points", 0)
        shot = result.get("shot_attempt", None)
        turnover = result.get("turnover", False)
        steal = result.get("steal", False)
        block = result.get("block", False)

        off_delta = 0.0
        def_delta = 0.0

        # --- Scoring ---
        if points > 0:
            off_delta += 0.08
            is_three = False
            if shot is not None:
                is_three = getattr(shot, "zone_id", "").startswith("three_") or getattr(shot, "zone_id", "") == "backcourt"
            if is_three and points >= 3:
                off_delta += 0.04          # total +0.12 for a 3
            and_one = result.get("and_one", False)
            if and_one:
                off_delta += 0.07          # total +0.15 for an and-one

        # --- Defensive stop (no points, no turnover by defense) ---
        if points == 0 and not turnover:
            def_delta += 0.05

        # --- Highlight defensive plays ---
        if steal:
            def_delta += 0.10
        if block:
            def_delta += 0.10

        # --- Turnover by offense ---
        if turnover:
            off_delta -= 0.08

        # --- Run tracking ---
        if is_home:
            if points > 0:
                self.momentum.home_run += 1
                self.momentum.away_run = 0
            elif turnover or points == 0:
                # opponent "scored" a stop — doesn't break a run yet
                pass
        else:
            if points > 0:
                self.momentum.away_run += 1
                self.momentum.home_run = 0
            elif turnover or points == 0:
                pass

        # Break opponent run on a score
        if is_home and points > 0:
            self.momentum.away_run = 0
        elif not is_home and points > 0:
            self.momentum.home_run = 0

        run_length = self.momentum.home_run if is_home else self.momentum.away_run
        if run_length >= 3:
            off_delta += 0.05

        # --- Natural decay ---
        self.momentum.home_momentum *= (1.0 - 0.02)
        self.momentum.away_momentum *= (1.0 - 0.02)

        # --- Apply deltas ---
        if is_home:
            self.momentum.home_momentum += off_delta
            self.momentum.away_momentum += def_delta
        else:
            self.momentum.away_momentum += off_delta
            self.momentum.home_momentum += def_delta

        # Clamp
        self.momentum.home_momentum = _clamp(self.momentum.home_momentum, -1.0, 1.0)
        self.momentum.away_momentum = _clamp(self.momentum.away_momentum, -1.0, 1.0)

        # --- Possession history (keep last 8) ---
        entry = {
            "team": possession_team,
            "points": points,
            "turnover": turnover,
        }
        self.momentum.last_n_possessions.append(entry)
        if len(self.momentum.last_n_possessions) > 8:
            self.momentum.last_n_possessions = self.momentum.last_n_possessions[-8:]

    def call_timeout(self, calling_team: str) -> bool:
        """Call a timeout for *calling_team* ("home" / "away").

        Reduces the opponent's momentum by 40 % and resets the opponent's
        scoring run.  Returns ``True`` if the timeout was successfully used
        (i.e. a timeout was available).
        """
        if calling_team == "home":
            if self.momentum.home_timeouts_remaining <= 0:
                return False
            self.momentum.home_timeouts_remaining -= 1
            self.momentum.away_momentum *= 0.60
            self.momentum.away_run = 0
        else:
            if self.momentum.away_timeouts_remaining <= 0:
                return False
            self.momentum.away_timeouts_remaining -= 1
            self.momentum.home_momentum *= 0.60
            self.momentum.home_run = 0
        return True

    def get_momentum(self, team: str) -> float:
        """Return the current momentum value for *team*."""
        if team == "home":
            return self.momentum.home_momentum
        return self.momentum.away_momentum

    # ------------------------------------------------------------------
    # 2. Hot Hand / Cold Streak
    # ------------------------------------------------------------------

    def _ensure_player_heat(self, player_id: str) -> PlayerHotCold:
        if player_id not in self.player_heat:
            self.player_heat[player_id] = PlayerHotCold(player_id=player_id)
        return self.player_heat[player_id]

    def _update_hot_cold(self, result: dict) -> None:
        """Update per-player heat based on the possession result."""
        shot = result.get("shot_attempt", None)
        shooter_id = result.get("shooter_id", None)

        if shot is not None and shooter_id is not None:
            phc = self._ensure_player_heat(shooter_id)
            made = getattr(shot, "made", False)
            is_three = (
                getattr(shot, "zone_id", "").startswith("three_")
                or getattr(shot, "zone_id", "") == "backcourt"
            )
            if made:
                if is_three:
                    phc.heat += 0.20
                else:
                    phc.heat += 0.15
            else:
                phc.heat -= 0.10

            phc.recent_shots.append(made)
            if len(phc.recent_shots) > 5:
                phc.recent_shots = phc.recent_shots[-5:]

            phc.heat = _clamp(phc.heat, -1.0, 1.0)

        # Free-throw-only possessions also update heat for the shooter
        if shot is None and shooter_id is not None and result.get("foul") is not None:
            phc = self._ensure_player_heat(shooter_id)
            pts = result.get("points", 0)
            foul_info = result["foul"]
            ft_count = foul_info.get("free_throws", 2)
            if ft_count > 0 and pts == ft_count:
                phc.heat += 0.10     # perfect from the line
            elif pts == 0:
                phc.heat -= 0.10
            phc.heat = _clamp(phc.heat, -1.0, 1.0)

    def _decay_non_shooters(self, shooter_id: str | None) -> None:
        """Decay heat for every tracked player who did not shoot."""
        for pid, phc in self.player_heat.items():
            if pid != shooter_id:
                if phc.heat > 0:
                    phc.heat = max(0.0, phc.heat - 0.03)
                elif phc.heat < 0:
                    phc.heat = min(0.0, phc.heat + 0.03)

    def get_hot_hand_modifier(self, player_id: str) -> float:
        """Return a shooting-percentage modifier based on player heat.

        Positive means the player is shooting better than baseline;
        negative means worse (cold / pressing).
        """
        phc = self.player_heat.get(player_id)
        if phc is None:
            return 0.0
        h = phc.heat
        if h > 0.8:
            return 0.05
        if h > 0.5:
            return 0.03
        if h < -0.8:
            return -0.05
        if h < -0.5:
            return -0.03
        return 0.0

    # ------------------------------------------------------------------
    # 3. Crowd Energy (Home Court)
    # ------------------------------------------------------------------

    def _update_crowd(
        self, result: dict, possession_team: str, score_diff: int
    ) -> None:
        """Adjust crowd energy after a possession.

        *score_diff* is home_score - away_score (positive means home leads).
        """
        if not self.crowd.is_home_arena:
            return

        points = result.get("points", 0)
        shot = result.get("shot_attempt", None)
        steal = result.get("steal", False)
        block = result.get("block", False)
        turnover = result.get("turnover", False)
        is_home = possession_team == "home"

        delta = 0.0

        # --- Home big plays ---
        if is_home and points > 0:
            delta += 0.04
            is_three = False
            shot_type = ""
            if shot is not None:
                is_three = (
                    getattr(shot, "zone_id", "").startswith("three_")
                    or getattr(shot, "zone_id", "") == "backcourt"
                )
                shot_type = getattr(shot, "shot_type", "")
            if is_three:
                delta += 0.06          # crowd loves a 3
            if shot_type == "dunk":
                delta += 0.08          # dunk gets the arena on its feet

        # Home defensive highlight
        if not is_home:
            if steal:
                delta += 0.06
            if block:
                delta += 0.08
            if turnover:
                delta += 0.04          # visiting team turnover

        # Home scoring run
        if self.momentum.home_run >= 3:
            delta += 0.03

        # --- Away team dampeners ---
        if not is_home and points > 0:
            delta -= 0.04              # away scores, crowd quiets

        if self.momentum.away_run >= 3:
            delta -= 0.15              # away run silences the crowd

        # --- Blowout ---
        if score_diff >= 20:
            # Crowd relaxes when home is way up
            delta -= 0.05
        elif score_diff <= -20:
            # Crowd deflated when home down big
            delta -= 0.08

        # --- Natural regression toward 0.5 ---
        if self.crowd.energy > 0.5:
            delta -= 0.01
        elif self.crowd.energy < 0.5:
            delta += 0.01

        self.crowd.energy = _clamp(self.crowd.energy + delta, 0.0, 1.0)

    def get_crowd_shooting_modifier(self, is_home_team: bool) -> float:
        """Shooting percentage modifier from crowd energy.

        Home team gets a bonus when the crowd is rocking; away team is
        unaffected in shooting (crowd hurts their FT instead).
        """
        if not self.crowd.is_home_arena:
            return 0.0
        mult = 1.5 if self.is_playoff else 1.0
        if is_home_team:
            if self.crowd.energy > 0.9:
                return 0.04 * mult
            if self.crowd.energy > 0.7:
                return 0.02 * mult
        return 0.0

    def get_crowd_ft_modifier(self, is_home_team: bool) -> float:
        """Free-throw modifier from crowd pressure on the visiting team.

        Returns a negative number for the away team when the crowd is loud.
        """
        if not self.crowd.is_home_arena:
            return 0.0
        mult = 1.5 if self.is_playoff else 1.0
        if not is_home_team:
            if self.crowd.energy > 0.9:
                return -0.04 * mult
            if self.crowd.energy > 0.7:
                return -0.02 * mult
        return 0.0

    # ------------------------------------------------------------------
    # 4. Clutch Time
    # ------------------------------------------------------------------

    @staticmethod
    def is_clutch_time(
        quarter: int, game_clock: float, score_diff: int
    ) -> bool:
        """Q4 or OT, under 5 minutes, score within 5 points."""
        if quarter < 4:
            return False
        return game_clock <= 300.0 and abs(score_diff) <= 5

    @staticmethod
    def is_super_clutch(
        quarter: int, game_clock: float, score_diff: int
    ) -> bool:
        """Under 2 minutes, within 3 points, Q4 or OT."""
        if quarter < 4:
            return False
        return game_clock <= 120.0 and abs(score_diff) <= 3

    @staticmethod
    def get_clutch_modifier(
        player: Player,
        is_clutch: bool,
        is_super_clutch: bool,
        *,
        is_elimination: bool = False,
    ) -> ClutchModifiers:
        """Return shooting / turnover / FT modifiers for a player in clutch
        (or non-clutch) situations.
        """
        if not is_clutch:
            return ClutchModifiers()

        clutch_rating = player.character.clutch
        mods = ClutchModifiers()

        if clutch_rating > 85:
            mods.shooting_mod = 0.03
            mods.free_throw_mod = 0.02
            mods.turnover_mod = -0.02    # negative = fewer turnovers
        elif clutch_rating >= 70:
            pass                         # handles pressure — no change
        elif clutch_rating >= 50:
            mods.shooting_mod = -0.02
            mods.free_throw_mod = -0.03
            mods.turnover_mod = 0.03
        else:
            mods.shooting_mod = -0.05
            mods.free_throw_mod = -0.05
            mods.turnover_mod = 0.05

        # Super clutch amplifies the effect
        if is_super_clutch:
            mods.shooting_mod *= 1.5
            mods.free_throw_mod *= 1.5
            mods.turnover_mod *= 1.5

        # Competitiveness bonus in elimination games
        if is_elimination and player.character.competitiveness > 90:
            mods.shooting_mod += 0.02

        return mods

    # ------------------------------------------------------------------
    # 5. Garbage Time Detection
    # ------------------------------------------------------------------

    @staticmethod
    def is_garbage_time(
        quarter: int, game_clock: float, score_diff: int
    ) -> bool:
        """Detect garbage time where starters should be pulled."""
        if quarter < 4:
            return False
        diff = abs(score_diff)
        # 5+ minutes left, 25+ point gap
        if game_clock >= 300.0 and diff >= 25:
            return True
        # Under 3 minutes, 15+ point gap
        if game_clock <= 180.0 and diff >= 15:
            return True
        return False

    # ------------------------------------------------------------------
    # 6. End-of-Quarter Management
    # ------------------------------------------------------------------

    @staticmethod
    def should_go_for_two_for_one(
        game_clock: float, shot_clock: float
    ) -> bool:
        """Return ``True`` if the offense should shoot quickly to get an
        extra possession before the quarter ends (the "2-for-1")."""
        return 30.0 <= game_clock <= 40.0

    @staticmethod
    def is_last_shot(game_clock: float) -> bool:
        """Under 24 seconds left — this is the final possession."""
        return game_clock <= 24.0

    # ------------------------------------------------------------------
    # 7. Main update
    # ------------------------------------------------------------------

    def update_after_possession(
        self,
        result: dict,
        possession_team: str,
        game_state_info: dict,
    ) -> None:
        """Central entry point: update every sub-system after a possession.

        Parameters
        ----------
        result:
            The dict returned by ``PossessionEngine.simulate_possession``.
            Expected keys: ``points``, ``shot_attempt``, ``turnover``,
            ``shooter_id``.  Optional: ``steal``, ``block``, ``and_one``.
        possession_team:
            ``"home"`` or ``"away"``.
        game_state_info:
            Dict with game context.  Expected keys:
            ``quarter`` (int), ``game_clock`` (float),
            ``home_score`` (int), ``away_score`` (int),
            ``is_playoff`` (bool).
        """
        # Sync playoff flag if provided
        self.is_playoff = game_state_info.get("is_playoff", self.is_playoff)

        score_diff = game_state_info.get("home_score", 0) - game_state_info.get("away_score", 0)

        # 1. Momentum
        self._update_momentum(result, possession_team)

        # 2. Hot/cold
        self._update_hot_cold(result)
        self._decay_non_shooters(result.get("shooter_id"))

        # 3. Crowd
        self._update_crowd(result, possession_team, score_diff)
