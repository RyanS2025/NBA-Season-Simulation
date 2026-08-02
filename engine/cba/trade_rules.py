from __future__ import annotations

from ..models.contract import ContractInfo, CBAConstants, TradePackage, TradeTeamPackage
from ..models.team import Team, DraftPickAsset

# Salary matching constants
OVER_CAP_MATCH_PCT = 1.25
OVER_CAP_MATCH_FLAT = 100_000
APRON_MATCH_PCT = 1.10
APRON_MATCH_FLAT = 100_000

# Roster limits
MIN_ROSTER_SIZE = 14
MAX_ROSTER_SIZE = 15
HARD_MAX_ROSTER = 20  # including two-way

# Max cash in a trade
MAX_CASH_CONSIDERATION = 6_100_000


class TradeValidator:
    """Validate NBA trades against CBA salary-matching, roster, and pick rules."""

    def __init__(self, cba: CBAConstants | None = None):
        if cba is None:
            from .salary_cap import get_default_cba
            cba = get_default_cba()
        self.cba = cba

    # ------------------------------------------------------------------
    # Primary validation entry point
    # ------------------------------------------------------------------

    def validate_trade(
        self,
        trade: TradePackage,
        teams: list[Team],
        contracts: list[ContractInfo],
    ) -> dict:
        """Validate the full trade. Returns {valid: bool, reasons: list[str]}."""
        errors: list[str] = []
        team_map = {t.id: t for t in teams}
        contract_map = {c.player_id: c for c in contracts}

        for tp in trade.teams:
            team = team_map.get(tp.team_id)
            if team is None:
                errors.append(f"Team {tp.team_id} not found")
                continue

            # --- Salary matching ---
            salary_result = self.check_salary_matching(tp, team, contracts)
            if not salary_result.get("valid", False):
                errors.append(salary_result.get("reason", "Salary matching failed"))

            # --- Roster limits ---
            players_in = len(tp.players_in)
            players_out = len(tp.players_out)
            if not self.check_roster_limits(team, players_in, players_out):
                errors.append(
                    f"{team.info.name}: trade would violate roster limits"
                )

            # --- Stepien Rule ---
            picks_out_assets = self._resolve_picks(tp.picks_out, team)
            if not self.check_stepien_rule(team, picks_out_assets):
                errors.append(
                    f"{team.info.name}: violates Stepien Rule "
                    "(cannot trade first-round picks in consecutive years)"
                )

            # --- Trade restrictions on players ---
            outgoing_contracts = [
                contract_map[pid]
                for pid in tp.players_out
                if pid in contract_map
            ]
            restriction_issues = self.check_trade_restrictions(outgoing_contracts)
            errors.extend(restriction_issues)

            # --- No-trade clauses ---
            ntc_issues = self.check_no_trade_clause(outgoing_contracts)
            errors.extend(ntc_issues)

            # --- Apron restrictions ---
            result_payroll = self._project_post_trade_payroll(
                tp, team, contracts
            )
            apron_issues = self.check_apron_restrictions(team, result_payroll)
            errors.extend(apron_issues)

            # --- Cash limits ---
            if tp.cash_out > MAX_CASH_CONSIDERATION:
                errors.append(
                    f"{team.info.name}: cash consideration "
                    f"(${tp.cash_out:,}) exceeds max (${MAX_CASH_CONSIDERATION:,})"
                )

        valid = len(errors) == 0
        trade.status = "valid" if valid else "invalid"
        trade.validation_errors = errors

        return {"valid": valid, "reasons": errors}

    # ------------------------------------------------------------------
    # Salary matching
    # ------------------------------------------------------------------

    def check_salary_matching(
        self,
        team_package: TradeTeamPackage,
        team: Team,
        contracts: list[ContractInfo],
    ) -> dict:
        """Check if the salary going in/out satisfies CBA matching rules."""
        salary_out = team_package.salary_out
        salary_in = team_package.salary_in

        # If salaries aren't pre-computed, compute from contracts
        if salary_out == 0 and team_package.players_out:
            salary_out = self._sum_salaries(
                team_package.players_out, contracts
            )
            team_package.salary_out = salary_out
        if salary_in == 0 and team_package.players_in:
            salary_in = self._sum_salaries(
                team_package.players_in, contracts
            )
            team_package.salary_in = salary_in

        payroll = team.finances.total_payroll
        cap = self.cba.salary_cap

        # --- Under the cap: can absorb salary into cap room ---
        if payroll <= cap:
            post_trade_payroll = payroll - salary_out + salary_in
            if post_trade_payroll <= cap:
                return {"valid": True, "rule": "under_cap_absorption"}
            # Partially under cap: can absorb up to cap space, rest must match
            available_room = cap - (payroll - salary_out)
            if salary_in <= available_room:
                return {"valid": True, "rule": "under_cap_absorption"}

        # --- Over the cap: 125% + $100K rule ---
        # Teams above the second apron use tighter 110% + $100K
        if payroll > self.cba.second_apron:
            allowed_in = int(salary_out * APRON_MATCH_PCT) + APRON_MATCH_FLAT
            if salary_in > allowed_in:
                return {
                    "valid": False,
                    "reason": (
                        f"{team.info.name}: above second apron, "
                        f"incoming ${salary_in:,} exceeds "
                        f"110%+$100K of outgoing ${salary_out:,} "
                        f"(max ${allowed_in:,})"
                    ),
                    "rule": "second_apron_matching",
                }
            return {"valid": True, "rule": "second_apron_matching"}

        # Standard over-cap matching
        allowed_in = int(salary_out * OVER_CAP_MATCH_PCT) + OVER_CAP_MATCH_FLAT
        if salary_in > allowed_in:
            return {
                "valid": False,
                "reason": (
                    f"{team.info.name}: over cap, "
                    f"incoming ${salary_in:,} exceeds "
                    f"125%+$100K of outgoing ${salary_out:,} "
                    f"(max ${allowed_in:,})"
                ),
                "rule": "over_cap_matching",
            }
        return {"valid": True, "rule": "over_cap_matching"}

    # ------------------------------------------------------------------
    # Roster limits
    # ------------------------------------------------------------------

    def check_roster_limits(
        self,
        team: Team,
        players_in: int,
        players_out: int,
    ) -> bool:
        """Ensure trade doesn't push roster above max or below min."""
        current = len(team.roster)
        post_trade = current - players_out + players_in
        return MIN_ROSTER_SIZE <= post_trade <= MAX_ROSTER_SIZE

    # ------------------------------------------------------------------
    # Stepien Rule
    # ------------------------------------------------------------------

    def check_stepien_rule(
        self,
        team: Team,
        picks_out: list[DraftPickAsset],
    ) -> bool:
        """Teams must retain a first-round pick in every other future year.

        The Stepien Rule prevents trading first-round picks in consecutive
        years, ensuring at least one first in every two-year window.
        """
        first_round_out_years: set[int] = set()
        for p in picks_out:
            if p.round == 1 and p.original_team_id == team.id:
                first_round_out_years.add(p.year)

        if not first_round_out_years:
            return True

        # Also gather first-round picks the team already traded away
        already_traded_years: set[int] = set()
        for dp in team.finances.draft_picks:
            if (
                dp.round == 1
                and dp.original_team_id == team.id
                and dp.current_owner_team_id != team.id
            ):
                already_traded_years.add(dp.year)

        all_out = first_round_out_years | already_traded_years

        if not all_out:
            return True

        # Check: no two consecutive years can both be missing
        sorted_years = sorted(all_out)
        for i in range(len(sorted_years) - 1):
            if sorted_years[i + 1] - sorted_years[i] == 1:
                return False

        return True

    # ------------------------------------------------------------------
    # Trade restrictions
    # ------------------------------------------------------------------

    def check_trade_restrictions(
        self,
        contracts: list[ContractInfo],
    ) -> list[str]:
        """Check for recently-signed or other trade restrictions."""
        issues: list[str] = []
        for c in contracts:
            if c.trade_restriction is not None:
                issues.append(
                    f"Player {c.player_id} has trade restriction: "
                    f"{c.trade_restriction.restriction_type} "
                    f"until {c.trade_restriction.restriction_end_date}"
                )
        return issues

    # ------------------------------------------------------------------
    # No-trade clauses
    # ------------------------------------------------------------------

    def check_no_trade_clause(
        self,
        contracts: list[ContractInfo],
    ) -> list[str]:
        """Flag players with no-trade clauses (requires player consent)."""
        issues: list[str] = []
        for c in contracts:
            if c.has_no_trade_clause:
                issues.append(
                    f"Player {c.player_id} has a no-trade clause "
                    "(requires player consent)"
                )
        return issues

    # ------------------------------------------------------------------
    # Apron restrictions
    # ------------------------------------------------------------------

    def check_apron_restrictions(
        self,
        team: Team,
        trade_result_payroll: int,
    ) -> list[str]:
        """Check apron-related restrictions that may block the trade."""
        issues: list[str] = []

        # First apron: if the trade would push the team over, warn
        if trade_result_payroll > self.cba.first_apron:
            issues.append(
                f"{team.info.name}: post-trade payroll "
                f"(${trade_result_payroll:,}) exceeds first apron "
                f"(${self.cba.first_apron:,}) -- limited exceptions available"
            )

        # Second apron: additional restrictions
        if trade_result_payroll > self.cba.second_apron:
            issues.append(
                f"{team.info.name}: post-trade payroll exceeds second apron "
                f"-- sign-and-trade prohibited, cash aggregation limited"
            )

        # Hard cap check
        hard_capped = getattr(team.finances, "_hard_capped", False)
        if hard_capped and trade_result_payroll > self.cba.first_apron:
            issues.append(
                f"{team.info.name}: team is hard-capped at first apron "
                f"(${self.cba.first_apron:,}) and trade would exceed it"
            )

        return issues

    # ------------------------------------------------------------------
    # Salary breakdown
    # ------------------------------------------------------------------

    def calculate_salary_breakdown(
        self,
        trade: TradePackage,
        teams: list[Team],
        contracts: list[ContractInfo],
    ) -> dict:
        """Return a per-team breakdown of salary moving in and out."""
        contract_map = {c.player_id: c for c in contracts}
        team_map = {t.id: t for t in teams}
        breakdown: dict[str, dict] = {}

        for tp in trade.teams:
            team = team_map.get(tp.team_id)
            s_out = self._sum_salaries(tp.players_out, contracts)
            s_in = self._sum_salaries(tp.players_in, contracts)
            pre_payroll = team.finances.total_payroll if team else 0
            post_payroll = pre_payroll - s_out + s_in

            breakdown[tp.team_id] = {
                "salary_out": s_out,
                "salary_in": s_in,
                "net_salary_change": s_in - s_out,
                "pre_trade_payroll": pre_payroll,
                "post_trade_payroll": post_payroll,
                "cash_out": tp.cash_out,
                "cash_in": tp.cash_in,
                "picks_out": len(tp.picks_out),
                "picks_in": len(tp.picks_in),
            }

        return breakdown

    # ------------------------------------------------------------------
    # Trade exceptions
    # ------------------------------------------------------------------

    def generate_trade_exception(
        self,
        salary_out: int,
        salary_in: int,
    ) -> int:
        """If a team sends out more salary than it receives, it may get
        a traded player exception (TPE) for the difference."""
        if salary_out > salary_in:
            return salary_out - salary_in
        return 0

    def can_use_trade_exception(
        self,
        team: Team,
        incoming_salary: int,
        exception_amount: int,
    ) -> bool:
        """Check if a trade exception can absorb the incoming salary."""
        return incoming_salary <= exception_amount

    # ------------------------------------------------------------------
    # Sign-and-trade
    # ------------------------------------------------------------------

    def check_sign_and_trade_rules(
        self,
        player_contract: ContractInfo,
        receiving_team: Team,
    ) -> dict:
        """Validate sign-and-trade conditions.

        - Contract must be 3-4 years
        - Receiving team gets hard-capped at first apron
        - Not available for second-apron teams
        """
        errors: list[str] = []
        years = len(player_contract.years)

        if years < 3:
            errors.append("Sign-and-trade contract must be at least 3 years")
        if years > 4:
            errors.append("Sign-and-trade contract cannot exceed 4 years")

        payroll = receiving_team.finances.total_payroll
        if payroll > self.cba.second_apron:
            errors.append(
                "Receiving team is above the second apron; "
                "sign-and-trade is prohibited"
            )

        return {
            "valid": len(errors) == 0,
            "reasons": errors,
            "triggers_hard_cap": True,
            "hard_cap_amount": self.cba.first_apron,
        }

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _sum_salaries(
        self,
        player_ids: list[str],
        contracts: list[ContractInfo],
    ) -> int:
        """Sum current-year salaries for a list of player IDs."""
        contract_map = {c.player_id: c for c in contracts}
        total = 0
        for pid in player_ids:
            c = contract_map.get(pid)
            if c and c.years:
                total += c.years[0].salary
        return total

    def _resolve_picks(
        self,
        picks: list,
        team: Team,
    ) -> list[DraftPickAsset]:
        """Convert raw pick data to DraftPickAsset objects if needed."""
        assets: list[DraftPickAsset] = []
        for p in picks:
            if isinstance(p, DraftPickAsset):
                assets.append(p)
            elif isinstance(p, dict):
                assets.append(
                    DraftPickAsset(
                        year=p.get("year", 0),
                        round=p.get("round", 1),
                        original_team_id=p.get(
                            "original_team_id", team.id
                        ),
                        current_owner_team_id=p.get(
                            "current_owner_team_id", team.id
                        ),
                        protections=p.get("protections", []),
                        is_swap_right=p.get("is_swap_right", False),
                    )
                )
        return assets

    def _project_post_trade_payroll(
        self,
        tp: TradeTeamPackage,
        team: Team,
        contracts: list[ContractInfo],
    ) -> int:
        """Project what the team's payroll would be after the trade."""
        current = team.finances.total_payroll
        s_out = self._sum_salaries(tp.players_out, contracts)
        s_in = self._sum_salaries(tp.players_in, contracts)
        return current - s_out + s_in
