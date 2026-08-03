import type { Reporter, ReporterType, ReporterPersonality } from '../../types'
import type { Team } from '../../types'

// ── Seeded PRNG (mulberry32) ────────────────────────────────────

function hashString(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  }
  return h >>> 0
}

function mulberry32(seed: number) {
  let s = seed | 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type RNG = () => number

function randInt(rng: RNG, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min
}

function randFloat(rng: RNG, min: number, max: number): number {
  return rng() * (max - min) + min
}

function pick<T>(rng: RNG, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)]
}

// ── Name pools ──────────────────────────────────────────────────

const FIRST_NAMES = [
  'Adrian', 'Brian', 'Chris', 'David', 'Eric', 'Frank', 'Greg', 'Howard',
  'Ian', 'Jason', 'Kevin', 'Larry', 'Mark', 'Nick', 'Omar', 'Paul',
  'Quinn', 'Ray', 'Sam', 'Tim', 'Victor', 'Wayne', 'Xavier', 'Zach',
  'Alex', 'Ben', 'Carlos', 'Dan', 'Eli', 'Felix', 'Gene', 'Hank',
  'James', 'Keith', 'Leo', 'Matt', 'Nate', 'Oscar', 'Pete', 'Rob',
  'Sarah', 'Tina', 'Ursula', 'Valerie', 'Wendy', 'Yvonne', 'Zoe',
  'Amy', 'Beth', 'Claire', 'Diana', 'Elena', 'Fiona', 'Grace', 'Holly',
  'Iris', 'Julia', 'Karen', 'Lisa', 'Megan', 'Nancy', 'Olivia', 'Patricia',
  'Rachel', 'Steph', 'Tracy', 'Uma', 'Veronica', 'Whitney', 'Ximena',
  'Aaliyah', 'Brianna', 'Carmen', 'Destiny', 'Eve', 'Faith', 'Gina', 'Hope',
  'Jade', 'Kim', 'Layla', 'Maya', 'Nia', 'Priya', 'Rosa', 'Suki',
  'Tara', 'Una', 'Viola', 'Willow', 'Xena', 'Yara', 'Zelda', 'Andre',
  'Blake', 'Corey', 'Derek', 'Ethan',
]

const LAST_NAMES = [
  'Anderson', 'Brooks', 'Carter', 'Davis', 'Edwards', 'Foster', 'Garcia',
  'Harris', 'Irving', 'Jackson', 'King', 'Lewis', 'Mitchell', 'Nelson',
  'Ortiz', 'Parker', 'Quinn', 'Robinson', 'Smith', 'Thompson', 'Walker',
  'Young', 'Zimmerman', 'Allen', 'Baker', 'Clark', 'Diaz', 'Evans',
  'Fisher', 'Green', 'Hall', 'James', 'Kelly', 'Lee', 'Martin', 'Nguyen',
  'Owens', 'Patel', 'Reed', 'Scott', 'Turner', 'Vance', 'Williams',
  'Chang', 'Dubois', 'Fernandez', 'Gonzalez', 'Hernandez', 'Jensen',
  'Khan', 'Lopez', 'Morales', 'Nakamura', 'Okafor', 'Perez', 'Ramirez',
  'Sullivan', 'Torres', 'Webb', 'Xavier', 'Yates', 'Zhou', 'Burke',
  'Coleman', 'Dixon', 'Fox', 'Grant', 'Hughes', 'Jordan', 'Kerr',
  'Lambert', 'Mills', 'Norris', 'Palmer', 'Rogers', 'Shaw', 'Taylor',
  'Underwood', 'Vargas', 'Warren', 'York', 'Adams', 'Bell', 'Cross',
  'Drake', 'Flynn', 'Gordon', 'Hayes', 'Ingram', 'Jones', 'Knight',
  'Lane', 'Monroe', 'Nash', 'Oliver', 'Powell', 'Rhodes', 'Stone',
  'Tate', 'Valentine', 'West',
]

const NATIONAL_OUTLETS = [
  'The Hardwood Ledger', 'Courtside Report', 'Full Court Press',
  'The Fadeaway', 'Baseline Weekly', 'Hoop Digest',
  'The Fast Break', 'Fourth Quarter Media', 'Pivot Sports',
  'The Rotation', 'Glass Cleaners Journal', 'Backcourt Bulletin',
]

const ANALYTICS_OUTLETS = [
  'The Numbers Game', 'Efficiency Report', 'Shot Quality Quarterly',
  'Pace & Space Analytics', 'Expected Value Sports', 'The Model Room',
]

const TV_NETWORKS = [
  'Courtside Network', 'Prime Hoops TV', 'The Basketball Channel',
  'National Sports One', 'Hardwood Broadcasting', 'Overtime Network',
]

function getBeatOutlet(rng: RNG, teamCity: string): string {
  const suffixes = ['Times', 'Tribune', 'Herald', 'Post', 'Chronicle', 'Daily', 'Gazette', 'Sun']
  return `${teamCity} ${pick(rng, suffixes)}`
}

// ── Reporter Generation ─────────────────────────────────────────

function generatePersonality(rng: RNG, type: ReporterType): ReporterPersonality {
  const base = (): ReporterPersonality => ({
    statsFocus: randFloat(rng, 0.2, 0.8),
    efficiencyFocus: randFloat(rng, 0.1, 0.7),
    narrativeWeight: randFloat(rng, 0.1, 0.6),
    teamSuccessWeight: randFloat(rng, 0.2, 0.7),
    teamBias: 0,
    bigMarketBias: randFloat(rng, 0, 0.3),
    recencyBias: randFloat(rng, 0.1, 0.5),
    nameRecognitionBias: randFloat(rng, 0.05, 0.3),
    mediaPersonalityBonus: randFloat(rng, 0, 0.15),
  })

  const p = base()

  switch (type) {
    case 'national_writer':
      p.narrativeWeight = randFloat(rng, 0.2, 0.7)
      p.teamSuccessWeight = randFloat(rng, 0.3, 0.8)
      break
    case 'beat_writer':
      p.teamBias = randFloat(rng, 0.3, 0.7)
      p.narrativeWeight = randFloat(rng, 0.3, 0.8)
      p.bigMarketBias = randFloat(rng, 0, 0.15)
      break
    case 'tv_analyst':
      p.nameRecognitionBias = randFloat(rng, 0.15, 0.4)
      p.mediaPersonalityBonus = randFloat(rng, 0.1, 0.25)
      p.efficiencyFocus = randFloat(rng, 0.05, 0.4)
      break
    case 'analytics_writer':
      p.statsFocus = randFloat(rng, 0.5, 0.95)
      p.efficiencyFocus = randFloat(rng, 0.5, 0.95)
      p.narrativeWeight = randFloat(rng, 0, 0.2)
      p.nameRecognitionBias = randFloat(rng, 0, 0.1)
      p.bigMarketBias = randFloat(rng, 0, 0.1)
      break
  }

  return p
}

export function generateReporters(leagueId: string, seasonYear: number, teams: Team[]): Reporter[] {
  const rng = mulberry32(hashString(`${leagueId}-reporters-${seasonYear}`))
  const reporters: Reporter[] = []
  const usedNames = new Set<string>()

  function uniqueName(): { first: string; last: string } {
    for (let attempts = 0; attempts < 100; attempts++) {
      const first = pick(rng, FIRST_NAMES)
      const last = pick(rng, LAST_NAMES)
      const key = `${first} ${last}`
      if (!usedNames.has(key)) {
        usedNames.add(key)
        return { first, last }
      }
    }
    const fallback = `Reporter${reporters.length}`
    return { first: fallback, last: '' }
  }

  function makeReporter(type: ReporterType, outlet: string, beatTeamId: string | null): Reporter {
    const { first, last } = uniqueName()
    return {
      id: `reporter-${reporters.length}`,
      firstName: first,
      lastName: last,
      type,
      outlet,
      beatTeamId,
      personality: generatePersonality(rng, type),
      yearsExperience: randInt(rng, 2, 30),
      seed: Math.floor(rng() * 1_000_000),
    }
  }

  for (const team of teams) {
    const r = makeReporter('beat_writer', getBeatOutlet(rng, team.info.city), team.id)
    reporters.push(r)
  }

  for (let i = 0; i < 40; i++) {
    reporters.push(makeReporter('national_writer', pick(rng, NATIONAL_OUTLETS), null))
  }

  for (let i = 0; i < 15; i++) {
    reporters.push(makeReporter('tv_analyst', pick(rng, TV_NETWORKS), null))
  }

  for (let i = 0; i < 15; i++) {
    reporters.push(makeReporter('analytics_writer', pick(rng, ANALYTICS_OUTLETS), null))
  }

  return reporters
}
