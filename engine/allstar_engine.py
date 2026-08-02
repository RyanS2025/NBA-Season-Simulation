from __future__ import annotations

import random
import math


class AllStarEngine:
    """Simulates NBA All-Star Weekend: voting, contests, and game."""

    def __init__(
        self,
        players: list[dict] | None = None,
        teams: list[dict] | None = None,
    ):
        self.players = players or []
        self.teams = teams or []
        self._player_map: dict[str, dict] = {
            p["id"]: p for p in self.players
        }
        self._team_map: dict[str, dict] = {
            t["id"]: t for t in self.teams
        }

    # ------------------------------------------------------------------
    # Starter selection  (fan 50% + media 25% + player 25%)
    # ------------------------------------------------------------------

    def select_starters(
        self, players: list[dict], teams: list[dict]
    ) -> dict:
        """Select 5 starters per conference via simulated voting.

        Fan vote (50%): fanFavorite trait + overall + market_size
        Media vote (25%): pure performance (overall rating)
        Player vote (25%): overall + respect (leadership)
        Returns ``{"east": [...], "west": [...]}``.
        """
        team_map = {t["id"]: t for t in teams}
        east: list[dict] = []
        west: list[dict] = []

        for p in players:
            status = p.get("status", {})
            if status.get("health", "healthy") != "healthy":
                continue

            tid = status.get("team_id", "")
            team = team_map.get(tid)
            if team is None:
                continue

            conf = team.get("info", {}).get("conference", "East")
            market = team.get("info", {}).get("market_size", 15)
            overall = p.get("ratings", {}).get("overall", 50)
            fan_fav = p.get("character", {}).get("fan_favorite", 50)
            leadership = p.get("character", {}).get("leadership", 50)

            fan_score = (
                fan_fav / 99.0 * 0.40
                + overall / 99.0 * 0.35
                + market / 30.0 * 0.25
            ) + random.gauss(0, 0.03)

            media_score = (
                overall / 99.0
            ) + random.gauss(0, 0.02)

            player_score = (
                overall / 99.0 * 0.60
                + leadership / 99.0 * 0.40
            ) + random.gauss(0, 0.02)

            combined = (
                fan_score * 0.50
                + media_score * 0.25
                + player_score * 0.25
            )

            entry = {
                "player_id": p["id"],
                "position": p.get("bio", {}).get("position", "F"),
                "combined_score": combined,
                "fan_score": fan_score,
                "media_score": media_score,
                "player_score": player_score,
            }

            if conf == "West":
                west.append(entry)
            else:
                east.append(entry)

        east_starters = self._pick_starters(east)
        west_starters = self._pick_starters(west)

        return {"east": east_starters, "west": west_starters}

    @staticmethod
    def _pick_starters(pool: list[dict]) -> list[str]:
        """Pick 2 backcourt + 3 frontcourt from a sorted pool."""
        pool.sort(key=lambda x: x["combined_score"], reverse=True)
        guards: list[str] = []
        forwards: list[str] = []

        for e in pool:
            pos = e["position"]
            pid = e["player_id"]
            if pos in ("PG", "SG", "G") and len(guards) < 2:
                guards.append(pid)
            elif len(forwards) < 3:
                forwards.append(pid)
            if len(guards) == 2 and len(forwards) == 3:
                break

        # Fill gaps if positions are thin
        used = set(guards + forwards)
        for e in pool:
            if len(guards) + len(forwards) >= 5:
                break
            if e["player_id"] not in used:
                if len(guards) < 2:
                    guards.append(e["player_id"])
                else:
                    forwards.append(e["player_id"])
                used.add(e["player_id"])

        return guards + forwards

    # ------------------------------------------------------------------
    # Reserve selection  (coaches, pure performance)
    # ------------------------------------------------------------------

    def select_reserves(
        self, players: list[dict], teams: list[dict]
    ) -> dict:
        """Select 7 reserves per conference by coaches (pure stats)."""
        team_map = {t["id"]: t for t in teams}
        east: list[dict] = []
        west: list[dict] = []

        for p in players:
            status = p.get("status", {})
            if status.get("health", "healthy") != "healthy":
                continue

            tid = status.get("team_id", "")
            team = team_map.get(tid)
            if team is None:
                continue

            conf = team.get("info", {}).get("conference", "East")
            overall = p.get("ratings", {}).get("overall", 50)
            score = overall / 99.0 + random.gauss(0, 0.01)

            entry = {"player_id": p["id"], "score": score}
            if conf == "West":
                west.append(entry)
            else:
                east.append(entry)

        east.sort(key=lambda x: x["score"], reverse=True)
        west.sort(key=lambda x: x["score"], reverse=True)

        return {
            "east": [e["player_id"] for e in east[:7]],
            "west": [e["player_id"] for e in west[:7]],
        }

    # ------------------------------------------------------------------
    # Injury replacement
    # ------------------------------------------------------------------

    def handle_injury_replacement(
        self,
        injured_id: str,
        conference: str,
        already_selected: list[str],
    ) -> dict:
        """Replace an injured All-Star with the next-best eligible player."""
        excluded = set(already_selected) | {injured_id}
        best_id = ""
        best_score = -1.0

        for p in self.players:
            pid = p["id"]
            if pid in excluded:
                continue

            status = p.get("status", {})
            if status.get("health", "healthy") != "healthy":
                continue

            tid = status.get("team_id", "")
            team = self._team_map.get(tid)
            if team is None:
                continue

            conf = team.get("info", {}).get("conference", "East")
            if conf.lower() != conference.lower():
                continue

            overall = p.get("ratings", {}).get("overall", 50)
            score = overall / 99.0 + random.gauss(0, 0.01)
            if score > best_score:
                best_score = score
                best_id = pid

        return {
            "replacement_id": best_id,
            "replaced_id": injured_id,
            "conference": conference,
        }

    # ------------------------------------------------------------------
    # Three-Point Contest
    # ------------------------------------------------------------------

    def simulate_three_point_contest(
        self, participants: list[dict]
    ) -> dict:
        """8 players, 5 racks of 5 balls. Top 3 to finals.

        Make rate = threePoint / 100 * 0.6 + 0.20
        Money balls (last ball each rack) worth 2 pts. Max 30/round.
        """
        entrants = list(participants[:8])

        def shoot_round(player: dict) -> int:
            three = player.get("ratings", {}).get("three_point", 50)
            base_rate = three / 100.0 * 0.6 + 0.20
            total = 0
            for _rack in range(5):
                for ball in range(5):
                    is_money = ball == 4
                    # Money balls get a slight rate bump
                    rate = min(0.95, base_rate + (0.03 if is_money else 0.0))
                    if random.random() < rate:
                        total += 2 if is_money else 1
            return total

        # First round
        first_round: list[dict] = []
        for p in entrants:
            score = shoot_round(p)
            first_round.append({
                "player_id": p.get("id", p.get("player_id", "")),
                "score": score,
            })
        first_round.sort(key=lambda x: x["score"], reverse=True)

        # Top 3 to finals
        finalists = first_round[:3]

        # Final round
        final_round: list[dict] = []
        for f in finalists:
            pid = f["player_id"]
            player = self._player_map.get(pid)
            if player is None:
                # Try to find in participants
                player = next(
                    (p for p in entrants
                     if p.get("id", p.get("player_id", "")) == pid),
                    entrants[0],
                )
            score = shoot_round(player)
            final_round.append({"player_id": pid, "score": score})
        final_round.sort(key=lambda x: x["score"], reverse=True)

        winner = final_round[0]["player_id"] if final_round else ""

        return {
            "winner": winner,
            "first_round": first_round,
            "final_round": final_round,
        }

    # ------------------------------------------------------------------
    # Dunk Contest
    # ------------------------------------------------------------------

    def simulate_dunk_contest(self, participants: list[dict]) -> dict:
        """4 players, 2 rounds. Score 6.0-10.0. Top 2 advance to finals."""
        entrants = list(participants[:4])

        def dunk_score(player: dict) -> float:
            r = player.get("ratings", {})
            vertical = r.get("vertical", 50)
            speed = r.get("speed", 50)
            finishing = r.get("finishing", 50)
            fan_fav = player.get("character", {}).get(
                "fan_favorite", 50
            )

            base = (
                vertical / 99.0 * 0.30
                + speed / 99.0 * 0.20
                + finishing / 99.0 * 0.30
                + fan_fav / 99.0 * 0.20
            )
            # Map 0-1 range to 6.0-10.0 with noise
            score = 6.0 + base * 4.0 + random.gauss(0, 0.3)
            return round(max(6.0, min(10.0, score)), 1)

        def get_pid(p: dict) -> str:
            return p.get("id", p.get("player_id", ""))

        # Round 1: each dunker gets 2 dunks, best counts
        round1: list[dict] = []
        for p in entrants:
            d1 = dunk_score(p)
            d2 = dunk_score(p)
            round1.append({
                "player_id": get_pid(p),
                "dunk_1": d1,
                "dunk_2": d2,
                "best": max(d1, d2),
            })
        round1.sort(key=lambda x: x["best"], reverse=True)

        # Top 2 to finals
        finalist_ids = {round1[i]["player_id"] for i in range(min(2, len(round1)))}
        finalists = [p for p in entrants if get_pid(p) in finalist_ids]

        # Finals: single dunk each
        final_round: list[dict] = []
        for p in finalists:
            score = dunk_score(p)
            final_round.append({
                "player_id": get_pid(p),
                "score": score,
            })
        final_round.sort(key=lambda x: x["score"], reverse=True)

        winner = final_round[0]["player_id"] if final_round else ""

        return {
            "winner": winner,
            "round_1": round1,
            "final_round": final_round,
        }

    # ------------------------------------------------------------------
    # Skills Challenge
    # ------------------------------------------------------------------

    def simulate_skills_challenge(
        self, participants: list[dict]
    ) -> dict:
        """4 players scored on ballHandling + speed + passingAccuracy + threePoint."""
        entrants = list(participants[:4])

        results: list[dict] = []
        for p in entrants:
            r = p.get("ratings", {})
            bh = r.get("ball_handling", 50)
            spd = r.get("speed", 50)
            pa = r.get("passing_accuracy", 50)
            tp = r.get("three_point", 50)

            score = (
                bh / 99.0 * 0.25
                + spd / 99.0 * 0.25
                + pa / 99.0 * 0.25
                + tp / 99.0 * 0.25
            ) * 100.0 + random.gauss(0, 3)

            pid = p.get("id", p.get("player_id", ""))
            results.append({"player_id": pid, "score": round(score, 1)})

        results.sort(key=lambda x: x["score"], reverse=True)
        winner = results[0]["player_id"] if results else ""

        return {"winner": winner, "results": results}

    # ------------------------------------------------------------------
    # All-Star Game  (simplified sim, exhibition pace)
    # ------------------------------------------------------------------

    def simulate_allstar_game(
        self,
        east_players: list[dict],
        west_players: list[dict],
    ) -> dict:
        """Simulate an All-Star game with exhibition modifiers.

        Defense * 0.6, pace * 1.2, three tendency * 1.3, no injuries.
        Returns box score + All-Star Game MVP.
        """
        east_score, east_box = self._sim_team_output(east_players, "east")
        west_score, west_box = self._sim_team_output(west_players, "west")

        # Ensure no ties
        if east_score == west_score:
            if random.random() < 0.5:
                east_score += random.randint(1, 3)
            else:
                west_score += random.randint(1, 3)

        winning_conf = "east" if east_score > west_score else "west"
        winning_box = east_box if winning_conf == "east" else west_box

        # All-Star Game MVP: best game score on winning team
        mvp_id = ""
        mvp_score = -1.0
        for ps in winning_box:
            gs = self._game_score(ps)
            if gs > mvp_score:
                mvp_score = gs
                mvp_id = ps["player_id"]

        return {
            "east_score": east_score,
            "west_score": west_score,
            "winning_conference": winning_conf,
            "east_box_score": east_box,
            "west_box_score": west_box,
            "all_star_mvp": mvp_id,
        }

    def _sim_team_output(
        self, players: list[dict], label: str
    ) -> tuple[int, list[dict]]:
        """Generate an exhibition-pace team total and per-player stats."""
        # Exhibition modifier: higher pace, lower defense -> more points
        base_score = random.randint(155, 185)

        box: list[dict] = []
        weights: list[float] = []

        for i, p in enumerate(players):
            overall = p.get("ratings", {}).get("overall", 70)
            minutes = random.uniform(14, 22) if i < 5 else random.uniform(8, 16)
            w = overall * minutes
            weights.append(w)
            box.append({
                "player_id": p.get("id", p.get("player_id", "")),
                "minutes": round(minutes, 1),
                "points": 0,
                "rebounds": 0,
                "assists": 0,
                "steals": 0,
                "blocks": 0,
                "turnovers": 0,
                "three_pointers_made": 0,
                "_overall": overall,
                "_player": p,
            })

        total_w = sum(weights) or 1.0
        remaining = base_score

        for i, entry in enumerate(box):
            if i == len(box) - 1:
                pts = max(0, remaining)
            else:
                share = (weights[i] / total_w) * base_score
                pts = max(0, int(share + random.gauss(0, 3)))
                pts = min(pts, remaining)
            entry["points"] = pts
            remaining -= pts

        # Distribute other stats
        for entry in box:
            p = entry["_player"]
            r = p.get("ratings", {})
            mins_frac = entry["minutes"] / 20.0

            reb_base = r.get("rebounding", 50) / 99.0 * 8.0 * mins_frac
            entry["rebounds"] = max(0, int(reb_base + random.gauss(0, 1)))

            ast_base = r.get("passing_vision", 50) / 99.0 * 7.0 * mins_frac
            entry["assists"] = max(0, int(ast_base + random.gauss(0, 1)))

            entry["steals"] = max(
                0, int(r.get("stealing", 50) / 99.0 * 2.0 * mins_frac
                       + random.gauss(0, 0.5))
            )
            entry["blocks"] = max(
                0, int(r.get("shot_blocking", 50) / 99.0 * 1.5 * mins_frac
                       + random.gauss(0, 0.5))
            )
            entry["turnovers"] = max(
                0, int(1.5 * mins_frac + random.gauss(0, 0.5))
            )

            # Three-point tendency * 1.3 exhibition modifier
            tp_rating = r.get("three_point", 50)
            tp_attempts = max(
                0,
                int(entry["points"] * 0.35 * 1.3
                    * tp_rating / 99.0 + random.gauss(0, 1)),
            )
            tp_made = max(
                0,
                min(tp_attempts,
                    int(tp_attempts * tp_rating / 100.0 * 0.6 + 0.20
                        + random.gauss(0, 0.5))),
            )
            entry["three_pointers_made"] = tp_made

            # Clean up internal keys
            del entry["_overall"]
            del entry["_player"]

        return base_score, box

    @staticmethod
    def _game_score(ps: dict) -> float:
        """Simplified game-score formula for MVP selection."""
        return (
            ps.get("points", 0) * 1.0
            + ps.get("rebounds", 0) * 0.5
            + ps.get("assists", 0) * 0.7
            + ps.get("steals", 0) * 1.0
            + ps.get("blocks", 0) * 0.8
            - ps.get("turnovers", 0) * 0.8
        )

    # ------------------------------------------------------------------
    # Run full weekend
    # ------------------------------------------------------------------

    def run_allstar_weekend(
        self, players: list[dict], teams: list[dict]
    ) -> dict:
        """Run everything in order: selection, contests, game."""
        # Refresh internal maps
        self.players = players
        self.teams = teams
        self._player_map = {p["id"]: p for p in players}
        self._team_map = {t["id"]: t for t in teams}

        # --- Selection ---
        starters = self.select_starters(players, teams)
        reserves = self.select_reserves(players, teams)

        all_selected_east = starters["east"] + reserves["east"]
        all_selected_west = starters["west"] + reserves["west"]

        # --- Gather player dicts for events ---
        east_roster = [
            self._player_map[pid]
            for pid in all_selected_east
            if pid in self._player_map
        ]
        west_roster = [
            self._player_map[pid]
            for pid in all_selected_west
            if pid in self._player_map
        ]

        # --- Contest participants ---
        three_pt_pool = sorted(
            players,
            key=lambda p: p.get("ratings", {}).get("three_point", 0),
            reverse=True,
        )[:8]

        dunk_pool = sorted(
            players,
            key=lambda p: (
                p.get("ratings", {}).get("vertical", 0)
                + p.get("ratings", {}).get("finishing", 0)
            ),
            reverse=True,
        )[:4]

        skills_pool = sorted(
            players,
            key=lambda p: (
                p.get("ratings", {}).get("ball_handling", 0)
                + p.get("ratings", {}).get("speed", 0)
            ),
            reverse=True,
        )[:4]

        # --- Simulate contests ---
        three_pt_result = self.simulate_three_point_contest(three_pt_pool)
        dunk_result = self.simulate_dunk_contest(dunk_pool)
        skills_result = self.simulate_skills_challenge(skills_pool)

        # --- Simulate game ---
        game_result = self.simulate_allstar_game(east_roster, west_roster)

        return {
            "starters": starters,
            "reserves": reserves,
            "three_point_contest": three_pt_result,
            "dunk_contest": dunk_result,
            "skills_challenge": skills_result,
            "game": game_result,
        }
