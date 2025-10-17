from flask import Flask, render_template, request, session
from SimulateGame import SimulateGame
from SimulateSzn import SimulateSzn
from GetStats import GetStats

app = Flask(__name__)
app.secret_key = "clearkey"

season_stats = []


@app.route("/", methods=["GET", "POST"])
def index():
    result = None
    real_stats = None
    real_stats_career = None
    data_type = None

    if request.method == "POST":
        action = request.form.get("action")

        if action == "simulate":
            # Simulation logic remains unchanged
            name = request.form["name"]
            shot_tendency = int(request.form["shot_tendency"]) / 1.5
            threeshot_tendency = int(request.form["threeshot_tendency"]) / 2
            assist_tendency = int(request.form["assist_tendency"])
            touches_tendency = int(request.form["touches_tendency"])
            minutes = int(request.form["minutes"])
            sim_type = request.form["sim_type"]

            if sim_type == "game":
                sim = SimulateGame(name, shot_tendency, threeshot_tendency, touches_tendency, assist_tendency)
                total_score, fgm, threemade, threeatt, fga, assists = sim.simulate(minutes)
                result = {
                    "type": "game",
                    "name": name,
                    "minutes": minutes,
                    "points": total_score,
                    "assists": assists,
                    "fg_pct": f"{(fgm / fga * 100):.1f}%" if fga > 0 else "N/A",
                    "fgm": fgm,
                    "fga": fga,
                    "three_pct": f"{(threemade / threeatt * 100):.1f}%" if threeatt > 0 else "N/A",
                    "three_made": threemade,
                    "three_att": threeatt
                }
            else:
                sim = SimulateSzn(name, shot_tendency, threeshot_tendency, touches_tendency, assist_tendency)
                avg_min, avg_pts, fg_pct, three_pct, fgm, fga, threem, threea, avg_ast = sim.season(minutes)
                result = {
                    "type": "season",
                    "name": name,
                    "avg_min": round(avg_min, 1),
                    "avg_pts": round(avg_pts, 1),
                    "avg_ast": round(avg_ast, 1),
                    "fg_pct": f"{fg_pct:.1f}%",
                    "fgm": round(fgm / 82, 1),
                    "fga": round(fga / 82, 1),
                    "three_pct": f"{three_pct:.1f}%",
                    "three_made": round(threem / 82, 1),
                    "three_att": round(threea / 82, 1)
                }
                if "season_stats" not in session:
                    session["season_stats"] = []
                session["season_stats"].append({
                    "avg_min": round(avg_min, 1),
                    "avg_pts": round(avg_pts, 1),
                    "avg_ast": round(avg_ast, 1),
                    "fg_pct": f"{fg_pct:.1f}%",
                    "fgm": round(fgm / 82, 1),
                    "fga": round(fga / 82, 1),
                    "three_pct": f"{three_pct:.1f}%",
                    "three_made": round(threem / 82, 1),
                    "three_att": round(threea / 82, 1)
                })
                session.modified = True

        elif action == "search":
            name = request.form["search_name"]
            data_type = request.form["data_type"]  # Get selected data_type (Recent or Career)
            get_stats = GetStats()

            try:
                player_id, full_name = get_stats.get_player_id(name)

                if data_type == "Recent":
                    real = get_stats.get_player_stats(player_id)
                    real_stats = {
                        "name": full_name,
                        "season": real["season"],
                        "mpg": real["mpg"],
                        "ppg": real["ppg"],
                        "apg": real["apg"],
                        "fg_pct": f"{real['fg_pct']:.1f}%",
                        "fgm_pg": real["fgm_pg"],
                        "fga_pg": real["fga_pg"],
                        "three_pct": f"{real['three_pct']:.1f}%",
                        "three_fgm_pg": real["three_fgm_pg"],
                        "three_fga_pg": real["three_fga_pg"]
                    }
                elif data_type == "Career":
                    real = get_stats.get_player_stats_career(player_id)
                    real_stats_career = {
                        "name": full_name,
                        "season": real["season"],
                        "mpg": real["mpg"],
                        "ppg": real["ppg"],
                        "apg": real["apg"],
                        "fg_pct": f"{real['fg_pct']:.1f}%",
                        "fgm_pg": real["fgm_pg"],
                        "fga_pg": real["fga_pg"],
                        "three_pct": f"{real['three_pct']:.1f}%",
                        "three_fgm_pg": real["three_fgm_pg"],
                        "three_fga_pg": real["three_fga_pg"]
                    }
                else:
                    real_stats = {"error": "Invalid data type selected."}
            except Exception as e:
                real_stats = {"error": f"Could not fetch stats for {name}. Reason: {str(e)}"}
        elif action == "clear_history":
            session["season_stats"] = []
            session.modified = True

    # Ensure the function always returns a valid response
    return render_template("index.html", result=result, real_stats=real_stats, real_stats_career=real_stats_career, season_stats=session.get("season_stats", []), data_type=data_type)

if __name__ == '__main__':
    app.run(debug=True)
