from SimulateGame import SimulateGame
from SimulateSzn import SimulateSzn
from GetStats import GetStats

choice = input("Would you like to search a player for reference (Yes/No): ").lower()
if choice == 'yes':
    get_stats = GetStats()
    while True:
        name = input("Enter Player: ")

        try:
            player_id, full_name = get_stats.get_player_id(name)
            real_stats = get_stats.get_player_stats(player_id)

            print(f"\n Real Stats for {full_name} ({real_stats['season']}):")
            print(f"PPG: {real_stats['ppg']}")
            print(f"APG: {real_stats['apg']}")
            print(f"FG%: {real_stats['fg_pct']:.1f}%")
            print(f"FGM/FGA (per game): {real_stats['fgm_pg']} / {real_stats['fga_pg']}")
            print(f"3P%: {real_stats['three_pct']:.1f}%")
            print(f"3PM/3PA (per game): {real_stats['three_fgm_pg']} / {real_stats['three_fga_pg']}")
            print(f"")
            break
        except Exception as e:
            print(f"\n Could not fetch real stats for {name}. Reason: {e}")
            retry = input("Try again (Yes/No): ").lower()
            print(f"")
            if retry!= "yes":
                break


name = input("What is your player's name: ")
while True:
    try:
        shot_tendency = int(input("What is your player's shot tendency (Between 1-100): "))/1.5
        if 1 <= shot_tendency <= 100:
            break
        else:
            print("Please enter a number between 1 and 100.")
    except ValueError:
        print("Invalid input! Please enter a valid number.")

while True:
    try:
        threeshot_tendency = int(input("What is your player's three point shot tendency (Between 1-100): "))/2
        if 1 <= threeshot_tendency <= 100:
            break
        else:
            print("Please enter a number between 1 and 100.")
    except ValueError:
        print("Invalid input! Please enter a valid number.")

while True:
    try:
        assist_tendency = int(input("What is your player's assist tendency (Between 1-100): "))
        if 1 <= assist_tendency <= 100:
            break
        else:
            print("Please enter a number between 1 and 100.")
    except ValueError:
        print("Invalid input! Please enter a valid number.")


while True:
    try:
        touches_tendency = int(input("What is your player's touches tendency (Between 1-100): "))
        if 1 <= touches_tendency <= 100:
            break
        else:
            print("Please enter a number between 1 and 100.")
    except ValueError:
        print("Invalid input! Please enter a valid number.")

print(f"\nPlayer: {name}\nShot Tendency: {int(shot_tendency*1.5)}\nAssist Tendency: {assist_tendency}\n3pt Shot Tendency: {int(threeshot_tendency*2)}\nTouches Tendency: {touches_tendency}")

while True:
    try:
        minutes = int(input(f"How many minutes does {name} play (0-48): "))
        if 0 <= minutes <= 48:
            break
        else:
            print("Please enter a number between 0 and 48.")
    except ValueError:
        print("Invalid input! Please enter a valid number.")

choice = input("Press 1 to simulate game. Press 2 to simulate season: ")
print("\nSimulating...\n")

if choice == '1':
    player_simulation = SimulateGame(name, shot_tendency, threeshot_tendency, touches_tendency, assist_tendency)
    total_score, field_goalmade, threemade, threeattempt, fieldgoalattempt, assists = player_simulation.simulate(minutes)
    print(f"Total points scored by {name} in {minutes} minutes: {total_score}")
    print(f"Total assists made by {name} in {minutes} minutes: {assists}")
    if fieldgoalattempt > 0:
        print(f"FG%: {field_goalmade / fieldgoalattempt:.2%} ({field_goalmade}/{fieldgoalattempt})")
    else:
        print("FG%: No attempts made.")

    if threeattempt > 0:
        print(f"3P%: {threemade / threeattempt:.2%} ({threemade}/{threeattempt})")
    else:
        print("3P%: No 3-point attempts made.")
elif choice == '2':
    season_simulation = SimulateSzn(name, shot_tendency, threeshot_tendency, touches_tendency, assist_tendency)
    avg_minutes, avg_score, fg_percentage, three_percentage, total_fg_made, total_fg_attempted, total_three_made, total_three_attempted, avg_assists = season_simulation.season(minutes)
    print(f"\nMinutes per game: {avg_minutes: .1f} minutes")
    print(f"Total points per game scored by {name}: {avg_score:.1f} ppg")
    print(f"Total assist per game scored by {name}: {avg_assists:.1f} apg")
    print(f"FG% over the season: {fg_percentage:.2f}% ({total_fg_made/82:.1f}/{total_fg_attempted/82:.1f})")
    print(f"3P% over the season: {three_percentage:.2f}% ({total_three_made/82:.1f}/{total_three_attempted/82:.1f})")
else:
    print("Invalid input. Press 1 or 2.")