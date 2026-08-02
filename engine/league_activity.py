from __future__ import annotations

import random
import uuid
from .models.player import Player
from .models.team import Team, DraftPickAsset
from .models.contract import CBAConstants, TradePackage, TradeTeamPackage, ContractInfo
from .models.league import LeagueSettings, Transaction
from .ai.gm_ai import GMAI


# Trade rationale fragments by team strategy
_ACQ_RATIONALE = {
    "contending": [
        "contending team acquires veteran talent for playoff push",
        "contender bolsters roster for championship run",
        "contending team adds proven contributor",
    ],
    "playoff": [
        "playoff team upgrades roster to compete",
        "playoff team fills key need to solidify rotation",
        "playoff-bound team adds depth piece",
    ],
    "rebuilding": [
        "rebuilding team invests in young talent",
        "rebuilding team acquires developmental asset",
        "rebuilding franchise adds upside player",
    ],
    "retooling": [
        "retooling team reshapes roster around core",
        "retooling squad makes move for better fit",
        "retooling team adjusts timeline with key addition",
    ],
}

_SEND_RATIONALE = {
    "contending": "contender moves surplus depth for roster flexibility",
    "playoff": "team moves talent for future flexibility",
    "rebuilding": "rebuilding team stockpiles draft capital",
    "retooling": "retooling team clears cap space for future moves",
}

_MONTH_NAMES = {
    "01": "january", "02": "february", "03": "march",
    "04": "april", "05": "may", "06": "june",
    "07": "july", "08": "august", "09": "september",
    "10": "october", "11": "november", "12": "december",
}


class LeagueActivityEngine:
    """Drives all background league activity: CPU-CPU trades, roster moves,
    waivers, ten-day signings, two-way conversions, and trade-deadline drama."""

    MONTHLY_TRADE_RATES: dict[str, tuple[int, int]] = {
        "october": (1, 2),
        "november": (1, 2),
        "december": (2, 3),
        "january": (3, 5),
        "february_pre_deadline": (5, 10),
        "post_deadline": (0, 0),
    }

    # Deadline-day hour weights — 60 % of trades fall in hours 14-15
    DEADLINE_HOUR_WEIGHTS: dict[int, float] = {
        9: 0.05, 10: 0.06, 11: 0.08, 12: 0.10,
        13: 0.11, 14: 0.25, 15: 0.35,
    }

    def __init__(
        self,
        teams: list[Team],
        players: list[Player],
        settings: LeagueSettings,
        current_date: str,
        cba: CBAConstants | None = None,
        user_team_id: str | None = None,
    ):
        self.teams = teams
        self.players = players
        self.settings = settings
        self.current_date = current_date
        self.user_team_id = user_team_id

        if cba is None:
            from .cba.salary_cap import get_default_cba
            cba = get_default_cba()
        self.cba = cba

        self.player_map: dict[str, Player] = {p.id: p for p in players}
        self.team_map: dict[str, Team] = {t.id: t for t in teams}

    # ================================================================
    # Internal helpers
    # ================================================================

    def _team_players(self, team: Team) -> list[Player]:
        return [
            self.player_map[s.player_id]
            for s in team.roster
            if s.player_id in self.player_map
        ]

    def _free_agents(self) -> list[Player]:
        return [p for p in self.players if p.status.is_free_agent]

    def _cpu_teams(self) -> list[Team]:
        if self.user_team_id:
            return [t for t in self.teams if t.id != self.user_team_id]
        return list(self.teams)

    def _gmai(self, team: Team) -> GMAI:
        return GMAI(team, self._team_players(team), self.cba, self.settings)

    @staticmethod
    def _name(player: Player) -> str:
        return f"{player.bio.first_name} {player.bio.last_name}"

    @staticmethod
    def _uid() -> str:
        return str(uuid.uuid4())[:12]

    def _parse_month(self, date_str: str) -> str:
        try:
            return _MONTH_NAMES.get(date_str.split("-")[1], "january")
        except (IndexError, AttributeError):
            return "january"

    @staticmethod
    def _month_key(month: str, days_until_deadline: int | None = None) -> str:
        m = month.lower()
        if m == "february":
            if days_until_deadline is not None and days_until_deadline > 0:
                return "february_pre_deadline"
            return "post_deadline"
        if m in ("march", "april", "may", "june"):
            return "post_deadline"
        return m if m in ("october", "november", "december", "january") else "post_deadline"

    def _rationale(self, acq_gm: GMAI, send_gm: GMAI, target: Player) -> str:
        acq_strat = acq_gm.get_team_strategy()
        send_strat = send_gm.get_team_strategy()
        acq_part = random.choice(_ACQ_RATIONALE.get(acq_strat, _ACQ_RATIONALE["retooling"]))
        send_part = _SEND_RATIONALE.get(send_strat, _SEND_RATIONALE["retooling"])
        return f"{acq_part}; {send_part}"

    def _pick_label(self, pick) -> str:
        if isinstance(pick, DraftPickAsset):
            rnd = "1st" if pick.round == 1 else "2nd"
            return f"{pick.year} {rnd}"
        if isinstance(pick, dict):
            rnd = "1st" if pick.get("round", 1) == 1 else "2nd"
            return f"{pick.get('year', 'future')} {rnd}"
        return "future pick"

    def _pick_dict(self, pick) -> dict:
        if isinstance(pick, DraftPickAsset):
            return {"year": pick.year, "round": pick.round,
                    "original_team_id": pick.original_team_id}
        if isinstance(pick, dict):
            return pick
        return {}

    # ================================================================
    # CPU-CPU Trades
    # ================================================================

    def generate_trades(
        self,
        month: str,
        days_until_deadline: int | None = None,
    ) -> list[dict]:
        """Generate CPU-CPU trades for a month / period.

        Returns a list of completed trade dicts, each with *type*, *date*,
        *teams*, *players*, *details*, *headline*, and *rationale*.
        """
        if not self.settings.background_trades_enabled:
            return []

        key = self._month_key(month, days_until_deadline)
        lo, hi = self.MONTHLY_TRADE_RATES.get(key, (0, 0))
        if hi == 0:
            return []

        # Adjust for settings
        freq = self.settings.trade_frequency
        if freq == "low":
            lo, hi = max(0, lo - 1), max(1, hi - 1)
        elif freq == "high":
            lo, hi = lo + 1, hi + 2

        target_count = random.randint(lo, hi)
        completed: list[dict] = []
        traded_team_ids: set[str] = set()
        cpu = self._cpu_teams()
        max_attempts = target_count * 8

        for _ in range(max_attempts):
            if len(completed) >= target_count or len(cpu) < 2:
                break

            initiator = random.choice(cpu)
            if initiator.id in traded_team_ids:
                continue

            gm = self._gmai(initiator)
            proposal = gm.propose_trade(self.teams, self.players)
            if proposal is None:
                continue

            # Identify the other team
            other_id = next(
                (tp.team_id for tp in proposal.teams if tp.team_id != initiator.id),
                None,
            )
            if other_id is None or other_id in traded_team_ids:
                continue
            other_team = self.team_map.get(other_id)
            if other_team is None:
                continue

            other_gm = self._gmai(other_team)
            if not other_gm.should_accept_trade(proposal, self.players):
                continue

            # Unpack packages
            init_pkg = other_pkg = None
            for tp in proposal.teams:
                if tp.team_id == initiator.id:
                    init_pkg = tp
                else:
                    other_pkg = tp
            if init_pkg is None or other_pkg is None:
                continue

            target_player = self.player_map.get(
                init_pkg.players_in[0]) if init_pkg.players_in else None
            rationale = self._rationale(gm, other_gm, target_player) if target_player else ""
            headline = self._trade_headline(initiator, other_team, init_pkg, other_pkg)

            completed.append({
                "type": "trade",
                "date": self.current_date,
                "trade_id": proposal.id,
                "teams": [
                    {"team_id": initiator.id,
                     "team_name": f"{initiator.info.city} {initiator.info.name}",
                     "players_out": init_pkg.players_out,
                     "players_in": init_pkg.players_in,
                     "picks_out": [self._pick_dict(p) for p in init_pkg.picks_out],
                     "picks_in": [self._pick_dict(p) for p in init_pkg.picks_in]},
                    {"team_id": other_team.id,
                     "team_name": f"{other_team.info.city} {other_team.info.name}",
                     "players_out": other_pkg.players_out,
                     "players_in": other_pkg.players_in,
                     "picks_out": [self._pick_dict(p) for p in other_pkg.picks_out],
                     "picks_in": [self._pick_dict(p) for p in other_pkg.picks_in]},
                ],
                "players": init_pkg.players_out + init_pkg.players_in,
                "rationale": rationale,
                "details": f"Trade between {initiator.info.city} and {other_team.info.city}",
                "headline": headline,
            })
            traded_team_ids.update([initiator.id, other_id])

        return completed

    def _trade_headline(
        self, team_a: Team, team_b: Team,
        pkg_a: TradeTeamPackage, pkg_b: TradeTeamPackage,
    ) -> str:
        sent = [self._name(self.player_map[pid])
                for pid in pkg_a.players_out if pid in self.player_map]
        received = [self._name(self.player_map[pid])
                    for pid in pkg_a.players_in if pid in self.player_map]

        sent_picks = [self._pick_label(p) for p in pkg_a.picks_out]
        recv_picks = [self._pick_label(p) for p in pkg_a.picks_in]

        sent_str = ", ".join(sent + sent_picks) or "future considerations"
        recv_str = ", ".join(received + recv_picks) or "future considerations"
        return f"TRADE: {team_a.info.city} sends {sent_str} to {team_b.info.city} for {recv_str}"

    # ================================================================
    # Roster Moves
    # ================================================================

    def process_waivings(self) -> list[dict]:
        """CPU teams waive underperforming players. ~2-4 per month."""
        candidates: list[dict] = []
        for team in self._cpu_teams():
            gm = self._gmai(team)
            for player in self._team_players(team):
                if gm.should_waive_player(player):
                    name = self._name(player)
                    candidates.append({
                        "type": "waived",
                        "date": self.current_date,
                        "teams": [team.id],
                        "players": [player.id],
                        "details": f"{team.info.city} {team.info.name} waives {name}",
                        "headline": f"WAIVED: {team.info.city} releases {name}",
                    })
        random.shuffle(candidates)
        cap = random.randint(2, 4) if len(candidates) >= 2 else len(candidates)
        return candidates[:cap]

    def process_ten_day_contracts(self) -> list[dict]:
        """Teams below 15 players sign from free-agent pool."""
        signings: list[dict] = []
        pool = self._free_agents()
        if not pool:
            return []

        for team in self._cpu_teams():
            if len(team.roster) >= 15 or not pool:
                continue
            gm = self._gmai(team)
            for fa in pool:
                ev = gm.evaluate_free_agent(fa)
                if ev["interest"] != "low":
                    name = self._name(fa)
                    signings.append({
                        "type": "ten_day_signing",
                        "date": self.current_date,
                        "teams": [team.id],
                        "players": [fa.id],
                        "details": f"{team.info.city} {team.info.name} signs {name} to a 10-day contract",
                        "headline": f"SIGNED: {team.info.city} signs {name} to 10-day contract",
                    })
                    pool = [a for a in pool if a.id != fa.id]
                    break
        return signings

    def process_two_way_conversions(self) -> list[dict]:
        """Promising young two-way players get converted to standard deals."""
        conversions: list[dict] = []
        for team in self._cpu_teams():
            for player in self._team_players(team):
                contract = player.contract
                if not (isinstance(contract, ContractInfo)
                        and contract.contract_type == "two_way"):
                    continue
                if (player.bio.age <= 25
                        and player.ratings.overall >= 65
                        and player.ratings.potential > player.ratings.overall):
                    name = self._name(player)
                    conversions.append({
                        "type": "two_way_conversion",
                        "date": self.current_date,
                        "teams": [team.id],
                        "players": [player.id],
                        "details": (
                            f"{team.info.city} {team.info.name} converts "
                            f"{name}'s two-way contract to a standard deal"
                        ),
                        "headline": f"CONVERTED: {team.info.city} converts {name} to standard contract",
                    })
        return conversions

    def process_injury_moves(self, injuries: list[dict]) -> list[dict]:
        """IR designations and emergency signings for injured starters."""
        moves: list[dict] = []
        pool = self._free_agents()

        for inj in injuries:
            player = self.player_map.get(inj.get("player_id", ""))
            if player is None:
                continue
            team_id = player.status.team_id
            team = self.team_map.get(team_id) if team_id else None
            if team is None:
                continue

            severity = inj.get("severity", "minor")
            games_out = inj.get("games_remaining", 0)
            if severity not in ("severe", "season_ending") and games_out < 15:
                continue

            name = self._name(player)
            inj_type = inj.get("injury_type", "injury")
            moves.append({
                "type": "injury_designation",
                "date": self.current_date,
                "teams": [team_id],
                "players": [player.id],
                "details": f"{name} placed on injured reserve ({inj_type})",
                "headline": f"INJURY: {team.info.city} places {name} on injured reserve",
            })

            # Emergency replacement at same position
            pos = player.bio.position
            replacement = next((fa for fa in pool if fa.bio.position == pos), None)
            if replacement is not None:
                rname = self._name(replacement)
                moves.append({
                    "type": "emergency_signing",
                    "date": self.current_date,
                    "teams": [team_id],
                    "players": [replacement.id],
                    "details": (
                        f"{team.info.city} {team.info.name} signs {rname} "
                        f"as injury replacement for {name}"
                    ),
                    "headline": f"SIGNED: {team.info.city} signs {rname} as injury replacement",
                })
                pool = [a for a in pool if a.id != replacement.id]

        return moves

    def process_buyout_market(self, days_since_deadline: int) -> list[dict]:
        """Post-deadline buyouts — 3-5 veterans seek contending teams."""
        if days_since_deadline < 0:
            return []

        buyouts: list[dict] = []
        limit = random.randint(3, 5)

        for team in self._cpu_teams():
            if len(buyouts) >= limit:
                break
            gm = self._gmai(team)
            if gm.get_team_strategy() not in ("rebuilding", "retooling"):
                continue

            for player in self._team_players(team):
                if len(buyouts) >= limit:
                    break
                if not (28 <= player.bio.age and 68 <= player.ratings.overall <= 78):
                    continue

                name = self._name(player)
                # Find a contending destination
                dest = None
                for contender in self.teams:
                    if contender.id == team.id:
                        continue
                    c_gm = self._gmai(contender)
                    if c_gm.get_team_strategy() in ("contending", "playoff"):
                        if c_gm.buyout_market_strategy([player]):
                            dest = contender
                            break

                buyouts.append({
                    "type": "buyout",
                    "date": self.current_date,
                    "teams": [team.id] + ([dest.id] if dest else []),
                    "players": [player.id],
                    "details": (
                        f"{team.info.city} {team.info.name} buys out {name}"
                        + (f"; signs with {dest.info.city}" if dest else "")
                    ),
                    "headline": (
                        f"BUYOUT: {team.info.city} buys out {name}"
                        + (f", signs with {dest.info.city}" if dest else "")
                    ),
                })
        return buyouts

    # ================================================================
    # Transaction Feed
    # ================================================================

    def generate_daily_activity(
        self,
        current_date: str,
        season_phase: str,
    ) -> list[dict]:
        """Orchestrate all background activity for a single sim day."""
        self.current_date = current_date
        txns: list[dict] = []

        if season_phase == "regular_season":
            month = self._parse_month(current_date)
            key = self._month_key(month)
            lo, hi = self.MONTHLY_TRADE_RATES.get(key, (0, 0))
            daily_prob = ((lo + hi) / 2) / 30.0
            if random.random() < daily_prob:
                trades = self.generate_trades(month)
                txns.extend(trades[:random.randint(1, 2)])

            if random.random() < 0.08:
                txns.extend(self.process_waivings()[:1])
            if random.random() < 0.05:
                txns.extend(self.process_ten_day_contracts()[:1])
            if random.random() < 0.02:
                txns.extend(self.process_two_way_conversions()[:1])

        elif season_phase == "post_deadline":
            if random.random() < 0.10:
                txns.extend(self.process_buyout_market(days_since_deadline=1)[:1])

        return txns

    # ================================================================
    # Trade Deadline Day (hourly mode)
    # ================================================================

    def simulate_deadline_hour(self, hour: int) -> list[dict]:
        """Simulate one hour of trade-deadline day (hours 9-15).

        60 % of trades cluster in the final 2 hours.
        After hour 15 the deadline has passed.
        """
        if hour > 15:
            return [{
                "type": "deadline_passed",
                "date": self.current_date,
                "teams": [],
                "players": [],
                "details": "The trade deadline has officially passed",
                "headline": "TRADE DEADLINE HAS PASSED",
            }]

        if hour < 9:
            return []

        weight = self.DEADLINE_HOUR_WEIGHTS.get(hour, 0.05)
        results: list[dict] = []
        chances = 3 if hour >= 14 else (2 if hour >= 12 else 1)

        for _ in range(chances):
            if random.random() < weight:
                trades = self.generate_trades("february", days_until_deadline=0)
                if trades:
                    trade = trades[0]
                    trade["headline"] = "BREAKING: " + trade.get("headline", "")
                    results.append(trade)

        return results

    def get_trade_probability_for_hour(self, hour: int) -> float:
        """Return the base probability of a trade firing in a given
        deadline-day hour."""
        return self.DEADLINE_HOUR_WEIGHTS.get(hour, 0.0)

    # ================================================================
    # Transaction record helper
    # ================================================================

    def create_transaction(
        self,
        transaction_type: str,
        details: dict,
        date: str,
        season_year: int,
    ) -> Transaction:
        return Transaction(
            id=self._uid(),
            date=date,
            transaction_type=transaction_type,
            details=details,
            description=details.get("headline", ""),
            season_year=season_year,
        )

    def get_month_from_date(self, date: str) -> str:
        return self._parse_month(date)
