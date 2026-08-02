from __future__ import annotations

from ..models.player import Player
from ..models.contract import ContractInfo, CBAConstants
from ..models.team import Team

# Bird rights status constants
FULL_BIRD = "full_bird"
EARLY_BIRD = "early_bird"
NON_BIRD = "non_bird"
NO_RIGHTS = "none"

# Cap hold percentages by bird rights type
CAP_HOLD_FULL_BIRD_PCT = 3.00       # 300% of prior salary (up to max)
CAP_HOLD_EARLY_BIRD_PCT = 2.50      # 250%
CAP_HOLD_NON_BIRD_PCT = 1.20        # 120%
CAP_HOLD_FIRST_ROUND_PICK_PCT = 1.90  # 190% for first-round picks

# Early Bird max: greater of 175% of prior salary or 105% of league average
EARLY_BIRD_RAISE_PCT = 1.75
EARLY_BIRD_AVG_PCT = 1.05

# Non-Bird max: 120% of prior salary or 120% of minimum
NON_BIRD_RAISE_PCT = 1.20

DEFAULT_CAP = 140_588_000


class BirdRightsEngine:
    """Track and compute Bird rights, cap holds, and re-signing privileges."""

    def __init__(self, cba: CBAConstants | None = None):
        if cba is None:
            from .salary_cap import get_default_cba
            cba = get_default_cba()
        self.cba = cba

    # ------------------------------------------------------------------
    # Bird rights determination
    # ------------------------------------------------------------------

    def get_bird_rights_status(
        self,
        player: Player,
        team: Team,
        contract: ContractInfo | None,
    ) -> str:
        """Determine a player's Bird rights type based on consecutive years with the team.

        Full Bird: 3+ consecutive years with the same team (without being waived
        or changing teams as a free agent).
        Early Bird: 2 consecutive years.
        Non-Bird: 1 year (or acquired mid-season).
        """
        if contract is None:
            return NO_RIGHTS

        # If contract stores bird_rights_status, trust it
        if contract.bird_rights_status and contract.bird_rights_status != "none":
            return contract.bird_rights_status

        # Otherwise estimate from contract duration and team tenure
        if contract.team_id != team.id:
            return NO_RIGHTS

        # Use the number of completed contract years as a proxy for
        # consecutive seasons with the team
        total_contract_years = len(contract.years)
        # years already completed = total - remaining
        # Since years list represents remaining years, infer tenure from
        # original signing context. For simplicity, use years_in_league and
        # contract length.
        years_with_team = self._estimate_years_with_team(player, contract)

        if years_with_team >= 3:
            return FULL_BIRD
        elif years_with_team >= 2:
            return EARLY_BIRD
        elif years_with_team >= 1:
            return NON_BIRD

        return NO_RIGHTS

    def _estimate_years_with_team(self, player: Player, contract: ContractInfo) -> int:
        """Estimate how many consecutive years a player has been with a team.

        In a full sim this would be tracked via transaction history.
        Here we use the contract's original length as a reasonable proxy.
        """
        if not contract.years:
            return 0
        # Total contract years is a good lower bound for tenure with team
        # (player was signed to this contract by the team)
        original_total = contract.total_value
        first_year_salary = contract.years[0].salary if contract.years else 0
        if first_year_salary > 0:
            estimated_years = max(1, round(original_total / first_year_salary))
        else:
            estimated_years = len(contract.years)
        return estimated_years

    # ------------------------------------------------------------------
    # Cap hold amounts
    # ------------------------------------------------------------------

    def get_cap_hold_amount(self, player: Player, bird_status: str) -> int:
        """Return the cap hold amount that must be charged against the cap
        while the team retains the player's Bird rights."""
        # Need prior salary — use contract if available
        prior_salary = self._get_prior_salary(player)

        if bird_status == FULL_BIRD:
            hold = int(prior_salary * CAP_HOLD_FULL_BIRD_PCT)
            # Cap hold capped at max salary
            cap = self.cba.salary_cap or DEFAULT_CAP
            max_sal = int(cap * 0.35)
            return min(hold, max_sal)
        elif bird_status == EARLY_BIRD:
            return int(prior_salary * CAP_HOLD_EARLY_BIRD_PCT)
        elif bird_status == NON_BIRD:
            return int(prior_salary * CAP_HOLD_NON_BIRD_PCT)

        # No rights — use minimum salary as placeholder
        return self._get_minimum_salary(player)

    def _get_prior_salary(self, player: Player) -> int:
        """Get the player's most recent salary. Falls back to minimum."""
        if player.contract is not None:
            contract: ContractInfo = player.contract
            if contract.years:
                return contract.years[0].salary
        return self._get_minimum_salary(player)

    def _get_minimum_salary(self, player: Player) -> int:
        """Veteran minimum based on years of service."""
        mins = self.cba.veteran_minimums if self.cba.veteran_minimums else {}
        yrs = min(player.bio.years_in_league, 10)
        return mins.get(yrs, 1_119_563)

    # ------------------------------------------------------------------
    # Re-signing privileges
    # ------------------------------------------------------------------

    def can_exceed_cap_to_sign(
        self,
        team: Team,
        player: Player,
        bird_status: str,
    ) -> bool:
        """Can the team exceed the salary cap to re-sign this player?

        Full Bird and Early Bird rights allow exceeding the cap.
        Non-Bird allows signing up to 120% of prior salary or minimum,
        whichever is greater, which may still exceed the cap slightly.
        """
        return bird_status in (FULL_BIRD, EARLY_BIRD, NON_BIRD)

    # ------------------------------------------------------------------
    # Max offer with Bird rights
    # ------------------------------------------------------------------

    def calculate_max_with_bird_rights(self, player: Player, bird_status: str) -> int:
        """Maximum first-year salary a team can offer using Bird rights."""
        cap = self.cba.salary_cap or DEFAULT_CAP

        if bird_status == FULL_BIRD:
            # Full Bird: up to the max salary
            years = player.bio.years_in_league
            pcts = self.cba.max_contract_percentages or {"0-6": 0.25, "7-9": 0.30, "10+": 0.35}
            if years >= 10:
                pct = pcts.get("10+", 0.35)
            elif years >= 7:
                pct = pcts.get("7-9", 0.30)
            else:
                pct = pcts.get("0-6", 0.25)
            return int(cap * pct)

        elif bird_status == EARLY_BIRD:
            return self.get_early_bird_max(player)

        elif bird_status == NON_BIRD:
            return self.get_non_bird_max(player)

        return self._get_minimum_salary(player)

    def get_early_bird_max(self, player: Player) -> int:
        """Early Bird max: greater of 175% of prior salary or 105% of league average salary."""
        prior = self._get_prior_salary(player)
        cap = self.cba.salary_cap or DEFAULT_CAP
        # League average salary is roughly cap / 15 (roster spots)
        league_avg = cap // 15

        option_a = int(prior * EARLY_BIRD_RAISE_PCT)
        option_b = int(league_avg * EARLY_BIRD_AVG_PCT)
        return max(option_a, option_b)

    def get_non_bird_max(self, player: Player) -> int:
        """Non-Bird max: greater of 120% of prior salary or 120% of minimum."""
        prior = self._get_prior_salary(player)
        minimum = self._get_minimum_salary(player)
        return max(int(prior * NON_BIRD_RAISE_PCT), int(minimum * NON_BIRD_RAISE_PCT))

    # ------------------------------------------------------------------
    # Renounce / trade
    # ------------------------------------------------------------------

    def renounce_bird_rights(self, player_id: str, team: Team) -> None:
        """Renounce a player's Bird rights, removing their cap hold."""
        team.finances.cap_holds = [
            h for h in team.finances.cap_holds if h.player_id != player_id
        ]

    def update_bird_rights_after_trade(self, player: Player, new_team: Team) -> str:
        """When a player is traded, their Bird rights transfer to the new team,
        but the clock does NOT reset — the acquiring team inherits the
        years toward Bird rights from the prior team."""
        if player.contract is None:
            return NO_RIGHTS

        contract: ContractInfo = player.contract
        # Bird rights transfer in trade: status is preserved
        current_status = contract.bird_rights_status
        if current_status in (FULL_BIRD, EARLY_BIRD, NON_BIRD):
            return current_status

        # If no prior bird status, start as non-bird with new team
        return NON_BIRD


# Alias for spec compatibility
BirdRightsTracker = BirdRightsEngine
