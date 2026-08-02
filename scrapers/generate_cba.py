"""Generate CBA (Collective Bargaining Agreement) constants for 2026-27 season."""

from __future__ import annotations

import json
import os


def generate_cba() -> dict:
    """Return CBA constants for the 2026-27 NBA season."""
    return {
        "season": "2026-27",
        "salary_cap": 141_000_000,
        "luxury_tax": 171_000_000,
        "first_apron": 178_000_000,
        "second_apron": 189_000_000,
        "minimum_team_salary": 113_000_000,
        "minimum_salaries": {
            "0": 1_157_603,
            "1": 1_900_441,
            "2": 2_165_952,
            "3": 2_241_780,
            "4": 2_375_112,
            "5": 2_574_918,
            "6": 2_774_724,
            "7": 2_996_094,
            "8": 3_217_464,
            "9": 3_326_149,
            "10_plus": 3_434_834,
        },
        "rookie_scale": {
            "1": {"year1": 12_200_000, "year2": 12_810_000, "year3_option": 13_450_000, "year4_option": 17_390_000},
            "2": {"year1": 10_900_000, "year2": 11_445_000, "year3_option": 12_017_000, "year4_option": 15_542_000},
            "3": {"year1": 9_780_000, "year2": 10_269_000, "year3_option": 10_782_000, "year4_option": 13_944_000},
            "4": {"year1": 8_790_000, "year2": 9_229_500, "year3_option": 9_691_000, "year4_option": 12_532_000},
            "5": {"year1": 7_920_000, "year2": 8_316_000, "year3_option": 8_732_000, "year4_option": 11_292_000},
            "6": {"year1": 7_150_000, "year2": 7_507_500, "year3_option": 7_883_000, "year4_option": 10_197_000},
            "7": {"year1": 6_470_000, "year2": 6_793_500, "year3_option": 7_133_000, "year4_option": 9_228_000},
            "8": {"year1": 5_870_000, "year2": 6_163_500, "year3_option": 6_472_000, "year4_option": 8_374_000},
            "9": {"year1": 5_340_000, "year2": 5_607_000, "year3_option": 5_887_000, "year4_option": 7_618_000},
            "10": {"year1": 4_880_000, "year2": 5_124_000, "year3_option": 5_380_000, "year4_option": 6_962_000},
            "11": {"year1": 4_470_000, "year2": 4_693_500, "year3_option": 4_928_000, "year4_option": 6_377_000},
            "12": {"year1": 4_100_000, "year2": 4_305_000, "year3_option": 4_520_000, "year4_option": 5_849_000},
            "13": {"year1": 3_780_000, "year2": 3_969_000, "year3_option": 4_167_000, "year4_option": 5_393_000},
            "14": {"year1": 3_490_000, "year2": 3_664_500, "year3_option": 3_848_000, "year4_option": 4_980_000},
            "15": {"year1": 3_310_000, "year2": 3_475_500, "year3_option": 3_649_000, "year4_option": 4_394_000},
            "16-30": {"year1": 2_400_000, "year2": 2_520_000, "year3_option": 2_646_000, "year4_option": 3_424_000},
        },
        "mid_level_exception": 14_000_000,
        "taxpayer_mle": 7_700_000,
        "bi_annual_exception": 4_700_000,
        "max_contract": {
            "0_6_years": {"pct_of_cap": 0.25, "amount": 35_250_000},
            "7_9_years": {"pct_of_cap": 0.30, "amount": 42_300_000},
            "10_plus_years": {"pct_of_cap": 0.35, "amount": 49_350_000},
        },
        "annual_raise": {
            "same_team": 0.08,
            "other_team": 0.05,
        },
        "trade_rules": {
            "salary_matching_over_cap_pct": 1.25,
            "salary_matching_over_cap_flat": 5_000_000,
        },
        "two_way_contract_salary": 580_000,
        "max_roster_size": 15,
        "min_roster_size": 14,
        "two_way_slots": 2,
    }


def main() -> None:
    cba = generate_cba()

    out_dir = os.path.join(os.path.dirname(__file__), "..", "frontend", "public", "data")
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, "cba_2026_27.json")

    with open(out_path, "w") as f:
        json.dump(cba, f, indent=2)

    print(f"Wrote CBA constants to {os.path.abspath(out_path)}")


if __name__ == "__main__":
    main()
