"""Generate draft classes using the engine's ProspectGenerator."""

from __future__ import annotations

import json
import os
import sys

# Allow importing from project root
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from engine.draft.prospect_generator import ProspectGenerator


def main() -> None:
    out_dir = os.path.join(os.path.dirname(__file__), "..", "frontend", "public", "data")
    os.makedirs(out_dir, exist_ok=True)

    generator = ProspectGenerator()

    for year in (2027, 2028, 2029):
        prospects = generator.generate_draft_class(year=year, num_prospects=60)
        out_path = os.path.join(out_dir, f"draft_class_{year}.json")

        with open(out_path, "w") as f:
            json.dump(prospects, f, indent=2)

        # Quick summary
        overalls = [p["true_overall"] for p in prospects]
        avg_ovr = sum(overalls) / len(overalls)
        top = prospects[0]
        print(
            f"Draft class {year}: {len(prospects)} prospects "
            f"(avg overall {avg_ovr:.1f}, "
            f"top: {top['name']} {top['true_overall']} OVR) "
            f"-> {os.path.abspath(out_path)}"
        )


if __name__ == "__main__":
    main()
