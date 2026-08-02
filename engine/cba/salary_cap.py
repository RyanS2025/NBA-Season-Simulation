from __future__ import annotations

from ..models.contract import ContractInfo, CBAConstants
from ..models.team import Team, TeamFinances, CapHold, TradeException

# 2024-25 CBA default constants
DEFAULT_SALARY_CAP = 140_588_000
DEFAULT_LUXURY_TAX = 170_814_000
DEFAULT_FIRST_APRON = 178_132_000
DEFAULT_SECOND_APRON = 188_931_000
DEFAULT_MINIMUM_TEAM_SALARY = 126_529_200  # 90% of cap

NON_TAXPAYER_MLE = 12_860_000
TAXPAYER_MLE = 5_180_000
BI_ANNUAL_EXCEPTION = 4_516_000
MINIMUM_PLAYER_SALARY = 1_119_563  # 0-year veteran minimum

# Luxury tax rate brackets (each bracket is $5M wide)
TAX_RATE_BRACKETS: list[tuple[int, float]] = [
    (5_000_000, 1.50),
    (5_000_000, 1.75),
    (5_000_000, 2.50),
    (5_000_000, 3.25),
    (5_000_000, 3.75),
    (5_000_000, 4.25),
]
TAX_RATE_INCREMENT = 0.50


def get_default_cba() -> CBAConstants:
    """Return a CBAConstants instance with 2024-25 default values."""
    return CBAConstants(
        salary_cap=DEFAULT_SALARY_CAP,
        luxury_tax_threshold=DEFAULT_LUXURY_TAX,
        first_apron=DEFAULT_FIRST_APRON,
        second_apron=DEFAULT_SECOND_APRON,
        minimum_team_salary=DEFAULT_MINIMUM_TEAM_SALARY,
        max_contract_percentages={
            "0-6": 0.25,
            "7-9": 0.30,
            "10+": 0.35,
        },
        veteran_minimums={
            0: 1_119_563,
            1: 1_789_256,
            2: 2_019_706,
            3: 2_087_519,
            4: 2_174_318,
            5: 2_346_535,
            6: 2_518_750,
            7: 2_692_991,
            8: 2_867_234,
            9: 2_867_234,
            10: 3_041_475,
        },
        mid_level_exception=NON_TAXPAYER_MLE,
        taxpayer_mle=TAXPAYER_MLE,
        bi_annual_exception=BI_ANNUAL_EXCEPTION,
        annual_raises={
            "bird": 0.08,
            "non_bird": 0.05,
        },
        trade_rules={
            "salary_match_pct": 1.25,
            "salary_match_flat": 100_000,
            "apron_match_pct": 1.10,
            "max_cash": 6_100_000,
        },
        hard_cap_triggers=["non_taxpayer_mle", "sign_and_trade", "bi_annual_exception"],
    )


class SalaryCapEngine:
    """Computes salary cap status, tax bills, and available exceptions."""

    def __init__(self, cba: CBAConstants | None = None):
        self.cba = cba if cba is not None else get_default_cba()

    # ------------------------------------------------------------------
    # Payroll helpers
    # ------------------------------------------------------------------

    def get_total_payroll(self, contracts: list[ContractInfo]) -> int:
        """Sum current-year salaries of all active contracts."""
        total = 0
        for c in contracts:
            if c.years:
                total += c.years[0].salary
        return total

    def get_cap_space(self, team: Team, contracts: list[ContractInfo]) -> int:
        """Available cap room (can be negative if over the cap)."""
        payroll = self.get_total_payroll(contracts)
        cap_holds_total = sum(h.amount for h in team.finances.cap_holds)
        effective_payroll = payroll + cap_holds_total
        return self.cba.salary_cap - effective_payroll

    def calculate_cap_space(self, team: Team, contracts: list[ContractInfo]) -> int:
        """Alias for get_cap_space (matches spec naming)."""
        return self.get_cap_space(team, contracts)

    # ------------------------------------------------------------------
    # Cap / tax / apron status booleans
    # ------------------------------------------------------------------

    def is_over_cap(self, team: Team, contracts: list[ContractInfo]) -> bool:
        return self.get_cap_space(team, contracts) < 0

    def is_over_tax(self, team: Team, contracts: list[ContractInfo]) -> bool:
        payroll = self.get_total_payroll(contracts)
        return payroll > self.cba.luxury_tax_threshold

    def is_over_first_apron(self, team: Team, contracts: list[ContractInfo]) -> bool:
        payroll = self.get_total_payroll(contracts)
        return payroll > self.cba.first_apron

    def is_over_second_apron(self, team: Team, contracts: list[ContractInfo]) -> bool:
        payroll = self.get_total_payroll(contracts)
        return payroll > self.cba.second_apron

    # ------------------------------------------------------------------
    # Luxury tax
    # ------------------------------------------------------------------

    def calculate_luxury_tax(self, total_payroll: int) -> int:
        """Compute the incremental luxury tax bill."""
        if total_payroll <= self.cba.luxury_tax_threshold:
            return 0

        overage = total_payroll - self.cba.luxury_tax_threshold
        tax = 0
        remaining = overage

        # Walk through the defined brackets
        for bracket_size, rate in TAX_RATE_BRACKETS:
            if remaining <= 0:
                break
            taxable = min(remaining, bracket_size)
            tax += int(taxable * rate)
            remaining -= taxable

        # Any remaining overage past the defined brackets keeps climbing
        bracket_index = len(TAX_RATE_BRACKETS)
        while remaining > 0:
            rate = TAX_RATE_BRACKETS[-1][1] + TAX_RATE_INCREMENT * (bracket_index - len(TAX_RATE_BRACKETS) + 1)
            taxable = min(remaining, 5_000_000)
            tax += int(taxable * rate)
            remaining -= taxable
            bracket_index += 1

        return tax

    def calculate_tax_bill(self, team: Team, contracts: list[ContractInfo]) -> int:
        """Convenience: compute tax bill from team + contracts."""
        payroll = self.get_total_payroll(contracts)
        return self.calculate_luxury_tax(payroll)

    # ------------------------------------------------------------------
    # Apron status dict
    # ------------------------------------------------------------------

    def get_tax_apron_status(self, total_payroll: int) -> dict:
        """Return a dict summarising where the team sits relative to thresholds."""
        return {
            "total_payroll": total_payroll,
            "salary_cap": self.cba.salary_cap,
            "luxury_tax_threshold": self.cba.luxury_tax_threshold,
            "first_apron": self.cba.first_apron,
            "second_apron": self.cba.second_apron,
            "is_over_cap": total_payroll > self.cba.salary_cap,
            "is_over_tax": total_payroll > self.cba.luxury_tax_threshold,
            "is_over_first_apron": total_payroll > self.cba.first_apron,
            "is_over_second_apron": total_payroll > self.cba.second_apron,
            "cap_space": max(0, self.cba.salary_cap - total_payroll),
            "tax_bill": self.calculate_luxury_tax(total_payroll),
        }

    # ------------------------------------------------------------------
    # Exceptions
    # ------------------------------------------------------------------

    def get_available_exceptions(self, team: Team, contracts: list[ContractInfo]) -> dict:
        """Determine which salary exceptions the team can use."""
        payroll = self.get_total_payroll(contracts)
        over_cap = payroll > self.cba.salary_cap
        over_tax = payroll > self.cba.luxury_tax_threshold
        over_first_apron = payroll > self.cba.first_apron
        over_second_apron = payroll > self.cba.second_apron
        hard_capped = self.is_hard_capped(team)

        exceptions: dict[str, dict] = {}

        # Non-taxpayer MLE (only if over cap, not over first apron, and not hard capped)
        if over_cap and not over_first_apron and not hard_capped:
            exceptions["non_taxpayer_mle"] = {
                "amount": self.cba.mid_level_exception,
                "max_years": 4,
                "triggers_hard_cap": True,
            }

        # Taxpayer MLE (available to tax-paying teams, up to first apron only)
        if over_cap and over_tax and not over_first_apron:
            exceptions["taxpayer_mle"] = {
                "amount": self.cba.taxpayer_mle,
                "max_years": 2,
                "triggers_hard_cap": False,
            }

        # Bi-annual exception (only if not over first apron and not hard capped)
        if over_cap and not over_first_apron and not hard_capped:
            exceptions["bi_annual_exception"] = {
                "amount": self.cba.bi_annual_exception,
                "max_years": 2,
                "triggers_hard_cap": True,
            }

        # Minimum salary exception (always available)
        vet_mins = self.cba.veteran_minimums if self.cba.veteran_minimums else {}
        min_salary = vet_mins.get(0, MINIMUM_PLAYER_SALARY)
        exceptions["minimum_salary"] = {
            "amount": min_salary,
            "max_years": 2,
            "triggers_hard_cap": False,
        }

        # Trade exceptions (from team finances)
        for te in team.finances.trade_exceptions:
            exceptions[f"trade_exception_{te.source_trade_id}"] = {
                "amount": te.amount,
                "max_years": 1,
                "triggers_hard_cap": False,
                "expiration_date": te.expiration_date,
            }

        # Cap space (if under the cap)
        if not over_cap:
            cap_space = self.cba.salary_cap - payroll
            exceptions["cap_space"] = {
                "amount": cap_space,
                "max_years": 4,
                "triggers_hard_cap": False,
            }

        return exceptions

    # ------------------------------------------------------------------
    # Hard cap
    # ------------------------------------------------------------------

    def is_hard_capped(self, team: Team) -> bool:
        """A team is hard-capped if it has used a hard-cap-triggering exception.

        In a real system this would be tracked on the team's finances or a
        season-level flag. Here we check a simple boolean that should be
        set when a triggering signing happens.
        """
        return getattr(team.finances, "_hard_capped", False)

    def get_hard_cap_amount(self) -> int:
        """The hard cap is set at the first apron."""
        return self.cba.first_apron

    # ------------------------------------------------------------------
    # Projections
    # ------------------------------------------------------------------

    def project_next_year_salary(self, contracts: list[ContractInfo], season_year: int) -> int:
        """Project next season's committed payroll from guaranteed money."""
        total = 0
        for c in contracts:
            for yr in c.years:
                if yr.year == season_year + 1 and yr.is_guaranteed:
                    total += yr.salary
        return total

    # ------------------------------------------------------------------
    # Cap holds
    # ------------------------------------------------------------------

    def compute_cap_holds(self, team: Team, free_agents: list, draft_picks: list) -> int:
        """Sum cap holds for pending free agents and unsigned draft picks."""
        total = sum(h.amount for h in team.finances.cap_holds)
        return total

    # ------------------------------------------------------------------
    # Minimum team salary
    # ------------------------------------------------------------------

    def get_minimum_team_salary(self) -> int:
        return self.cba.minimum_team_salary

    # ------------------------------------------------------------------
    # Full cap sheet
    # ------------------------------------------------------------------

    def compute_cap_sheet(self, team: Team, contracts: list[ContractInfo]) -> dict:
        """Return a comprehensive cap summary for a team."""
        payroll = self.get_total_payroll(contracts)
        cap_holds_total = sum(h.amount for h in team.finances.cap_holds)
        effective_payroll = payroll + cap_holds_total
        cap_space = max(0, self.cba.salary_cap - effective_payroll)
        tax_bill = self.calculate_luxury_tax(payroll)

        return {
            "payroll": payroll,
            "cap_holds": cap_holds_total,
            "effective_payroll": effective_payroll,
            "salary_cap": self.cba.salary_cap,
            "cap_space": cap_space,
            "luxury_tax_threshold": self.cba.luxury_tax_threshold,
            "tax_bill": tax_bill,
            "first_apron": self.cba.first_apron,
            "second_apron": self.cba.second_apron,
            "is_over_cap": effective_payroll > self.cba.salary_cap,
            "is_over_tax": payroll > self.cba.luxury_tax_threshold,
            "is_over_first_apron": payroll > self.cba.first_apron,
            "is_over_second_apron": payroll > self.cba.second_apron,
            "is_hard_capped": self.is_hard_capped(team),
            "hard_cap_amount": self.get_hard_cap_amount(),
            "minimum_team_salary": self.get_minimum_team_salary(),
            "below_salary_floor": payroll < self.get_minimum_team_salary(),
            "available_exceptions": self.get_available_exceptions(team, contracts),
            "trade_exceptions": [
                {"amount": te.amount, "expiration": te.expiration_date}
                for te in team.finances.trade_exceptions
            ],
        }

    # ------------------------------------------------------------------
    # Update team finances object in-place
    # ------------------------------------------------------------------

    def update_team_finances(self, team: Team, contracts: list[ContractInfo]) -> TeamFinances:
        """Recalculate and update the team's finances dataclass."""
        payroll = self.get_total_payroll(contracts)
        tax_bill = self.calculate_luxury_tax(payroll)

        team.finances.salary_cap = self.cba.salary_cap
        team.finances.total_payroll = payroll
        team.finances.luxury_tax_threshold = self.cba.luxury_tax_threshold
        team.finances.first_apron_threshold = self.cba.first_apron
        team.finances.second_apron_threshold = self.cba.second_apron
        team.finances.is_over_cap = payroll > self.cba.salary_cap
        team.finances.is_in_luxury_tax = payroll > self.cba.luxury_tax_threshold
        team.finances.is_above_first_apron = payroll > self.cba.first_apron
        team.finances.is_above_second_apron = payroll > self.cba.second_apron
        team.finances.tax_bill = tax_bill

        return team.finances
