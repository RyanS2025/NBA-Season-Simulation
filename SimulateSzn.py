import random


class SimulateSzn:
    def __init__(self, name, shot_tendency, threeshot_tendency, touches_tendency, assist_tendency):
        self.name = name
        self.shot_tendency = shot_tendency  # Overall shot tendency (e.g., 50 means 50%)
        self.threeshot_tendency = threeshot_tendency  # Tendency to shoot 3P (e.g., 40)
        self.fg_success_rate = 0.60  # Average NBA FG% (45%) originally .65
        self.three_success_rate = 0.36  # Average NBA 3P% (36%)
        self.min_three_attempts = 1  # Minimum number of 3P attempts per game
        self.touches_tendency = touches_tendency # Input touches tendency (0-100)
        self.assist_tendency = assist_tendency

    def attempt_shot_szn(self):
        touch_chance = random.randint(1, 100)

        # Check if the player receives the ball (based on touches_tendency)
        if touch_chance <= self.touches_tendency:  # Player gets the ball and could attempt a shot
            shot_chance = random.randint(1, 100)
            if shot_chance <= self.shot_tendency:  # Check if a shot is attempted
                shot_make = random.random()  # Random float between 0 and 1
                shot_three = random.randint(1, 100)

                if shot_three <= self.threeshot_tendency:  # Check if a 3P shot is attempted
                    # Calculate three-point shot success
                    if shot_make <= self.three_success_rate:  # Successful 3P
                        return 3, 1, 1, 1, 1, 0  # Points, FG Made, 3 Made, 3 Attempted, FGA, Assist
                    else:
                        return 0, 0, 0, 1, 1, 0  # Missed 3P attempt
                else:  # Regular FG attempt
                    # Calculate field goal success
                    if shot_make <= self.fg_success_rate:  # Successful FG
                        return 2, 1, 0, 0, 1, 0  # Points, FG Made, 3 Made, 3 Attempted, FGA
                    else:
                        return 0, 0, 0, 0, 1, 0  # Missed FG attempt
            else:
                assist_chance = random.randint(1, 100)
                if assist_chance <= self.assist_tendency:
                    return 0, 0, 0, 0, 0, 1 #pass and assist
                else:
                    return 0, 0, 0, 0, 0, 0  # No shot attempted
        else:
            return 0, 0, 0, 0, 0, 0  # No shot attempted (did not get the ball)

    def simulate_game(self, suggested_minutes):
        # Add variability to minutes played (e.g., +/- 5 minutes from suggested minutes)
        minutes = max(0, suggested_minutes + random.randint(-5, 5))

        simtotal = 0
        fg_made = 0
        three_made = 0
        three_attempted = 0
        fg_attempted = 0
        assisttotal = 0

        # Simulate for the given number of minutes
        for _ in range(minutes):
            points, fg, threes, threes_attempt, fga, assists = self.attempt_shot_szn()
            simtotal += points
            fg_made += fg
            three_made += threes
            three_attempted += threes_attempt
            fg_attempted += fga
            assisttotal += assists

        return simtotal, fg_made, three_made, three_attempted, fg_attempted, minutes, assisttotal

    def season(self, suggested_minutes):
        total_points = 0
        total_fg_made = 0
        total_three_made = 0
        total_three_attempted = 0
        total_fg_attempted = 0
        total_minutes = 0
        total_assists = 0

        for game in range(82):
            points, fg_made, threes_made, threes_attempted, fg_attempted, minutes, assists = self.simulate_game(
                suggested_minutes)
            total_points += points
            total_fg_made += fg_made
            total_three_made += threes_made
            total_three_attempted += threes_attempted
            total_fg_attempted += fg_attempted
            total_minutes += minutes
            total_assists+= assists

            # Ensure minimum three-point attempts
            if threes_attempted < self.min_three_attempts:
                three_make = random.random()
                if three_make <= self.three_success_rate:
                    total_points += 3
                    total_three_made += 1
                    total_three_attempted += 1
                    total_fg_attempted += 1

            # Print individual game stats
            print(f"Game {game + 1}: {points} points | Assists: {assists} assists | FG Made: {fg_made}, FG Attempted: {fg_attempted}, "
                  f"3P Made: {threes_made}, 3P Attempted: {threes_attempted}, Minutes Played: {minutes}")

        avg_points_per_game = total_points / 82
        avg_assist_per_game = total_assists / 82
        fg_percentage = (total_fg_made / total_fg_attempted) * 100 if total_fg_attempted > 0 else 0
        three_percentage = (total_three_made / total_three_attempted) * 100 if total_three_attempted > 0 else 0
        avg_minutes_per_game = total_minutes / 82

        # Return the final stats for possible use elsewhere
        return avg_minutes_per_game, avg_points_per_game, fg_percentage, three_percentage, total_fg_made, total_fg_attempted, total_three_made, total_three_attempted, avg_assist_per_game


# Prompt for user input before running the simulation
if __name__ == "__main__":
    name = input("Enter the player's name: ")
    shot_tendency = int(input("Enter the shot tendency (0-100): "))
    threeshot_tendency = int(input("Enter the three-point shot tendency (0-100): "))
    assist_tendency = int(input("Enter the assists tendency (0-100): "))
    touches_tendency = int(input("Enter the touches tendency (0-100): "))
    suggested_minutes = int(input("Enter the suggested minutes per game: "))

    player = SimulateSzn(name=name, shot_tendency=shot_tendency, threeshot_tendency=threeshot_tendency,
                         touches_tendency=touches_tendency, assist_tendency=assist_tendency)
    # Now the season method will return stats as well, so you can unpack it
    stats = player.season(suggested_minutes)
    print(f"\nSeason Stats (Returned): {stats}")
