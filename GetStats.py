from nba_api.stats.static import players
from nba_api.stats.endpoints import playercareerstats


class GetStats:
    def __init__(self):
        pass  # no API key needed for nba_api

    def get_player_id(self, name):
        found_players = players.find_players_by_full_name(name)
        if not found_players:
            raise Exception(f"Player '{name}' not found.")
        player = found_players[0]
        return player['id'], player['full_name']

    def get_player_stats(self, player_id):
        career = playercareerstats.PlayerCareerStats(player_id=player_id)
        df = career.get_data_frames()[0]

        # Get the latest regular season stats
        latest = df[df['LEAGUE_ID'] == '00'].sort_values('SEASON_ID', ascending=False).iloc[0]

        games_played = latest['GP']
        if games_played == 0:
            raise Exception("No games played this season.")

        return {
            "season": latest['SEASON_ID'],
            "mpg": round(latest['MIN'] / games_played, 1),
            "ppg": round(latest['PTS'] / games_played, 1),
            "apg": round(latest['AST'] / games_played, 1),
            "fg_pct": latest['FG_PCT'] * 100,
            "fga_pg": round(latest['FGA'] / games_played, 1),
            "fgm_pg": round(latest['FGM'] / games_played, 1),
            "three_pct": latest['FG3_PCT'] * 100,
            "three_fga_pg": round(latest['FG3A'] / games_played, 1),
            "three_fgm_pg": round(latest['FG3M'] / games_played, 1)
        }

    def get_player_stats_career(self, player_id):
        career = playercareerstats.PlayerCareerStats(player_id=player_id)
        df = career.get_data_frames()[0]

        career_data = df[df['LEAGUE_ID'] == '00']  # Fixed indentation here

        total_games_played = career_data['GP'].sum()
        if total_games_played == 0:
            raise Exception("No games played in career.")

        career_stats = {
            "season": "Career Averages",
            "career_games": total_games_played,
            "mpg": round(career_data['MIN'].sum() / total_games_played, 1),
            "ppg": round(career_data['PTS'].sum() / total_games_played, 1),
            "apg": round(career_data['AST'].sum() / total_games_played, 1),
            "fg_pct": round(career_data['FG_PCT'].sum() / len(career_data) * 100, 1),
            "fga_pg": round(career_data['FGA'].sum() / total_games_played, 1),
            "fgm_pg": round(career_data['FGM'].sum() / total_games_played, 1),
            "three_pct": round(career_data['FG3_PCT'].sum() / len(career_data) * 100, 1),
            "three_fga_pg": round(career_data['FG3A'].sum() / total_games_played, 1),
            "three_fgm_pg": round(career_data['FG3M'].sum() / total_games_played, 1)
        }

        return career_stats

