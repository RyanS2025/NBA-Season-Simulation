import PageTransition from '../components/layout/PageTransition'

const FEATURES = [
  'A 30-team league of fictional franchises with a full 82-game schedule, play-in tournament, and best-of-seven playoffs',
  'Skill-based game simulation — outcomes come from individual skillsets, coaching schemes, tendencies, and matchups, never a single overall number',
  'Player morale, hot and cold streaks, trade demands, and holdouts that force your hand',
  'A full injury engine, from day-to-day knocks to career-altering tears with permanent effects',
  'Awards voted by a 100-member media panel with beat-writer bias, narratives, and full ballot transparency',
  'Contract extensions with a real deadline, player options, and CPU front offices that lock up their own stars',
  'A draft with a weighted lottery, scouting reports, and pick-by-pick control',
  'Coaching management: rotations and minutes, offensive and defensive schemes, pace, and injury philosophy',
  'League history that accumulates — records book, retired players, and a Hall of Fame',
]

export default function AboutPage() {
  return (
    <PageTransition>
      <div className="max-w-3xl mx-auto">
        <h1 className="font-display text-5xl tracking-wide text-white mb-8">
          About <span className="text-gradient">BBAL Sim</span>
        </h1>

        <div className="panel p-8 mb-6">
          <h2 className="panel-title text-lg mb-3">What is this?</h2>
          <p className="text-slate-300 leading-relaxed mb-3">
            BBAL Sim is a basketball general manager simulator that runs entirely in your
            browser. Take over a franchise, build through the draft or trade for stars,
            manage egos and injuries, and chase championships across as many seasons as
            you can stomach.
          </p>
          <p className="text-slate-400 leading-relaxed text-sm">
            It's a solo-developed portfolio project by{' '}
            <a href="https://ryansinha.dev" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
              Ryan Sinha
            </a>{' '}
            — free to play, no ads, no monetization of any kind.
          </p>
        </div>

        <div className="panel p-8 mb-6">
          <h2 className="panel-title text-lg mb-4">Features</h2>
          <ul className="space-y-2.5">
            {FEATURES.map(f => (
              <li key={f} className="flex gap-3 text-sm text-slate-300 leading-relaxed">
                <span className="text-accent shrink-0 mt-0.5">▸</span>
                {f}
              </li>
            ))}
          </ul>
        </div>

        <div className="panel p-8 mb-6">
          <h2 className="panel-title text-lg mb-3">Your Data & Privacy</h2>
          <p className="text-slate-300 leading-relaxed text-sm mb-2">
            There are no accounts, no sign-ups, and no server. Every league you create is
            stored locally in your browser (IndexedDB) and never leaves your device. You
            can export any league to a file and import it on another machine.
          </p>
          <p className="text-slate-400 leading-relaxed text-sm">
            BBAL Sim collects no personal information and uses no analytics or tracking.
          </p>
        </div>

        <div className="panel p-8 mb-6">
          <h2 className="panel-title text-lg mb-3">Built With</h2>
          <p className="text-slate-300 leading-relaxed text-sm">
            React, TypeScript, Tailwind CSS, and Dexie.js (IndexedDB), bundled with Vite.
            The entire simulation — game engine, trade AI, media voting, injury system —
            runs client-side.
          </p>
        </div>

        <div className="panel-glow p-8">
          <h2 className="panel-title text-lg mb-3">Legal Disclaimer</h2>
          <div className="space-y-3 text-[13px] text-slate-400 leading-relaxed">
            <p>
              BBAL Sim is an unofficial, non-commercial fan project created for educational
              and portfolio purposes. It is <span className="text-slate-200">not affiliated with, endorsed by, sponsored by,
              or connected to the National Basketball Association (NBA), the National
              Basketball Players Association (NBPA), any NBA team, or any of their
              affiliates</span>. All team names, cities, and branding within the game are fictional.
            </p>
            <p>
              Real player names and publicly available statistical information are used
              solely for realistic simulation, consistent with U.S. case law holding that
              athlete names and statistics are publicly available facts (C.B.C.
              Distribution v. MLB Advanced Media, 8th Cir. 2007; Daniels v. FanDuel,
              Ind. 2018). No player photographs or likenesses are displayed anywhere in
              the game — players are represented by generated initials avatars. No claim
              of ownership is made over any player's name or over any third-party
              trademark referenced descriptively.
            </p>
            <p>
              This project generates no revenue of any kind — no sales, no advertising,
              no sponsorship, no data collection.
            </p>
            <p>
              If you are a rights holder and believe any content in this project
              infringes your rights, contact{' '}
              <a href="mailto:ryan@ryansinha.dev" className="text-accent hover:underline">ryan@ryansinha.dev</a>{' '}
              and the material will be reviewed and removed promptly.
            </p>
          </div>
        </div>
      </div>
    </PageTransition>
  )
}
