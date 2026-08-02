from __future__ import annotations
import random
from .models.player import Player
from .models.team import Team
from .models.league import LeagueSettings, SeasonAwards


class AwardsVoter:
    def __init__(self, voter_id: int):
        self.voter_id = voter_id
        self.big_market_bias: float = random.uniform(0.0, 0.1)
        self.stats_weight: float = random.uniform(0.3, 0.5)
        self.team_success_weight: float = random.uniform(0.2, 0.4)
        self.narrative_weight: float = random.uniform(0.1, 0.3)
        self.eye_test_weight: float = random.uniform(0.1, 0.2)

    def rank_candidates(self, candidates: list[dict], award_type: str) -> list[str]:
        pass

    def score_candidate(self, candidate: dict, award_type: str) -> float:
        pass


class AwardsEngine:
    def __init__(self, num_voters: int = 100):
        self.voters = [AwardsVoter(i) for i in range(num_voters)]

    def compute_awards(self, teams: list[Team], players: list[Player], season_stats: dict, settings: LeagueSettings, preseason_projections: dict) -> SeasonAwards:
        pass

    def vote_mvp(self, candidates: list[dict]) -> str:
        pass

    def vote_dpoy(self, candidates: list[dict]) -> str:
        pass

    def vote_roty(self, candidates: list[dict]) -> str:
        pass

    def vote_sixth_man(self, candidates: list[dict]) -> str:
        pass

    def vote_mip(self, candidates: list[dict], previous_stats: dict) -> str:
        pass

    def vote_coty(self, teams: list[Team], preseason_projections: dict) -> str:
        pass

    def vote_eoty(self, teams: list[Team], transactions: list[dict], preseason_projections: dict) -> str:
        pass

    def vote_clutch_poy(self, candidates: list[dict]) -> str:
        pass

    def select_all_nba(self, candidates: list[dict]) -> dict:
        pass

    def select_all_defensive(self, candidates: list[dict]) -> dict:
        pass

    def select_all_rookie(self, candidates: list[dict]) -> dict:
        pass

    def select_finals_mvp(self, series_stats: list[dict]) -> str:
        pass

    def get_vote_breakdown(self, award_type: str) -> dict:
        pass

    def _build_candidate_profile(self, player: Player, stats: dict, team: Team) -> dict:
        pass
