# BBAL Sim — Simulation Realism Overhaul (Fable 5 Prompt)

> Copy everything below this line into a new Claude Code conversation using Fable 5.

---

You are working on BBAL Sim, an NBA GM simulator built with React 19 + Vite 8 + Tailwind CSS v4 + Dexie.js/IndexedDB. The core game loop works (league creation, schedule, scores, playoffs, draft, free agency, season transitions) but the **simulation engine has critical bugs and missing features** that destroy realism.

Read `CLAUDE.md` first for commit rules. Commit after each numbered task below passes type check (`cd frontend && npx tsc --noEmit`). Start the dev server with `cd frontend && npm run dev` and test in browser after each task.

## CRITICAL DESIGN RULE

**Overall rating (`ratings.overall`) is COSMETIC ONLY.** Simulations must NEVER use `ratings.overall` — they must rely on player individual skill ratings, tendencies, fit, chemistry, and matchups. The `intangibles` stat only affects the displayed overall. Any code that reads `ratings.overall` for game simulation purposes is a BUG.

## Current Architecture (Read These First)

Before writing ANY code, read these files completely to understand the existing architecture:

1. `frontend/src/utils/quick-sim.ts` — The game simulation engine (251 lines). Currently uses `ratings.overall` for everything.
2. `frontend/src/hooks/useLeague.tsx` — The game loop. `simGames()` at line 181 calls quickSimGame and stores results. **Stats are never accumulated.**
3. `frontend/src/types/player.ts` — Player type with `PlayerRatings` (30+ individual skills), `PlayerTendencies` (22 tendency values), `SeasonStats` interface, `careerStats: SeasonStats[]`
4. `frontend/src/types/team.ts` — Team type with `CoachingStaff` (offensiveScheme, defensiveScheme, pacePreference, threePointEmphasis, starterMinutes). Also has `OffensiveScheme` and `DefensiveScheme` union types.
5. `frontend/src/types/game.ts` — Game/GameResult/PlayerGameStats/TeamBoxScore types
6. `frontend/src/db/league-db.ts` — DB schema. Has `playerSeasonStats` table defined but NEVER WRITTEN TO.

Also read to understand stat consumers:
7. `frontend/src/utils/awards/awards-engine.ts` — Reads `careerStats[last]` for award voting
8. `frontend/src/utils/trade-value-engine.ts` — Reads `careerStats[last]` for trade values
9. `frontend/src/pages/league/LeagueHistoryPage.tsx` — Reads `careerStats[last]` for league leaders

## The 5 Critical Problems

### Problem 1: Stats Never Accumulate (MOST CRITICAL)
`quickSimGame()` generates full box scores with per-player `PlayerGameStats` (points, rebounds, assists, etc.). These are stored in the `gameResults` DB table. But **no code anywhere** rolls these per-game stats into player `careerStats`. The `careerStats` array only ever contains the player's real NBA historical stats from the JSON import. Every system that reads stats (awards, trade values, league leaders, player pages) displays stale import data, not simulated performance. A player averaging 7 PPG in their last real NBA season appears as the "league leader" regardless of simulated performance.

### Problem 2: `ratings.overall` Drives Everything
In `quick-sim.ts`:
- `teamStrength()` (line 48-61) sorts by `ratings.overall` and computes weighted average of top 8 players' overall
- `simulatePlayerStats()` (line 63-118) uses `const ovr = player.ratings.overall` to determine FGA, FG%, FT rate
- `generateMinutes()` (line 121-144) sorts by `ratings.overall` to allocate minutes
- This means a player with 90 overall but terrible shooting ratings still shoots well, and a player with 70 overall but elite shooting shoots poorly

### Problem 3: Coaching Schemes Are Ignored
`CoachingStaff` on each Team has:
- `offensiveScheme`: motion, iso_heavy, pick_and_roll, triangle, pace_and_space, princeton, drive_and_kick
- `defensiveScheme`: man_to_man, switching, drop_coverage, blitz, zone_2_3, zone_3_2, pack_the_paint
- `pacePreference`: 0-100
- `threePointEmphasis`: 0-100
- `starterMinutes`: [number, number, number, number, number]

**None of these are used by `quickSimGame`.** The `_teamPace` parameter in `simulatePlayerStats` is literally prefixed with underscore (unused). Minutes are purely based on overall ranking.

### Problem 4: Player Tendencies Are Unused
`PlayerTendencies` has 22 values that are never referenced by any simulation code:
- `pullUpFrequency`, `catchAndShootFrequency`, `driveFrequency`, `postUpFrequency`, `isoFrequency`
- `pickAndRollBallHandler`, `pickAndRollScreener`, `spotUpFrequency`, `transitionFrequency`, `cutFrequency`
- `usageDesire`, `pacePreference`, `contestedShotWillingness`
- `gambleForSteals`, `helpDefenseRate`, `closeoutAggression`, `boxOutRate`
- `passOutOfDriveRate`, `skipPassRate`, `alleyOopPassRate`
- `foulProneness`, `shotClockTendency`

### Problem 5: No Coaching/Rotation Management UI
Users cannot set minutes, choose offensive/defensive schemes, or configure team play style. There's no route or page for this.

---

## Tasks (In Order)

### Task 1: Stat Accumulation Pipeline

Create `frontend/src/utils/stat-accumulator.ts` with a function that aggregates game box scores into player season stats.

**Implementation approach:**

```typescript
// In stat-accumulator.ts:

interface RunningStatTotals {
  gp: number
  gs: number  
  totalMinutes: number
  totalPoints: number
  totalRebounds: number
  totalAssists: number
  totalSteals: number
  totalBlocks: number
  totalTurnovers: number
  totalFGM: number
  totalFGA: number
  total3PM: number
  total3PA: number
  totalFTM: number
  totalFTA: number
  totalORebs: number
  totalDRebs: number
  totalPF: number
  totalPlusMinus: number
}

// Call this after each batch of games in simGames()
export function accumulateGameStats(
  players: Player[],
  gameResult: GameResult,
  seasonYear: number,
  teamId: string, // which team's box score to process
): Player[] // returns the modified players that need DB update
```

The function should:
1. Get the relevant TeamBoxScore from the GameResult (home or away based on teamId)
2. For each PlayerGameStats in the box score, find the matching Player
3. Check if the player already has a SeasonStats entry for the current season (where `season` matches `String(seasonYear)`)
4. If not, push a new SeasonStats entry onto `player.careerStats`
5. If yes, update the existing entry with new running averages
6. Return the list of modified players

**The SeasonStats type** (already defined in `frontend/src/types/player.ts`):
```typescript
interface SeasonStats {
  season: string     // e.g. "2027"
  team: string       // team abbreviation
  gp: number         // games played
  gs: number         // games started
  mpg: number        // minutes per game
  ppg: number        // points per game  
  rpg: number        // rebounds per game
  apg: number        // assists per game
  spg: number        // steals per game
  bpg: number        // blocks per game
  topg: number       // turnovers per game
  fgm: number        // field goals made per game
  fga: number        // field goals attempted per game
  fg_pct: number     // field goal percentage (0-1)
  three_pm: number   // 3PT made per game
  three_pa: number   // 3PT attempted per game
  three_pct: number  // 3PT percentage (0-1)
  ftm: number        // FT made per game
  fta: number        // FT attempted per game
  ft_pct: number     // FT percentage (0-1)
  orpg: number       // offensive rebounds per game
  drpg: number       // defensive rebounds per game
  pfpg: number       // personal fouls per game
}
```

**For per-game averages:** Store running totals internally and compute: `ppg = totalPoints / gp`, `fg_pct = totalFGM / totalFGA`, etc.

**Strategy for storing running totals:** Since SeasonStats only has per-game averages, you need to reconstruct totals from the existing entry: `totalPoints = existingEntry.ppg * existingEntry.gp`. Then add the new game's stats, increment gp, and recompute averages.

**Wire into useLeague.tsx `simGames()` (line 181-226):**
After the game result is stored and team records are updated, call the accumulator for both teams' players. Collect all modified players into a Set, then at the END of the simGames loop, batch-write them to DB via `db.players.bulkPut(modifiedPlayers)`.

To get the team abbreviation for SeasonStats.team, use `teams.find(t => t.id === teamId)?.info.abbreviation ?? ''`.

**Important:** Players already have real NBA historical stats in `careerStats` from the JSON import. The new simulated season stats should be APPENDED as a new entry. Don't overwrite historical data.

### Task 2: Rewrite quick-sim.ts for Skill-Based Simulation

Rewrite `frontend/src/utils/quick-sim.ts` to use individual player skills instead of `ratings.overall`.

**2A: Replace `teamStrength()` with skill-based composite:**

Instead of averaging `ratings.overall`, compute a weighted composite from individual skills. The weights should be position-aware:

```
Guards (PG/SG): ballHandling×1.2 + passingVision×1.0 + threePoint×1.1 + midRange×0.8 + finishing×0.9 + perimeterDefense×0.7 + speed×0.5 + basketballIq×0.6
Forwards (SF/PF): finishing×1.1 + midRange×0.9 + threePoint×0.8 + rebounding×1.0 + interiorDefense×0.8 + perimeterDefense×0.7 + strength×0.5 + basketballIq×0.6
Centers (C): finishing×1.0 + postGame×1.2 + rebounding×1.3 + interiorDefense×1.1 + shotBlocking×0.9 + strength×0.7 + basketballIq×0.5
```

Normalize to produce a 0-100 composite. This replaces every use of `ratings.overall` in team strength calculation.

**2B: Rewrite `simulatePlayerStats()` to use individual skills:**

Currently line 69 does `const ovr = player.ratings.overall`. Replace ALL uses:

- **FGA** (line 72): Use `(finishing + midRange + threePoint + postGame) / 4` weighted by position and `tendencies.usageDesire`
- **FG%** (line 73): Use weighted combo of `finishing`, `midRange`, `closeRange` based on shot distribution
- **3PT rate and %** (lines 76-79): Already uses `ratings.threePoint` — good, keep but also factor in `tendencies.catchAndShootFrequency` and `tendencies.pullUpFrequency`
- **FT rate** (line 81): Use `ratings.drawFoul` instead of overall
- **Rebounds** (line 88): Already uses `ratings.rebounding` — good
- **Assists** (line 92): Already uses `ratings.passingVision` — good
- **Steals** (line 93): Already uses `ratings.stealing` — good
- **Blocks** (line 94): Already uses `ratings.shotBlocking` — good
- **Turnovers** (line 95): Already uses `ratings.ballHandling` — good

**2C: Rewrite `generateMinutes()` to use skill composite instead of overall:**

Replace `p.ratings.overall` at line 123 with the same position-weighted skill composite from 2A.

**2D: Accept and use `CoachingStaff` in the simulation:**

Change `quickSimGame` signature to also accept the home/away team's `CoachingStaff`:

```typescript
export interface CoachingContext {
  homeStaff: StaffRoster | null
  awayStaff: StaffRoster | null
  homeCoaching: CoachingStaff | null  // ADD
  awayCoaching: CoachingStaff | null  // ADD
}
```

Use coaching data:
- **Pace**: Average both teams' `pacePreference` to determine game pace. Higher pace = more possessions = more counting stats but slightly lower efficiency
- **3PT emphasis**: Multiply `threeRate` in player stats by `(0.85 + team.threePointEmphasis * 0.003)` — a team with 100 emphasis shoots ~15% more threes
- **Offensive scheme bonuses**: 
  - `iso_heavy`: +FGA for top 2 players, -assists
  - `motion`: +assists, +team FG%
  - `pick_and_roll`: +FGA for PG/C, +assists for PG
  - `pace_and_space`: +3PA, +pace
  - `drive_and_kick`: +FGA for guards, +3PA for wings
- **Defensive scheme bonuses** (applied to opposing team):
  - `switching`: -post-up efficiency for bigs, -iso efficiency
  - `blitz`: -PG efficiency, +turnovers
  - `pack_the_paint`: -interior FG%, +3PA (force outside shots)
  - `zone_2_3`: -interior scoring, +midrange opportunities

**2E: Use player tendencies:**

In `simulatePlayerStats()`:
- `usageDesire` (0-100): Scale FGA by `0.85 + usageDesire * 0.003` — high usage players take more shots
- `isoFrequency`: Increases individual FGA, decreases assists contribution
- `spotUpFrequency`: Increases 3PA rate
- `driveFrequency`: Increases FTA (drawing fouls by driving)
- `postUpFrequency`: Increases close-range/post attempts for bigs
- `gambleForSteals`: Increases steals but also increases opponent FGA (blown coverage)
- `boxOutRate`: Increases rebounding
- `foulProneness`: Increases personal fouls

**2F: Realistic stat targets:**

After all modifiers, the sim should produce these approximate per-game team/player averages (verify by simming a full season):
- Team: 108-114 PPG, 43-47 RPG, 24-28 APG
- Star player (top 5 composite): 24-30 PPG, 5-10 RPG, 4-8 APG, 32-36 MPG
- Starter (6th-10th composite): 14-20 PPG, 4-7 RPG, 2-5 APG, 28-32 MPG
- Rotation player: 8-14 PPG, 3-5 RPG, 1-3 APG, 18-24 MPG
- Bench: 4-8 PPG, 1-3 RPG, 0-2 APG, 8-16 MPG
- Deep bench: 0-4 PPG, 0-2 RPG, 0-1 APG, 0-5 MPG

If stats are too low or too high after implementation, tune the coefficients until the ranges above are hit. The most important thing is that the BEST players in the league average 25+ PPG and the league scoring leader should be around 30-33 PPG.

**Update the call site** in `useLeague.tsx` `simGames()` (line 197) to pass coaching:

```typescript
const result = quickSimGame(game, homePlayers, awayPlayers, {
  homeStaff: homeTeamData?.staff ?? null,
  awayStaff: awayTeamData?.staff ?? null,
  homeCoaching: homeTeamData?.coaching ?? null,  // ADD
  awayCoaching: awayTeamData?.coaching ?? null,  // ADD
})
```

### Task 3: Coaching Management Page

Create `frontend/src/pages/league/CoachingPage.tsx` — a page where users manage their team's game plan.

**Sections:**

**A. Rotation & Minutes**
- Show the user's roster sorted by current minutes allocation
- Drag-to-reorder or manual minute sliders for each player (range 0-40)
- Total minutes must equal 240 (5 players × 48 minutes). Show remaining minutes counter.
- "Starters" (top 5 by minutes) should be visually distinguished
- "Let Coach Decide" toggle — when ON, minutes are auto-assigned based on player skill composite (the default behavior). When OFF, user-set minutes are used.
- Store the rotation on `team.coaching.starterMinutes` (expand this to a full roster minutes map if needed — you may need to add a `rotationMinutes: Record<string, number>` field to `CoachingStaff` in `team.ts`)

**B. Offensive Scheme**
- Radio/card selector for the 7 offensive schemes: Motion, ISO Heavy, Pick & Roll, Triangle, Pace & Space, Princeton, Drive & Kick
- Brief description of each scheme's effects (e.g., "Motion: +ball movement, +assists, +team shooting efficiency")
- Current selection highlighted
- Saves to `team.coaching.offensiveScheme`

**C. Defensive Scheme**
- Radio/card selector for the 7 defensive schemes: Man-to-Man, Switching, Drop Coverage, Blitz, Zone 2-3, Zone 3-2, Pack the Paint
- Brief description of effects
- Saves to `team.coaching.defensiveScheme`

**D. Play Style**
- Pace slider (0-100): "Slow" to "Fast" — affects possessions per game
- 3PT Emphasis slider (0-100): "Traditional" to "3PT Heavy" — affects team 3PA rate
- Saves to `team.coaching.pacePreference` and `team.coaching.threePointEmphasis`

**Saving:** Changes should save immediately to IndexedDB via `db.teams.put(team)`. Show a brief "Saved" toast/confirmation.

**Add route and nav:**
- Add `{ path: 'coaching', label: 'Coaching' }` to `LEAGUE_LINKS` in `frontend/src/components/layout/LeagueNavbar.tsx` (after 'Staff')
- Add `<Route path="coaching" element={<CoachingPage />} />` to `frontend/src/App.tsx`
- Import `CoachingPage` in App.tsx

**Wire minutes into quickSimGame:**
In `generateMinutes()`, accept an optional `rotationMinutes: Record<string, number>` parameter. If provided and the "Let Coach Decide" toggle is OFF, use the user-set minutes instead of auto-generating from skill ranking. Normalize to 240 total. The coaching page should set a `manualRotation: boolean` flag on CoachingStaff (add to the type if needed).

### Task 4: Verify & Tune Realism

After Tasks 1-3, verify realism by:

1. Create a new test league (or use an existing one)
2. Sim an entire season (82 games)
3. Check league leaders: the top scorer should be ~28-33 PPG, not 7 PPG
4. Check that star players (high skill ratings) dominate stats and bench players have low stats
5. Check awards: MVP should go to the best-performing player based on simulated stats, not stale import data
6. If stats are unrealistic, tune the coefficients in `simulatePlayerStats` and `teamStrength`

**Stat realism checklist:**
- [ ] League scoring leader: 28-33 PPG
- [ ] League assists leader: 9-12 APG
- [ ] League rebounding leader: 11-14 RPG
- [ ] Average team score: 108-114 PPG
- [ ] Star players average 25+ PPG
- [ ] Role players average 8-14 PPG
- [ ] Bench players average 2-8 PPG
- [ ] FG% league average: 46-48%
- [ ] 3PT% league average: 35-37%
- [ ] FT% league average: 77-80%

If any of these are off, adjust the simulation coefficients. The most common issue will be stats being too compressed (everyone averaging similar numbers) — make sure `usageDesire` and skill ratings create sufficient spread.

---

## File Modification Rules

- **DO modify:** `frontend/src/utils/quick-sim.ts`, `frontend/src/hooks/useLeague.tsx`, `frontend/src/types/team.ts`
- **DO create:** `frontend/src/utils/stat-accumulator.ts`, `frontend/src/pages/league/CoachingPage.tsx`
- **DO modify routing:** `frontend/src/App.tsx`, `frontend/src/components/layout/LeagueNavbar.tsx`
- **DO NOT modify** the awards engine, trade value engine, narrative engine, or other stat CONSUMERS — they already read `careerStats[last]` correctly. Once stat accumulation works, they'll automatically show correct simulated data.
- **DO NOT modify** `frontend/src/db/league-db.ts` unless adding new fields to existing types
- Run `cd frontend && npx tsc --noEmit` after each task to verify zero type errors before committing
- Never reference Claude, AI, or any AI assistant in commit messages
- Write commit messages in the developer's voice
- Keep commits descriptive about what was built

## Existing PlayerRatings Fields (for reference)

These are the individual skills available on every player — USE THESE instead of `overall`:

```
finishing, closeRange, midRange, threePoint, freeThrow, postGame, drawFoul,
offBallMovement, ballHandling, passingVision, passingAccuracy,
perimeterDefense, interiorDefense, shotBlocking, stealing, defensiveIq, defensiveConsistency,
speed, acceleration, lateralQuickness, vertical, strength, stamina,
basketballIq, offensiveIq, rebounding, offensiveRebounding, hustle,
intangibles, overall (COSMETIC ONLY — never use for sim), potential, peakAge
```

## Existing PlayerTendencies Fields (for reference)

```
pullUpFrequency, catchAndShootFrequency, driveFrequency, postUpFrequency, isoFrequency,
pickAndRollBallHandler, pickAndRollScreener, spotUpFrequency, transitionFrequency, cutFrequency,
passOutOfDriveRate, skipPassRate, alleyOopPassRate,
gambleForSteals, helpDefenseRate, closeoutAggression, boxOutRate,
usageDesire, pacePreference, foulProneness, shotClockTendency, contestedShotWillingness
```
