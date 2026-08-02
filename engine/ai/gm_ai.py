from __future__ import annotations

import random
from ..models.player import Player
from ..models.team import Team, DraftPickAsset
from ..models.contract import ContractInfo, CBAConstants, TradePackage, TradeTeamPackage
from ..models.league import LeagueSettings


# ---------------------------------------------------------------------------
# Player-value curve parameters
# ---------------------------------------------------------------------------
PRIME_AGE_START = 25
PRIME_AGE_END = 30
PEAK_DECLINE_RATE = 0.04      # value drops ~4% per year past prime
YOUNG_UPSIDE_BONUS = 0.12     # per year below prime
POTENTIAL_WEIGHT = 0.30

# Pick value baseline (1st overall = 100, 30th = 35, 2nd rounders scale down)
FIRST_PICK_VALUE = 100.0
LAST_LOTTERY_VALUE = 55.0
LAST_FIRST_ROUND_VALUE = 35.0
SECOND_ROUND_BASE = 15.0

# Trade evaluation thresholds
ACCEPT_THRESHOLD = 0.0        # net value must be >= 0 to accept
STRONG_ACCEPT = 5.0           # clearly good trade
AUTO_REJECT = -15.0           # lopsided against team

# Strategy labels
STRATEGY_CONTENDING = "contending"
STRATEGY_PLAYOFF = "playoff"
STRATEGY_REBUILDING = "rebuilding"
STRATEGY_RETOOLING = "retooling"


class GMAI:
    """CPU general-manager AI for trade proposals, evaluations, and roster
    management decisions."""

    def __init__(
        self,
        team: Team,
        players: list[Player],
        cba: CBAConstants,
        settings: LeagueSettings,
    ):
        self.team = team
        self.players = players
        self.cba = cba
        self.settings = settings

    # ==================================================================
    # Roster evaluation
    # ==================================================================

    def evaluate_roster(self) -> dict:
        """Score the current roster across several dimensions."""
        if not self.players:
            return {
                "overall": 0, "top_talent": 0, "depth": 0,
                "age_profile": 0, "salary_flexibility": 0,
            }

        ratings = sorted(
            [p.ratings.overall for p in self.players], reverse=True
        )

        top5 = ratings[:5]
        bench = ratings[5:10]

        top_talent = sum(top5) / len(top5) if top5 else 0
        depth = sum(bench) / len(bench) if bench else 0
        overall = top_talent * 0.65 + depth * 0.35

        avg_age = (
            sum(p.bio.age for p in self.players) / len(self.players)
        )
        # Age profile: 0-100 where 27 is ideal, penalise extremes
        age_score = max(0, 100 - abs(avg_age - 27) * 8)

        payroll = self.team.finances.total_payroll
        cap = self.cba.salary_cap or 140_588_000
        flex = max(0, 100 - max(0, (payroll - cap) / cap * 200))

        return {
            "overall": round(overall, 1),
            "top_talent": round(top_talent, 1),
            "depth": round(depth, 1),
            "age_profile": round(age_score, 1),
            "salary_flexibility": round(flex, 1),
        }

    # ==================================================================
    # Team strategy
    # ==================================================================

    def get_team_strategy(self) -> str:
        """Decide whether the team is contending, retooling, or rebuilding."""
        ev = self.evaluate_roster()
        talent = ev["top_talent"]
        record = self.team.season_record

        win_pct = 0.5
        total = record.wins + record.losses
        if total > 0:
            win_pct = record.wins / total

        if talent >= 80 and win_pct >= 0.55:
            return STRATEGY_CONTENDING
        if talent >= 73 and win_pct >= 0.45:
            return STRATEGY_PLAYOFF
        if talent < 68 or win_pct < 0.35:
            return STRATEGY_REBUILDING
        return STRATEGY_RETOOLING

    # ==================================================================
    # Identify roster needs
    # ==================================================================

    def identify_needs(self) -> list[str]:
        """Return a list of positional / skill needs."""
        needs: list[str] = []
        position_counts: dict[str, int] = {}
        position_ratings: dict[str, list[int]] = {}

        for p in self.players:
            pos = p.bio.position
            position_counts[pos] = position_counts.get(pos, 0) + 1
            position_ratings.setdefault(pos, []).append(p.ratings.overall)

        for pos in ("PG", "SG", "SF", "PF", "C"):
            count = position_counts.get(pos, 0)
            avg_rating = 0.0
            if pos in position_ratings and position_ratings[pos]:
                avg_rating = (
                    sum(position_ratings[pos]) / len(position_ratings[pos])
                )

            if count == 0:
                needs.append(f"{pos} (no players)")
            elif count < 2:
                needs.append(f"{pos} depth")
            elif avg_rating < 70:
                needs.append(f"{pos} upgrade")

        # Check for shooting
        avg_three = (
            sum(p.ratings.three_point for p in self.players)
            / max(1, len(self.players))
        )
        if avg_three < 65:
            needs.append("three-point shooting")

        # Check for defense
        avg_def = (
            sum(p.ratings.perimeter_defense + p.ratings.interior_defense
                for p in self.players)
            / max(1, len(self.players) * 2)
        )
        if avg_def < 65:
            needs.append("defensive improvement")

        return needs

    # ==================================================================
    # Player valuation
    # ==================================================================

    def calculate_player_value(self, player: Player) -> float:
        """Rate a player's overall trade value (0-100 scale).

        Factors: current ability, age curve, potential, contract burden.
        """
        ovr = player.ratings.overall
        pot = player.ratings.potential
        age = player.bio.age

        # Base value from overall rating
        base = ovr * 1.0

        # Age adjustment
        if age < PRIME_AGE_START:
            years_young = PRIME_AGE_START - age
            age_bonus = years_young * YOUNG_UPSIDE_BONUS * ovr
            base += age_bonus
        elif age > PRIME_AGE_END:
            years_old = age - PRIME_AGE_END
            age_penalty = years_old * PEAK_DECLINE_RATE * ovr
            base -= age_penalty

        # Potential upside
        if pot > ovr:
            base += (pot - ovr) * POTENTIAL_WEIGHT

        # Contract value (expensive players on bad deals lose value)
        contract_penalty = self._contract_penalty(player)
        base -= contract_penalty

        return max(0.0, min(100.0, round(base, 1)))

    def _contract_penalty(self, player: Player) -> float:
        """Penalise players whose salary significantly exceeds their
        production value."""
        if player.contract is None:
            return 0.0
        contract: ContractInfo = player.contract
        if not contract.years:
            return 0.0

        salary = contract.years[0].salary
        cap = self.cba.salary_cap or 140_588_000
        salary_pct = salary / cap

        # "Fair" salary percentage based on overall rating
        ovr = player.ratings.overall
        if ovr >= 90:
            fair_pct = 0.30
        elif ovr >= 80:
            fair_pct = 0.18
        elif ovr >= 75:
            fair_pct = 0.10
        elif ovr >= 70:
            fair_pct = 0.06
        else:
            fair_pct = 0.02

        overpay_pct = max(0.0, salary_pct - fair_pct)
        # Scale to a penalty in value points
        return overpay_pct * 80

    # ==================================================================
    # Pick valuation
    # ==================================================================

    def calculate_pick_value(
        self,
        pick: DraftPickAsset,
        projected_position: int,
    ) -> float:
        """Estimate the value of a draft pick (0-100 scale)."""
        pos = max(1, projected_position)

        if pos <= 5:
            value = FIRST_PICK_VALUE - (pos - 1) * 5
        elif pos <= 14:
            value = LAST_LOTTERY_VALUE + (14 - pos) * 2.5
        elif pos <= 30:
            span = LAST_FIRST_ROUND_VALUE
            value = span + (30 - pos) * 1.25
        else:
            value = max(
                2.0, SECOND_ROUND_BASE - (pos - 31) * 0.5
            )

        # Future picks are slightly less valuable (uncertainty)
        years_out = max(0, pick.year - 2027)
        value *= max(0.5, 1.0 - years_out * 0.08)

        # Swap rights are worth ~40% of a real pick
        if pick.is_swap_right:
            value *= 0.40

        # Protections reduce value
        if pick.protections:
            value *= 0.75

        return round(max(0.0, value), 1)

    # ==================================================================
    # Trade proposal generation
    # ==================================================================

    def propose_trade(
        self,
        all_teams: list[Team],
        all_players: list[Player],
    ) -> TradePackage | None:
        """Generate a realistic trade proposal targeting a roster need."""
        strategy = self.get_team_strategy()
        needs = self.identify_needs()

        if not needs:
            return None

        player_map: dict[str, Player] = {p.id: p for p in all_players}
        our_player_ids = {p.id for p in self.players}

        # Find trade targets on other teams
        targets: list[tuple[Player, Team]] = []
        for team in all_teams:
            if team.id == self.team.id:
                continue
            for slot in team.roster:
                p = player_map.get(slot.player_id)
                if p is None:
                    continue
                if self._fits_need(p, needs):
                    targets.append((p, team))

        if not targets:
            return None

        # Sort targets by value and pick the best realistic option
        targets.sort(
            key=lambda t: self.calculate_player_value(t[0]), reverse=True
        )

        # Try the top few targets
        for target_player, target_team in targets[:5]:
            package = self._build_package(
                target_player, target_team, strategy,
                player_map, our_player_ids,
            )
            if package is not None:
                return package

        return None

    def _fits_need(self, player: Player, needs: list[str]) -> bool:
        """Check if a player addresses any of the team's needs."""
        pos = player.bio.position
        for need in needs:
            if pos in need:
                return True
            if "shooting" in need and player.ratings.three_point >= 75:
                return True
            if "defense" in need and (
                player.ratings.perimeter_defense >= 75
                or player.ratings.interior_defense >= 75
            ):
                return True
        return False

    def _build_package(
        self,
        target: Player,
        target_team: Team,
        strategy: str,
        player_map: dict[str, Player],
        our_ids: set[str],
    ) -> TradePackage | None:
        """Try to construct a fair trade package for the target player."""
        target_value = self.calculate_player_value(target)

        # Identify expendable players (not top-3 on our team for contenders)
        our_sorted = sorted(self.players, key=lambda p: p.ratings.overall, reverse=True)
        protect_count = 3 if strategy == STRATEGY_CONTENDING else 2
        tradeable = [
            p for p in our_sorted[protect_count:]
            if p.id in our_ids
        ]

        if not tradeable:
            return None

        # Greedily assemble outgoing players until value roughly matches
        outgoing: list[Player] = []
        outgoing_value = 0.0

        for p in sorted(tradeable, key=lambda x: self.calculate_player_value(x), reverse=True):
            if outgoing_value >= target_value * 0.85:
                break
            outgoing.append(p)
            outgoing_value += self.calculate_player_value(p)

        if outgoing_value < target_value * 0.50:
            # Not enough value; can add a pick to sweeten
            outgoing_value += 30  # rough pick value bump
            if outgoing_value < target_value * 0.50:
                return None

        if not outgoing:
            return None

        import uuid
        trade_id = str(uuid.uuid4())[:12]

        our_package = TradeTeamPackage(
            team_id=self.team.id,
            players_out=[p.id for p in outgoing],
            players_in=[target.id],
        )

        their_package = TradeTeamPackage(
            team_id=target_team.id,
            players_out=[target.id],
            players_in=[p.id for p in outgoing],
        )

        return TradePackage(
            id=trade_id,
            teams=[our_package, their_package],
            status="proposed",
        )

    # ==================================================================
    # Trade evaluation
    # ==================================================================

    def evaluate_trade_offer(self, trade: TradePackage) -> dict:
        """Score a trade from this team's perspective.

        Returns dict with value_in, value_out, net_value, and recommendation.
        """
        return self._score_trade(trade)

    def should_accept_trade(
        self,
        trade: TradePackage,
        all_players: list[Player],
    ) -> bool:
        """Decide whether the CPU team should accept a trade offer."""
        score = self._score_trade(trade, all_players)
        net = score.get("net_value", 0)

        if net < AUTO_REJECT:
            return False

        # Add some randomness for personality
        noise = random.uniform(-3.0, 3.0)
        adjusted = net + noise

        # Contending teams have a higher bar (don't want to disrupt)
        strategy = self.get_team_strategy()
        if strategy == STRATEGY_CONTENDING:
            return adjusted >= 3.0
        if strategy == STRATEGY_REBUILDING:
            # Rebuilding teams accept if they get picks/youth
            return adjusted >= -2.0

        return adjusted >= ACCEPT_THRESHOLD

    def _score_trade(
        self,
        trade: TradePackage,
        all_players: list[Player] | None = None,
    ) -> dict:
        """Internal trade scoring."""
        player_map: dict[str, Player] = {}
        if all_players:
            player_map = {p.id: p for p in all_players}
        for p in self.players:
            player_map[p.id] = p

        value_in = 0.0
        value_out = 0.0

        for tp in trade.teams:
            if tp.team_id != self.team.id:
                continue

            for pid in tp.players_in:
                incoming = player_map.get(pid)
                if incoming is not None:
                    value_in += self.calculate_player_value(incoming)

            for pid in tp.players_out:
                outgoing = player_map.get(pid)
                if outgoing is not None:
                    value_out += self.calculate_player_value(outgoing)

            # Value picks
            for pick in tp.picks_in:
                if isinstance(pick, DraftPickAsset):
                    value_in += self.calculate_pick_value(pick, 15)
                elif isinstance(pick, dict):
                    value_in += pick.get("value", 20)

            for pick in tp.picks_out:
                if isinstance(pick, DraftPickAsset):
                    value_out += self.calculate_pick_value(pick, 15)
                elif isinstance(pick, dict):
                    value_out += pick.get("value", 20)

        net = value_in - value_out
        if net >= STRONG_ACCEPT:
            rec = "strong_accept"
        elif net >= ACCEPT_THRESHOLD:
            rec = "accept"
        elif net >= AUTO_REJECT:
            rec = "borderline_reject"
        else:
            rec = "reject"

        return {
            "value_in": round(value_in, 1),
            "value_out": round(value_out, 1),
            "net_value": round(net, 1),
            "recommendation": rec,
        }

    # ==================================================================
    # Free agency
    # ==================================================================

    def evaluate_free_agent(self, player: Player) -> dict:
        """Assess a free agent's fit and value for this team."""
        value = self.calculate_player_value(player)
        needs = self.identify_needs()
        fits_need = self._fits_need(player, needs)
        strategy = self.get_team_strategy()

        interest = "low"
        if fits_need and value >= 60:
            interest = "high"
        elif fits_need or value >= 70:
            interest = "medium"

        # Rebuilding teams mostly want young players
        if strategy == STRATEGY_REBUILDING and player.bio.age > 28:
            interest = "low"

        return {
            "player_id": player.id,
            "value": value,
            "fits_need": fits_need,
            "interest": interest,
            "strategy": strategy,
        }

    def make_free_agent_offer(self, player: Player) -> dict | None:
        """Generate a contract offer for a free agent, or None if
        not interested."""
        ev = self.evaluate_free_agent(player)
        if ev["interest"] == "low":
            return None

        cap = self.cba.salary_cap or 140_588_000
        value = ev["value"]

        # Salary offer scales with value
        if value >= 85:
            salary = int(cap * 0.28)
            years = 4
        elif value >= 75:
            salary = int(cap * 0.15)
            years = 3
        elif value >= 65:
            salary = int(cap * 0.07)
            years = 2
        else:
            salary = int(cap * 0.02)
            years = 1

        return {
            "player_id": player.id,
            "team_id": self.team.id,
            "annual_salary": salary,
            "years": years,
            "interest_level": ev["interest"],
        }

    # ==================================================================
    # Draft
    # ==================================================================

    def scout_draft_prospect(
        self,
        prospect: Player,
        scouting_level: int,
    ) -> dict:
        """Scout a draft prospect. Higher scouting_level = more accurate."""
        real_overall = prospect.ratings.overall
        real_potential = prospect.ratings.potential

        # Add noise inversely proportional to scouting level (1-100)
        noise_range = max(1, 20 - scouting_level // 5)
        scouted_overall = real_overall + random.randint(
            -noise_range, noise_range
        )
        scouted_potential = real_potential + random.randint(
            -noise_range, noise_range
        )

        scouted_overall = max(40, min(99, scouted_overall))
        scouted_potential = max(scouted_overall, min(99, scouted_potential))

        return {
            "player_id": prospect.id,
            "scouted_overall": scouted_overall,
            "scouted_potential": scouted_potential,
            "position": prospect.bio.position,
            "age": prospect.bio.age,
            "confidence": min(100, scouting_level + 20),
        }

    def make_draft_pick(
        self,
        available_prospects: list[Player],
        team_needs: list[str],
    ) -> str:
        """Select the best prospect, weighing talent and team needs."""
        if not available_prospects:
            return ""

        strategy = self.get_team_strategy()
        scored: list[tuple[float, Player]] = []

        for prospect in available_prospects:
            base = self.calculate_player_value(prospect)

            # Need bonus
            if self._fits_need(prospect, team_needs):
                base += 8

            # Rebuilding teams weight potential more
            if strategy == STRATEGY_REBUILDING:
                base += (prospect.ratings.potential - prospect.ratings.overall) * 0.4

            scored.append((base, prospect))

        scored.sort(key=lambda x: x[0], reverse=True)
        return scored[0][1].id

    # ==================================================================
    # Roster management
    # ==================================================================

    def should_waive_player(self, player: Player) -> bool:
        """Decide if a player should be waived."""
        if player.ratings.overall >= 70:
            return False

        # Only waive if not on a big contract
        if player.contract is not None:
            contract: ContractInfo = player.contract
            remaining_guaranteed = sum(
                y.salary for y in contract.years if y.is_guaranteed
            )
            cap = self.cba.salary_cap or 140_588_000
            if remaining_guaranteed > cap * 0.03:
                return False

        # Waive if roster is full and player is worst on team
        sorted_players = sorted(
            self.players, key=lambda p: p.ratings.overall
        )
        if len(sorted_players) >= MAX_ROSTER and player.id == sorted_players[0].id:
            return True

        return player.ratings.overall < 60

    def should_exercise_option(
        self,
        contract: ContractInfo,
        player: Player,
    ) -> bool:
        """Decide whether to exercise a team option."""
        if not contract.years:
            return False

        # Option year salary
        opt_idx = (contract.team_option_year or 1) - 1
        if opt_idx >= len(contract.years):
            return False
        option_salary = contract.years[opt_idx].salary

        # Compare to player value
        value = self.calculate_player_value(player)
        cap = self.cba.salary_cap or 140_588_000
        salary_pct = option_salary / cap

        # Exercise if the player is worth more than the salary
        if value >= 75 and salary_pct <= 0.25:
            return True
        if value >= 65 and salary_pct <= 0.10:
            return True
        if value >= 55 and salary_pct <= 0.03:
            return True

        return False

    # ==================================================================
    # Deadline strategy
    # ==================================================================

    def deadline_strategy(
        self,
        standings: dict,
        games_remaining: int,
    ) -> str:
        """Determine trade-deadline posture.

        Returns one of: 'buyer', 'seller', 'stand_pat'.
        """
        strategy = self.get_team_strategy()

        if strategy == STRATEGY_CONTENDING:
            return "buyer"
        if strategy == STRATEGY_REBUILDING:
            return "seller"

        # Playoff team: buy if in good position, otherwise hold
        record = self.team.season_record
        total = record.wins + record.losses
        if total == 0:
            return "stand_pat"

        win_pct = record.wins / total
        projected_wins = int(win_pct * (total + games_remaining))

        if projected_wins >= 48:
            return "buyer"
        if projected_wins <= 30:
            return "seller"

        return "stand_pat"

    def buyout_market_strategy(
        self,
        available_players: list[Player],
    ) -> list[str]:
        """Identify buyout-market targets worth signing."""
        strategy = self.get_team_strategy()
        if strategy == STRATEGY_REBUILDING:
            return []

        needs = self.identify_needs()
        targets: list[str] = []

        for p in available_players:
            if p.ratings.overall >= 68 and self._fits_need(p, needs):
                targets.append(p.id)

        return targets[:3]

    # ==================================================================
    # Extension decisions
    # ==================================================================

    def extension_decisions(
        self,
        eligible_contracts: list[ContractInfo],
        players: list[Player],
    ) -> list[dict]:
        """Decide which eligible players to extend."""
        player_map = {p.id: p for p in players}
        decisions: list[dict] = []

        for contract in eligible_contracts:
            player = player_map.get(contract.player_id)
            if player is None:
                continue

            value = self.calculate_player_value(player)
            strategy = self.get_team_strategy()
            cap = self.cba.salary_cap or 140_588_000

            should_extend = False
            offer_salary = 0

            if value >= 80:
                should_extend = True
                offer_salary = int(cap * 0.25)
            elif value >= 70 and strategy != STRATEGY_REBUILDING:
                should_extend = True
                offer_salary = int(cap * 0.12)
            elif value >= 60 and player.bio.age <= 26:
                should_extend = True
                offer_salary = int(cap * 0.06)

            decisions.append({
                "player_id": contract.player_id,
                "contract_id": contract.id,
                "should_extend": should_extend,
                "offer_annual_salary": offer_salary,
                "offer_years": 4 if value >= 80 else 3 if value >= 70 else 2,
                "player_value": value,
            })

        return decisions


# Roster size constant used internally
MAX_ROSTER = 15
