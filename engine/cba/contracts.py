from __future__ import annotations

import uuid
from ..models.contract import ContractInfo, ContractYear, CBAConstants, ContractIncentive
from ..models.player import Player

# 2024-25 rookie scale (approximate slot values by overall pick)
# Index 0 = pick 1, index 29 = pick 30
ROOKIE_SCALE_YEAR1: list[int] = [
    11_600_100, 10_267_200, 9_219_600, 8_292_600, 7_596_600,
    6_767_400, 6_303_600, 5_839_800, 5_376_000, 5_045_400,
    4_714_800, 4_384_200, 4_053_600, 3_840_600, 3_627_600,
    3_414_600, 3_201_600, 2_988_600, 2_848_800, 2_722_200,
    2_595_600, 2_469_000, 2_342_400, 2_228_400, 2_149_800,
    2_071_200, 1_992_600, 1_927_200, 1_861_800, 1_796_400,
]

# Second-round picks get minimum salary
SECOND_ROUND_SALARY = 1_119_563

# Annual raise percentage on rookie scale
ROOKIE_RAISE_PCT = 0.05

# Veteran minimum salaries by years of service (2024-25)
VETERAN_MINIMUMS: dict[int, int] = {
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
}

# Max years by contract type
MAX_YEARS_BIRD = 5
MAX_YEARS_NON_BIRD = 4
MAX_YEARS_ROOKIE_EXTENSION = 5
MAX_YEARS_MLE = 4
MAX_YEARS_TAXPAYER_MLE = 2
MAX_YEARS_BAE = 2

DEFAULT_CAP = 140_588_000


def _new_id() -> str:
    return str(uuid.uuid4())[:12]


class ContractEngine:
    """Creates and manages NBA contracts under the CBA."""

    def __init__(self, cba: CBAConstants | None = None):
        if cba is None:
            from .salary_cap import get_default_cba
            cba = get_default_cba()
        self.cba = cba

    # ------------------------------------------------------------------
    # Max salary
    # ------------------------------------------------------------------

    def calculate_max_salary(self, years_in_league: int) -> int:
        """Max first-year salary based on years of service."""
        pcts = self.cba.max_contract_percentages or {"0-6": 0.25, "7-9": 0.30, "10+": 0.35}
        cap = self.cba.salary_cap or DEFAULT_CAP
        if years_in_league >= 10:
            pct = pcts.get("10+", 0.35)
        elif years_in_league >= 7:
            pct = pcts.get("7-9", 0.30)
        else:
            pct = pcts.get("0-6", 0.25)
        return int(cap * pct)

    # ------------------------------------------------------------------
    # Raises
    # ------------------------------------------------------------------

    def calculate_raises(self, base_salary: int, years: int, is_bird_rights: bool) -> list[int]:
        """Return list of annual salaries starting from *base_salary*."""
        raises = self.cba.annual_raises or {"bird": 0.08, "non_bird": 0.05}
        raise_pct = raises.get("bird", 0.08) if is_bird_rights else raises.get("non_bird", 0.05)
        salaries: list[int] = []
        current = base_salary
        for _ in range(years):
            salaries.append(int(current))
            current = current * (1 + raise_pct)
        return salaries

    # ------------------------------------------------------------------
    # Contract creation helpers
    # ------------------------------------------------------------------

    def _build_contract_years(
        self,
        annual_salaries: list[int],
        start_year_offset: int = 0,
        is_guaranteed: bool = True,
        team_option_year: int | None = None,
        player_option_year: int | None = None,
    ) -> list[ContractYear]:
        years: list[ContractYear] = []
        for i, sal in enumerate(annual_salaries):
            guaranteed = is_guaranteed
            # Option years are non-guaranteed until exercised
            if team_option_year is not None and i + 1 == team_option_year:
                guaranteed = False
            if player_option_year is not None and i + 1 == player_option_year:
                guaranteed = False
            years.append(ContractYear(year=i + start_year_offset, salary=sal, is_guaranteed=guaranteed))
        return years

    # ------------------------------------------------------------------
    # Rookie scale
    # ------------------------------------------------------------------

    def create_rookie_scale_contract(
        self,
        player: Player,
        pick_number: int,
        team_id: str,
    ) -> ContractInfo:
        """Create a rookie-scale contract based on draft position.

        First-round picks: 4-year deal (years 3-4 are team options).
        Second-round picks: 2-year minimum deal.
        """
        contract_id = _new_id()

        if pick_number <= 30:
            idx = max(0, pick_number - 1)
            base = ROOKIE_SCALE_YEAR1[idx] if idx < len(ROOKIE_SCALE_YEAR1) else ROOKIE_SCALE_YEAR1[-1]
            salaries = [int(base * (1 + ROOKIE_RAISE_PCT) ** i) for i in range(4)]
            years = self._build_contract_years(salaries, team_option_year=3)
            total = sum(salaries)
            return ContractInfo(
                id=contract_id,
                player_id=player.id,
                team_id=team_id,
                contract_type="rookie_scale",
                years=years,
                total_value=total,
                bird_rights_status="none",
                has_team_option=True,
                team_option_year=3,
                is_fully_guaranteed=False,
            )
        else:
            # Second-round pick: 2-year minimum
            sal = SECOND_ROUND_SALARY
            salaries = [sal, int(sal * 1.05)]
            years = self._build_contract_years(salaries)
            return ContractInfo(
                id=contract_id,
                player_id=player.id,
                team_id=team_id,
                contract_type="rookie_scale",
                years=years,
                total_value=sum(salaries),
                bird_rights_status="none",
                is_fully_guaranteed=True,
            )

    # ------------------------------------------------------------------
    # Veteran contracts
    # ------------------------------------------------------------------

    def create_veteran_contract(
        self,
        player: Player,
        team_id: str,
        years: int,
        annual_salary: int,
        contract_type: str = "standard",
        is_bird_rights: bool = False,
        player_option_year: int | None = None,
        team_option_year: int | None = None,
        no_trade_clause: bool = False,
        trade_kicker_pct: float = 0.0,
    ) -> ContractInfo:
        """Create a standard veteran contract with raises."""
        contract_id = _new_id()
        salaries = self.calculate_raises(annual_salary, years, is_bird_rights)
        contract_years = self._build_contract_years(
            salaries,
            player_option_year=player_option_year,
            team_option_year=team_option_year,
        )
        # Apply trade kicker
        if trade_kicker_pct > 0:
            for cy in contract_years:
                cy.trade_bonus = int(cy.salary * trade_kicker_pct / 100.0)

        return ContractInfo(
            id=contract_id,
            player_id=player.id,
            team_id=team_id,
            contract_type=contract_type,
            years=contract_years,
            total_value=sum(salaries),
            bird_rights_status="full_bird" if is_bird_rights else "none",
            has_player_option=player_option_year is not None,
            has_team_option=team_option_year is not None,
            player_option_year=player_option_year,
            team_option_year=team_option_year,
            has_no_trade_clause=no_trade_clause,
            is_fully_guaranteed=True,
        )

    # ------------------------------------------------------------------
    # Max contract
    # ------------------------------------------------------------------

    def create_max_contract(
        self,
        player: Player,
        team_id: str,
        years_in_league: int,
        num_years: int | None = None,
        is_bird_rights: bool = True,
        player_option_last_year: bool = False,
    ) -> ContractInfo:
        """Create a max contract for a player based on service time."""
        max_salary = self.calculate_max_salary(years_in_league)
        max_allowed_years = MAX_YEARS_BIRD if is_bird_rights else MAX_YEARS_NON_BIRD
        contract_years = num_years if num_years is not None else max_allowed_years
        contract_years = min(contract_years, max_allowed_years)

        po_year = contract_years if player_option_last_year else None

        # Supermax / no-trade clause for 10+ year vets on max
        no_trade = years_in_league >= 8

        return self.create_veteran_contract(
            player=player,
            team_id=team_id,
            years=contract_years,
            annual_salary=max_salary,
            contract_type="max",
            is_bird_rights=is_bird_rights,
            player_option_year=po_year,
            no_trade_clause=no_trade,
            trade_kicker_pct=15.0 if not no_trade else 0.0,
        )

    # ------------------------------------------------------------------
    # Minimum contract
    # ------------------------------------------------------------------

    def create_minimum_contract(
        self,
        player: Player,
        team_id: str,
        years_in_league: int,
        num_years: int = 1,
    ) -> ContractInfo:
        """Create a veteran minimum contract."""
        contract_id = _new_id()
        clamped = min(years_in_league, 10)
        mins = self.cba.veteran_minimums if self.cba.veteran_minimums else VETERAN_MINIMUMS
        base = mins.get(clamped, mins.get(10, 3_041_475))
        salaries = [base + int(base * 0.05 * i) for i in range(num_years)]
        years = self._build_contract_years(salaries)

        return ContractInfo(
            id=contract_id,
            player_id=player.id,
            team_id=team_id,
            contract_type="minimum",
            years=years,
            total_value=sum(salaries),
            is_fully_guaranteed=True,
        )

    # ------------------------------------------------------------------
    # MLE contracts
    # ------------------------------------------------------------------

    def create_mle_contract(
        self,
        player: Player,
        team_id: str,
        years: int,
        annual_salary: int,
        is_taxpayer: bool = False,
    ) -> ContractInfo:
        """Create a mid-level or taxpayer MLE contract."""
        max_years = MAX_YEARS_TAXPAYER_MLE if is_taxpayer else MAX_YEARS_MLE
        years = min(years, max_years)
        max_amount = self.cba.taxpayer_mle if is_taxpayer else self.cba.mid_level_exception
        first_year = min(annual_salary, max_amount)
        salaries = self.calculate_raises(first_year, years, is_bird_rights=False)
        contract_years = self._build_contract_years(salaries)

        ctype = "taxpayer_mle" if is_taxpayer else "mle"
        contract_id = _new_id()

        return ContractInfo(
            id=contract_id,
            player_id=player.id,
            team_id=team_id,
            contract_type=ctype,
            years=contract_years,
            total_value=sum(salaries),
            is_fully_guaranteed=True,
        )

    # ------------------------------------------------------------------
    # BAE contract
    # ------------------------------------------------------------------

    def create_bae_contract(
        self,
        player: Player,
        team_id: str,
        years: int = 1,
        annual_salary: int | None = None,
    ) -> ContractInfo:
        """Create a bi-annual exception contract."""
        contract_id = _new_id()
        years = min(years, MAX_YEARS_BAE)
        base = annual_salary if annual_salary is not None else self.cba.bi_annual_exception
        base = min(base, self.cba.bi_annual_exception)
        salaries = self.calculate_raises(base, years, is_bird_rights=False)
        contract_years = self._build_contract_years(salaries)

        return ContractInfo(
            id=contract_id,
            player_id=player.id,
            team_id=team_id,
            contract_type="bae",
            years=contract_years,
            total_value=sum(salaries),
            is_fully_guaranteed=True,
        )

    # ------------------------------------------------------------------
    # Two-way contract
    # ------------------------------------------------------------------

    def create_two_way_contract(self, player: Player, team_id: str) -> ContractInfo:
        """Create a two-way contract (does not count against cap)."""
        contract_id = _new_id()
        # Two-way salary is roughly 50% of minimum
        base = VETERAN_MINIMUMS.get(0, 1_119_563) // 2
        salaries = [base, int(base * 1.05)]
        years = self._build_contract_years(salaries)

        return ContractInfo(
            id=contract_id,
            player_id=player.id,
            team_id=team_id,
            contract_type="two_way",
            years=years,
            total_value=sum(salaries),
            is_fully_guaranteed=False,
        )

    # ------------------------------------------------------------------
    # 10-day contract
    # ------------------------------------------------------------------

    def create_ten_day_contract(self, player: Player, team_id: str) -> ContractInfo:
        """Create a 10-day contract at the veteran minimum prorated."""
        contract_id = _new_id()
        yrs = player.bio.years_in_league
        clamped = min(yrs, 10)
        mins = self.cba.veteran_minimums if self.cba.veteran_minimums else VETERAN_MINIMUMS
        full_min = mins.get(clamped, mins.get(0, 1_119_563))
        # 10 days out of ~170 remaining season days
        prorated = int(full_min * 10 / 170)
        years = [ContractYear(year=0, salary=prorated, is_guaranteed=True)]

        return ContractInfo(
            id=contract_id,
            player_id=player.id,
            team_id=team_id,
            contract_type="ten_day",
            years=years,
            total_value=prorated,
            is_fully_guaranteed=True,
        )

    # ------------------------------------------------------------------
    # Qualifying offers
    # ------------------------------------------------------------------

    def get_qualifying_offer_amount(self, contract: ContractInfo) -> int:
        """Calculate the qualifying offer for a restricted free agent.

        Rookie scale: 130% of the 4th-year salary.
        Other: 110% of final-year salary.
        """
        if not contract.years:
            return 0
        last_salary = contract.years[-1].salary
        if contract.contract_type == "rookie_scale":
            return int(last_salary * 1.30)
        return int(last_salary * 1.10)

    # ------------------------------------------------------------------
    # Options
    # ------------------------------------------------------------------

    def exercise_option(self, contract: ContractInfo, option_type: str) -> ContractInfo:
        """Exercise a player or team option, guaranteeing that year."""
        if option_type == "player" and contract.has_player_option and contract.player_option_year is not None:
            idx = contract.player_option_year - 1
            if 0 <= idx < len(contract.years):
                contract.years[idx].is_guaranteed = True
            contract.has_player_option = False
        elif option_type == "team" and contract.has_team_option and contract.team_option_year is not None:
            idx = contract.team_option_year - 1
            if 0 <= idx < len(contract.years):
                contract.years[idx].is_guaranteed = True
            contract.has_team_option = False
        return contract

    def decline_option(self, contract: ContractInfo, option_type: str) -> ContractInfo:
        """Decline an option, removing the option year(s) from the contract."""
        if option_type == "player" and contract.has_player_option and contract.player_option_year is not None:
            idx = contract.player_option_year - 1
            contract.years = contract.years[:idx]
            contract.total_value = sum(y.salary for y in contract.years)
            contract.has_player_option = False
            contract.player_option_year = None
        elif option_type == "team" and contract.has_team_option and contract.team_option_year is not None:
            idx = contract.team_option_year - 1
            contract.years = contract.years[:idx]
            contract.total_value = sum(y.salary for y in contract.years)
            contract.has_team_option = False
            contract.team_option_year = None
        return contract

    # ------------------------------------------------------------------
    # Extensions
    # ------------------------------------------------------------------

    def is_extension_eligible(self, contract: ContractInfo, current_date: str) -> bool:
        """Check if a player is eligible for a contract extension.

        Rookie scale: eligible after 3rd season.
        Veterans: eligible after 3rd year of current deal (or 2nd for short deals).
        """
        if not contract.years:
            return False

        remaining = len(contract.years)

        if contract.contract_type == "rookie_scale":
            # Eligible before 4th-year option decision
            return remaining <= 2

        # Veterans: eligible in the last year of deal
        return remaining <= 2

    def extend_contract(
        self,
        contract: ContractInfo,
        additional_years: int,
        new_salary: int,
    ) -> ContractInfo:
        """Add extension years to an existing contract."""
        is_bird = contract.bird_rights_status in ("full_bird", "early_bird")
        extension_salaries = self.calculate_raises(new_salary, additional_years, is_bird)
        start_year = len(contract.years)
        for i, sal in enumerate(extension_salaries):
            contract.years.append(
                ContractYear(year=start_year + i, salary=sal, is_guaranteed=True)
            )
        contract.total_value = sum(y.salary for y in contract.years)
        return contract

    # ------------------------------------------------------------------
    # Veteran minimum lookup
    # ------------------------------------------------------------------

    def get_veteran_minimum(self, years_in_league: int) -> int:
        """Return the minimum salary for a player with given years of service."""
        clamped = min(years_in_league, 10)
        mins = self.cba.veteran_minimums if self.cba.veteran_minimums else VETERAN_MINIMUMS
        return mins.get(clamped, mins.get(0, 1_119_563))

    # ------------------------------------------------------------------
    # Buyout / waive
    # ------------------------------------------------------------------

    def buyout_contract(self, contract: ContractInfo, buyout_amount: int) -> ContractInfo:
        """Negotiate a buyout. Remaining guaranteed money is reduced to buyout_amount."""
        remaining_guaranteed = sum(y.salary for y in contract.years if y.is_guaranteed)
        savings = remaining_guaranteed - buyout_amount
        # Remove future years, keep only current year at buyout amount
        if contract.years:
            contract.years = [ContractYear(year=0, salary=buyout_amount, is_guaranteed=True)]
        contract.total_value = buyout_amount
        return contract

    def waive_player(self, contract: ContractInfo) -> dict:
        """Waive a player. Return dead cap / stretch provision info."""
        remaining_guaranteed = sum(y.salary for y in contract.years if y.is_guaranteed)
        remaining_years = len(contract.years)
        # Stretch provision: spread over 2 * remaining years + 1
        stretch_years = 2 * remaining_years + 1
        stretch_annual = int(remaining_guaranteed / stretch_years) if stretch_years > 0 else 0

        return {
            "dead_cap": remaining_guaranteed,
            "remaining_years": remaining_years,
            "stretch_provision_available": remaining_guaranteed > 0,
            "stretch_years": stretch_years,
            "stretch_annual_charge": stretch_annual,
        }


# Alias for spec compatibility
ContractFactory = ContractEngine
