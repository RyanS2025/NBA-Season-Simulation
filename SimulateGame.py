import random

class SimulateGame:
    def __init__(self, name, shot_tendency, threeshot_tendency, touches_tendency, assist_tendency):
        self.name = name
        self.shot_tendency = shot_tendency  # Shot attempt tendency (0-100)
        self.threeshot_tendency = threeshot_tendency  # 3-point shot attempt tendency (0-100)
        self.touches_tendency = touches_tendency  # Tendency to receive the ball (0-100)
        self.assist_tendency = assist_tendency

    def attempt_shot(self):
        touch_chance = random.randint(1, 100)

        # Check if the player receives the ball (based on touches_tendency)
        if touch_chance <= self.touches_tendency:  # Player gets the ball and could attempt a shot
            print(f"{self.name} has possession of the ball!")
            shot_chance = random.randint(1, 100)

            if shot_chance <= self.shot_tendency:  # Check if a shot is attempted
                shot_make = random.randint(0, 100)
                if shot_make <= 45:
                    shot_three = random.randint(1, 100)
                    if shot_three <= self.threeshot_tendency:
                        print("It's a three!")
                        return 3, 1, 1, 1, 1, 0  # Points, Field Goal Made, 3 Made, 3 Attempt, FGA
                    else:
                        print("It's a two!")
                        return 2, 1, 0, 0, 1, 0  # 2-point attempt
                else:
                    three_attempt = random.randint(1, 100)
                    if three_attempt <= self.threeshot_tendency:
                        print("And it's a three-point miss!")
                        return 0, 0, 0, 1, 1, 0  # Missed 3-point attempt
                    else:
                        print("And it's a two-point miss!")
                        return 0, 0, 0, 0, 1, 0  # Missed 2-point attempt
            else:
                assist_chance = random.randint(1, 100)
                if assist_chance<=self.assist_tendency:
                    print(f"{self.name} passes the ball. Their teammate scores!")
                    return 0, 0, 0, 0, 0, 1
                else:
                    print(f"{self.name} passes the ball.")
                    return 0, 0, 0, 0, 0, 0  # No shot attempted
        else:
            # Player does not get possession
            print(f"{self.name} does not have possession of the ball this time!")
            return 0, 0, 0, 0, 0, 0  # No shot attempted

    def simulate(self, minutes):
        total_points, field_goals_made, three_made, three_attempt, field_goal_attempt, total_assists = 0, 0, 0, 0, 0, 0
        for minute in range(minutes):
            print(f"Minute {minute + 1}:")
            points, fg_made, threes_made, threes_attempted, fga, assists = self.attempt_shot()
            total_points += points
            field_goals_made += fg_made
            three_made += threes_made
            three_attempt += threes_attempted
            field_goal_attempt += fga
            total_assists+=assists
            print(f"Total points so far: {total_points}")
            print(f"Total assists so far: {total_assists}\n")
        return total_points, field_goals_made, three_made, three_attempt, field_goal_attempt, total_assists


# Prompt for user input before running the simulation
if __name__ == "__main__":
    name = input("Enter the player's name: ")
    shot_tendency = int(input("Enter the shot tendency (0-100): "))
    threeshot_tendency = int(input("Enter the three-point shot tendency (0-100): "))
    touches_tendency = int(input("Enter the touches tendency (0-100): "))

    player = SimulateGame(name=name, shot_tendency=shot_tendency, threeshot_tendency=threeshot_tendency,
                          touches_tendency=touches_tendency)
    results = player.simulate(minutes=48)  # Simulate for a game length of 48 minutes
    print(results)
