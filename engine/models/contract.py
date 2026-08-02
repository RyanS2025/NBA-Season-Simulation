from __future__ import annotations
from dataclasses import dataclass, field

@dataclass
class ContractIncentive:
    description: str
    criteria: str
    amount: int
    incentive_type: str

@dataclass
class ContractYear:
    year: int
    salary: int
    is_guaranteed: bool = True
    guarantee_date: str | None = None
    incentives: list[ContractIncentive] = field(default_factory=list)
    trade_bonus: int = 0

@dataclass
class TradeRestriction:
    restriction_type: str
    restriction_end_date: str

@dataclass
class ContractInfo:
    id: str
    player_id: str
    team_id: str
    contract_type: str
    years: list[ContractYear] = field(default_factory=list)
    total_value: int = 0
    signing_date: str = ""
    bird_rights_status: str = "none"
    trade_restriction: TradeRestriction | None = None
    has_no_trade_clause: bool = False
    has_player_option: bool = False
    has_team_option: bool = False
    player_option_year: int | None = None
    team_option_year: int | None = None
    is_fully_guaranteed: bool = False
    poison_pill_provision: bool = False

@dataclass
class CBAConstants:
    salary_cap: int
    luxury_tax_threshold: int
    first_apron: int
    second_apron: int
    minimum_team_salary: int
    max_contract_percentages: dict = field(default_factory=dict)
    rookie_scale: dict = field(default_factory=dict)
    veteran_minimums: dict = field(default_factory=dict)
    mid_level_exception: int = 0
    taxpayer_mle: int = 0
    bi_annual_exception: int = 0
    annual_raises: dict = field(default_factory=dict)
    trade_rules: dict = field(default_factory=dict)
    hard_cap_triggers: list[str] = field(default_factory=list)

@dataclass
class RookieScaleEntry:
    year1: int
    year2: int
    year3_option: int
    year4_option: int

@dataclass
class TradeTeamPackage:
    team_id: str
    players_out: list[str] = field(default_factory=list)
    players_in: list[str] = field(default_factory=list)
    picks_out: list = field(default_factory=list)
    picks_in: list = field(default_factory=list)
    cash_out: int = 0
    cash_in: int = 0
    salary_out: int = 0
    salary_in: int = 0

@dataclass
class TradePackage:
    id: str
    teams: list[TradeTeamPackage] = field(default_factory=list)
    status: str = "proposed"
    validation_errors: list[str] = field(default_factory=list)
