from __future__ import annotations

import random
import math


class AwardsVoter:
    """Simulates an individual awards voter with personal biases."""

    def __init__(self, voter_id: int):
        self.voter_id = voter_id
        self.big_market_bias: float = random.uniform(0.0, 0.1)
        self.stats_weight: float = random.uniform(0.3, 0.5)
        self.team_success_weight: float = random.uniform(0.2, 0.4)
        self.narrative_weight: float = random.uniform(0.1, 0.3)
        self.eye_test_weight: float = random.uniform(0.1, 0.2)

    def rank_candidates(self, candidates: list[dict], award_type: str) -> list[dict]:
        """Return a ranked ballot with scores for each candidate."""
        scored = []
        for c in candidates:
            score = self._score_candidate(c, award_type)
            scored.append({"player_id": c["player_id"], "score": score})
        scored.sort(key=lambda x: x["score"], reverse=True)
        return scored

    def _score_candidate(self, candidate: dict, award_type: str) -> float:
        """Score a single candidate using this voter's biases."""
        total_w = (
            self.stats_weight
            + self.team_success_weight
            + self.narrative_weight
            + self.eye_test_weight
        )

        stats_score = candidate.get("stats_score", 0.0)
        team_score = candidate.get("team_success_score", 0.0)
        narrative_score = candidate.get("narrative_score", 0.0)
        eye_test_score = candidate.get("eye_test_score", 0.0)
        market_size = candidate.get("market_size", 15)
        market_bonus = (market_size / 30.0) * self.big_market_bias

        # Award-specific overrides
        if award_type == "dpoy":
            stats_score = candidate.get("defensive_stats_score", stats_score)
        elif award_type == "sixth_man":
            stats_score = candidate.get("bench_stats_score", stats_score)

        base = (
            stats_score * (self.stats_weight / total_w)
            + team_score * (self.team_success_weight / total_w)
            + narrative_score * (self.narrative_weight / total_w)
            + eye_test_score * (self.eye_test_weight / total_w)
        )

        noise = random.gauss(0, 0.02)
        return base + market_bonus + noise


class AwardsEngine:
    """Computes end-of-season awards using a 100-voter panel system."""

    def __init__(
        self,
        players: list[dict],
        teams: list[dict],
        season_stats: list[dict],
    ):
        self.players = players
        self.teams = teams
        self.season_stats = season_stats
        self.num_voters = 100
        self.voters = [AwardsVoter(i) for i in range(self.num_voters)]

        self._player_map: dict[str, dict] = {p["id"]: p for p in players}
        self._team_map: dict[str, dict] = {t["id"]: t for t in teams}
        self._stats_map: dict[str, dict] = {
            s["player_id"]: s for s in season_stats
        }

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _team_for_player(self, player_id: str) -> dict | None:
        stats = self._stats_map.get(player_id, {})
        return self._team_map.get(stats.get("team_id", ""))

    def _win_pct(self, team: dict | None) -> float:
        if team is None:
            return 0.5
        rec = team.get("season_record", {})
        w, l = rec.get("wins", 0), rec.get("losses", 0)
        return w / (w + l) if (w + l) > 0 else 0.5

    def _market(self, team: dict | None) -> int:
        if team is None:
            return 15
        return team.get("info", {}).get("market_size", 15)

    @staticmethod
    def _clamp(value: float) -> float:
        return max(0.0, min(1.0, value))

    def _run_vote(
        self,
        candidates: list[dict],
        award_type: str,
        top_n: int = 5,
        points_system: list[int] | None = None,
    ) -> dict:
        """Run balloting across all voters. Points default 10-7-5-3-1."""
        if not candidates:
            return {"winner": "", "vote_totals": {}, "first_place_votes": {}, "ballots": []}

        if points_system is None:
            points_system = [10, 7, 5, 3, 1]

        vote_totals: dict[str, float] = {}
        first_place_votes: dict[str, int] = {}
        ballots: list[dict] = []

        for voter in self.voters:
            ballot = voter.rank_candidates(candidates, award_type)
            picks = ballot[:top_n]
            record: dict = {"voter_id": voter.voter_id, "picks": []}

            for rank, pick in enumerate(picks):
                pid = pick["player_id"]
                pts = points_system[rank] if rank < len(points_system) else 0
                vote_totals[pid] = vote_totals.get(pid, 0) + pts
                if rank == 0:
                    first_place_votes[pid] = first_place_votes.get(pid, 0) + 1
                record["picks"].append(
                    {"player_id": pid, "rank": rank + 1, "points": pts}
                )

            ballots.append(record)

        sorted_results = sorted(
            vote_totals.items(),
            key=lambda x: (x[1], first_place_votes.get(x[0], 0)),
            reverse=True,
        )
        winner = sorted_results[0][0] if sorted_results else ""

        return {
            "winner": winner,
            "vote_totals": dict(sorted_results),
            "first_place_votes": first_place_votes,
            "max_possible_points": self.num_voters * points_system[0],
            "ballots": ballots,
        }

    # ------------------------------------------------------------------
    # MVP
    # ------------------------------------------------------------------

    def compute_mvp(self) -> dict:
        """MVP: 100 voters each rank top 5. Points 10-7-5-3-1."""
        candidates: list[dict] = []

        for s in self.season_stats:
            pid = s["player_id"]
            player = self._player_map.get(pid)
            if player is None or s.get("games_played", 0) < 50:
                continue

            team = self._team_for_player(pid)
            wp = self._win_pct(team)

            ppg = s.get("points_per_game", 0.0)
            rpg = s.get("rebounds_per_game", 0.0)
            apg = s.get("assists_per_game", 0.0)
            spg = s.get("steals_per_game", 0.0)
            bpg = s.get("blocks_per_game", 0.0)
            per = s.get("player_efficiency_rating", 0.0)
            ws = s.get("win_shares", 0.0)
            overall = player.get("ratings", {}).get("overall", 70)

            stats_score = self._clamp(
                ppg / 35.0 * 0.30
                + rpg / 15.0 * 0.10
                + apg / 12.0 * 0.15
                + spg / 3.0 * 0.05
                + bpg / 3.5 * 0.05
                + per / 35.0 * 0.20
                + ws / 15.0 * 0.15
            )

            candidates.append({
                "player_id": pid,
                "stats_score": stats_score,
                "team_success_score": self._clamp(wp * 1.2),
                "narrative_score": self._clamp(overall / 99.0),
                "eye_test_score": self._clamp(
                    overall / 99.0 * 0.6 + per / 35.0 * 0.4
                ),
                "market_size": self._market(team),
            })

        return self._run_vote(candidates, "mvp")

    # ------------------------------------------------------------------
    # DPOY
    # ------------------------------------------------------------------

    def compute_dpoy(self) -> dict:
        """Defensive Player of the Year: weight defensive stats."""
        candidates: list[dict] = []

        for s in self.season_stats:
            pid = s["player_id"]
            player = self._player_map.get(pid)
            if player is None or s.get("games_played", 0) < 50:
                continue

            team = self._team_for_player(pid)
            wp = self._win_pct(team)

            spg = s.get("steals_per_game", 0.0)
            bpg = s.get("blocks_per_game", 0.0)
            drtg = s.get("defensive_rating", 110.0)

            r = player.get("ratings", {})
            pdef = r.get("perimeter_defense", 50)
            idef = r.get("interior_defense", 50)
            diq = r.get("defensive_iq", 50)
            dcon = r.get("defensive_consistency", 50)

            def_score = self._clamp(
                spg / 3.0 * 0.15
                + bpg / 3.5 * 0.15
                + max(0.0, (115.0 - drtg) / 20.0) * 0.20
                + pdef / 99.0 * 0.12
                + idef / 99.0 * 0.12
                + diq / 99.0 * 0.13
                + dcon / 99.0 * 0.13
            )

            candidates.append({
                "player_id": pid,
                "stats_score": def_score,
                "defensive_stats_score": def_score,
                "team_success_score": self._clamp(wp * 1.1),
                "narrative_score": self._clamp(
                    r.get("overall", 70) / 99.0 * 0.4 + def_score * 0.6
                ),
                "eye_test_score": self._clamp(
                    (pdef + idef + diq) / 297.0
                ),
                "market_size": self._market(team),
            })

        return self._run_vote(candidates, "dpoy")

    # ------------------------------------------------------------------
    # ROY
    # ------------------------------------------------------------------

    def compute_roy(self) -> dict:
        """Rookie of the Year: first-year players only."""
        candidates: list[dict] = []

        for s in self.season_stats:
            pid = s["player_id"]
            player = self._player_map.get(pid)
            if player is None:
                continue

            bio = player.get("bio", {})
            status = player.get("status", {})
            is_rookie = (
                status.get("is_rookie", False)
                or bio.get("years_in_league", 99) <= 1
            )
            if not is_rookie or s.get("games_played", 0) < 30:
                continue

            team = self._team_for_player(pid)
            ppg = s.get("points_per_game", 0.0)
            rpg = s.get("rebounds_per_game", 0.0)
            apg = s.get("assists_per_game", 0.0)
            per = s.get("player_efficiency_rating", 0.0)

            stats_score = self._clamp(
                ppg / 25.0 * 0.35
                + rpg / 10.0 * 0.15
                + apg / 8.0 * 0.20
                + per / 25.0 * 0.30
            )

            candidates.append({
                "player_id": pid,
                "stats_score": stats_score,
                "team_success_score": self._clamp(self._win_pct(team)),
                "narrative_score": self._clamp(stats_score * 1.1),
                "eye_test_score": stats_score,
                "market_size": self._market(team),
            })

        return self._run_vote(candidates, "roy")

    # ------------------------------------------------------------------
    # Sixth Man
    # ------------------------------------------------------------------

    def compute_sixth_man(self) -> dict:
        """Sixth Man: must start < 50% of games."""
        candidates: list[dict] = []

        for s in self.season_stats:
            pid = s["player_id"]
            player = self._player_map.get(pid)
            if player is None:
                continue

            gp = s.get("games_played", 0)
            gs = s.get("games_started", 0)
            if gp < 40 or (gp > 0 and gs / gp >= 0.50):
                continue

            team = self._team_for_player(pid)
            ppg = s.get("points_per_game", 0.0)
            rpg = s.get("rebounds_per_game", 0.0)
            apg = s.get("assists_per_game", 0.0)
            per = s.get("player_efficiency_rating", 0.0)

            bench_score = self._clamp(
                ppg / 22.0 * 0.35
                + rpg / 8.0 * 0.15
                + apg / 6.0 * 0.20
                + per / 22.0 * 0.30
            )

            candidates.append({
                "player_id": pid,
                "stats_score": bench_score,
                "bench_stats_score": bench_score,
                "team_success_score": self._clamp(self._win_pct(team)),
                "narrative_score": bench_score * 0.9,
                "eye_test_score": bench_score,
                "market_size": self._market(team),
            })

        return self._run_vote(candidates, "sixth_man")

    # ------------------------------------------------------------------
    # MIP
    # ------------------------------------------------------------------

    def compute_mip(self) -> dict:
        """Most Improved: biggest jump in overall rating + stats vs prior season."""
        candidates: list[dict] = []

        for s in self.season_stats:
            pid = s["player_id"]
            player = self._player_map.get(pid)
            if player is None or s.get("games_played", 0) < 50:
                continue

            prev = s.get("previous_season", {})
            if not prev:
                continue

            cur_ppg = s.get("points_per_game", 0.0)
            cur_per = s.get("player_efficiency_rating", 0.0)
            cur_overall = player.get("ratings", {}).get("overall", 70)

            prev_ppg = prev.get("points_per_game", 0.0)
            prev_per = prev.get("player_efficiency_rating", 0.0)
            prev_overall = prev.get("overall", 0)

            ppg_jump = cur_ppg - prev_ppg
            per_jump = cur_per - prev_per
            ovr_jump = cur_overall - prev_overall

            if ppg_jump < 2.0 and ovr_jump < 3:
                continue

            team = self._team_for_player(pid)
            imp = self._clamp(
                min(1.0, ppg_jump / 12.0) * 0.35
                + min(1.0, per_jump / 10.0) * 0.30
                + min(1.0, ovr_jump / 15.0) * 0.35
            )

            candidates.append({
                "player_id": pid,
                "stats_score": imp,
                "team_success_score": self._clamp(self._win_pct(team)),
                "narrative_score": imp,
                "eye_test_score": self._clamp(cur_overall / 99.0),
                "market_size": self._market(team),
            })

        return self._run_vote(candidates, "mip")

    # ------------------------------------------------------------------
    # Clutch Player of the Year
    # ------------------------------------------------------------------

    def compute_clutch_poy(self) -> dict:
        """Clutch POY: 4th quarter / close game performance."""
        candidates: list[dict] = []

        for s in self.season_stats:
            pid = s["player_id"]
            player = self._player_map.get(pid)
            if player is None or s.get("games_played", 0) < 50:
                continue

            team = self._team_for_player(pid)
            ppg = s.get("points_per_game", 0.0)
            overall = player.get("ratings", {}).get("overall", 70)
            clutch_trait = player.get("character", {}).get("clutch", 50)

            clutch_ppg = s.get("clutch_points_per_game", ppg * 0.25)
            clutch_fg = s.get("clutch_fg_pct", 0.45)
            gw_shots = s.get("game_winning_shots", 0)

            score = self._clamp(
                clutch_trait / 99.0 * 0.25
                + min(1.0, clutch_ppg / 8.0) * 0.25
                + clutch_fg * 0.20
                + min(1.0, gw_shots / 5.0) * 0.15
                + overall / 99.0 * 0.15
            )

            candidates.append({
                "player_id": pid,
                "stats_score": score,
                "team_success_score": self._clamp(self._win_pct(team)),
                "narrative_score": self._clamp(score * 1.1),
                "eye_test_score": score,
                "market_size": self._market(team),
            })

        return self._run_vote(candidates, "clutch_poy")

    # ------------------------------------------------------------------
    # Coach of the Year
    # ------------------------------------------------------------------

    def compute_coty(self, preseason_projections: dict) -> dict:
        """COTY: team over-performance vs projection."""
        candidates: list[dict] = []

        for t in self.teams:
            tid = t["id"]
            rec = t.get("season_record", {})
            w, l = rec.get("wins", 0), rec.get("losses", 0)
            if w + l == 0:
                continue

            projected = preseason_projections.get(tid, {}).get("projected_wins", 41)
            overperf = w - projected
            wp = w / (w + l)

            coaching = t.get("coaching", {})
            coach_name = "Unknown"
            if isinstance(coaching, dict):
                hc = coaching.get("head_coach", {})
                if isinstance(hc, dict):
                    coach_name = hc.get("name", "Unknown")

            over_score = self._clamp(overperf / 20.0 + 0.3)
            win_score = self._clamp(wp * 1.1)
            combined = over_score * 0.55 + win_score * 0.45

            candidates.append({
                "player_id": tid,
                "coach_name": coach_name,
                "team_id": tid,
                "stats_score": combined,
                "team_success_score": win_score,
                "narrative_score": over_score,
                "eye_test_score": combined,
                "market_size": self._market(t),
                "wins": w,
                "projected_wins": projected,
                "overperformance": overperf,
            })

        return self._run_vote(candidates, "coty")

    # ------------------------------------------------------------------
    # Executive of the Year
    # ------------------------------------------------------------------

    def compute_eoty(
        self, transactions: list[dict], preseason_projections: dict
    ) -> dict:
        """EOTY: GM quality — trades, drafting, cap management."""
        team_txns: dict[str, list[dict]] = {}
        for tx in transactions:
            tid = tx.get("team_id", "")
            if tid:
                team_txns.setdefault(tid, []).append(tx)

        candidates: list[dict] = []

        for t in self.teams:
            tid = t["id"]
            rec = t.get("season_record", {})
            w, l = rec.get("wins", 0), rec.get("losses", 0)
            if w + l == 0:
                continue

            projected = preseason_projections.get(tid, {}).get("projected_wins", 41)
            overperf = w - projected
            wp = w / (w + l)

            txns = team_txns.get(tid, [])
            trades = sum(1 for tx in txns if tx.get("transaction_type") == "trade")
            drafts = sum(1 for tx in txns if tx.get("transaction_type") == "draft")
            signs = sum(1 for tx in txns if tx.get("transaction_type") == "signing")

            fin = t.get("finances", {})
            cap_score = 0.3 if (isinstance(fin, dict) and fin.get("is_in_luxury_tax", False)) else 0.7

            activity = self._clamp(trades * 0.15 + drafts * 0.10 + signs * 0.10)
            over_score = self._clamp(overperf / 20.0 + 0.3)
            win_score = self._clamp(wp * 1.1)

            combined = (
                over_score * 0.35
                + win_score * 0.25
                + activity * 0.20
                + cap_score * 0.20
            )

            candidates.append({
                "player_id": tid,
                "team_id": tid,
                "stats_score": combined,
                "team_success_score": win_score,
                "narrative_score": over_score,
                "eye_test_score": combined,
                "market_size": self._market(t),
                "wins": w,
                "overperformance": overperf,
            })

        return self._run_vote(candidates, "eoty")

    # ------------------------------------------------------------------
    # All-NBA
    # ------------------------------------------------------------------

    def compute_all_nba(self) -> dict:
        """All-NBA: 3 teams (2G, 2F, 1C each) selected by voter panel."""
        buckets: dict[str, list[dict]] = {"G": [], "F": [], "C": []}

        for s in self.season_stats:
            pid = s["player_id"]
            player = self._player_map.get(pid)
            if player is None or s.get("games_played", 0) < 50:
                continue

            pos = player.get("bio", {}).get("position", "F")
            team = self._team_for_player(pid)
            wp = self._win_pct(team)

            ppg = s.get("points_per_game", 0.0)
            rpg = s.get("rebounds_per_game", 0.0)
            apg = s.get("assists_per_game", 0.0)
            per = s.get("player_efficiency_rating", 0.0)
            ws = s.get("win_shares", 0.0)
            overall = player.get("ratings", {}).get("overall", 70)

            score = self._clamp(
                ppg / 35.0 * 0.25
                + rpg / 15.0 * 0.10
                + apg / 12.0 * 0.15
                + per / 35.0 * 0.20
                + ws / 15.0 * 0.10
                + overall / 99.0 * 0.10
                + wp * 0.10
            )

            key = self._pos_bucket(pos)
            buckets[key].append({"player_id": pid, "score": score})

        for key in buckets:
            buckets[key].sort(key=lambda x: x["score"], reverse=True)

        g = [e["player_id"] for e in buckets["G"]]
        f = [e["player_id"] for e in buckets["F"]]
        c = [e["player_id"] for e in buckets["C"]]

        return {
            "first": g[:2] + f[:2] + c[:1],
            "second": g[2:4] + f[2:4] + c[1:2],
            "third": g[4:6] + f[4:6] + c[2:3],
        }

    # ------------------------------------------------------------------
    # All-Defensive
    # ------------------------------------------------------------------

    def compute_all_defensive(self) -> dict:
        """All-Defensive: 2 teams, defensive stats weighted."""
        pool: list[dict] = []

        for s in self.season_stats:
            pid = s["player_id"]
            player = self._player_map.get(pid)
            if player is None or s.get("games_played", 0) < 50:
                continue

            r = player.get("ratings", {})
            spg = s.get("steals_per_game", 0.0)
            bpg = s.get("blocks_per_game", 0.0)
            drtg = s.get("defensive_rating", 110.0)

            score = self._clamp(
                spg / 3.0 * 0.15
                + bpg / 3.5 * 0.15
                + max(0.0, (115.0 - drtg) / 20.0) * 0.20
                + r.get("perimeter_defense", 50) / 99.0 * 0.15
                + r.get("interior_defense", 50) / 99.0 * 0.15
                + r.get("defensive_iq", 50) / 99.0 * 0.10
                + r.get("defensive_consistency", 50) / 99.0 * 0.10
            )

            pos = player.get("bio", {}).get("position", "F")
            pool.append({"player_id": pid, "score": score, "pos": self._pos_bucket(pos)})

        pool.sort(key=lambda x: x["score"], reverse=True)

        first = self._pick_positional_team(pool, set())
        used = set(first)
        second = self._pick_positional_team(pool, used)

        return {"first": first, "second": second}

    # ------------------------------------------------------------------
    # All-Rookie
    # ------------------------------------------------------------------

    def compute_all_rookie(self) -> dict:
        """All-Rookie: 2 teams, 5 per team, positionless."""
        rookies: list[dict] = []

        for s in self.season_stats:
            pid = s["player_id"]
            player = self._player_map.get(pid)
            if player is None:
                continue

            bio = player.get("bio", {})
            status = player.get("status", {})
            is_rk = status.get("is_rookie", False) or bio.get("years_in_league", 99) <= 1
            if not is_rk or s.get("games_played", 0) < 20:
                continue

            ppg = s.get("points_per_game", 0.0)
            rpg = s.get("rebounds_per_game", 0.0)
            apg = s.get("assists_per_game", 0.0)
            per = s.get("player_efficiency_rating", 0.0)

            score = self._clamp(
                ppg / 25.0 * 0.35
                + rpg / 10.0 * 0.15
                + apg / 8.0 * 0.20
                + per / 25.0 * 0.30
            )
            rookies.append({"player_id": pid, "score": score})

        rookies.sort(key=lambda x: x["score"], reverse=True)
        return {
            "first": [r["player_id"] for r in rookies[:5]],
            "second": [r["player_id"] for r in rookies[5:10]],
        }

    # ------------------------------------------------------------------
    # Finals MVP
    # ------------------------------------------------------------------

    def compute_finals_mvp(self, finals_stats: list[dict]) -> dict:
        """Finals MVP: best performer in the Finals series."""
        candidates: list[dict] = []
        for s in finals_stats:
            pid = s.get("player_id", "")
            ppg = s.get("points_per_game", 0.0)
            rpg = s.get("rebounds_per_game", 0.0)
            apg = s.get("assists_per_game", 0.0)
            per = s.get("player_efficiency_rating", 0.0)
            winning = s.get("on_winning_team", False)

            score = self._clamp(
                ppg / 35.0 * 0.35
                + rpg / 15.0 * 0.10
                + apg / 12.0 * 0.15
                + per / 35.0 * 0.25
                + (0.15 if winning else 0.0)
            )

            candidates.append({
                "player_id": pid,
                "stats_score": score,
                "team_success_score": 1.0 if winning else 0.3,
                "narrative_score": score,
                "eye_test_score": score,
                "market_size": 15,
            })

        return self._run_vote(candidates, "finals_mvp")

    # ------------------------------------------------------------------
    # Run all
    # ------------------------------------------------------------------

    def run_all_awards(
        self,
        preseason_projections: dict | None = None,
        transactions: list[dict] | None = None,
        finals_stats: list[dict] | None = None,
    ) -> dict:
        """Compute every award and return a dict keyed by award name."""
        proj = preseason_projections or {}
        txns = transactions or []
        fstats = finals_stats or []

        results: dict = {
            "mvp": self.compute_mvp(),
            "dpoy": self.compute_dpoy(),
            "roy": self.compute_roy(),
            "sixth_man": self.compute_sixth_man(),
            "mip": self.compute_mip(),
            "clutch_poy": self.compute_clutch_poy(),
            "coty": self.compute_coty(proj),
            "eoty": self.compute_eoty(txns, proj),
            "all_nba": self.compute_all_nba(),
            "all_defensive": self.compute_all_defensive(),
            "all_rookie": self.compute_all_rookie(),
        }

        if fstats:
            results["finals_mvp"] = self.compute_finals_mvp(fstats)

        return results

    # ------------------------------------------------------------------
    # Internal utilities
    # ------------------------------------------------------------------

    @staticmethod
    def _pos_bucket(position: str) -> str:
        """Map a specific position to G / F / C."""
        if position in ("PG", "SG", "G"):
            return "G"
        if position in ("SF", "PF", "F"):
            return "F"
        if position == "C":
            return "C"
        return "F"

    @staticmethod
    def _pick_positional_team(
        pool: list[dict], exclude: set[str]
    ) -> list[str]:
        """Pick 2G + 2F + 1C from a pre-sorted pool, skipping excluded ids."""
        need = {"G": 2, "F": 2, "C": 1}
        selected: list[str] = []

        for entry in pool:
            pid = entry["player_id"]
            if pid in exclude:
                continue
            pos = entry["pos"]
            if need.get(pos, 0) > 0:
                selected.append(pid)
                need[pos] -= 1
            if len(selected) == 5:
                return selected

        # Fill remaining slots regardless of position
        for entry in pool:
            pid = entry["player_id"]
            if pid not in exclude and pid not in selected:
                selected.append(pid)
                if len(selected) == 5:
                    break

        return selected
