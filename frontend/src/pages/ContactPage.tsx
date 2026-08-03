import PageTransition from '../components/layout/PageTransition'

export default function ContactPage() {
  return (
    <PageTransition>
      <div className="max-w-2xl mx-auto">
        <h1 className="font-display text-5xl tracking-wide text-white mb-8">
          Contact
        </h1>

        <div className="panel p-8 mb-6">
          <h2 className="panel-title text-lg mb-3">Get in Touch</h2>
          <p className="text-slate-300 leading-relaxed text-sm mb-4">
            Found a bug, have a feature idea, or want to talk about how this was built?
            I read everything.
          </p>
          <a
            href="mailto:ryan@ryansinha.dev"
            className="btn-hud inline-block font-display tracking-widest text-base px-8 py-3 rounded-lg"
          >
            RYAN@RYANSINHA.DEV
          </a>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div className="panel p-6">
            <h3 className="panel-title text-sm mb-2">Bugs & Feedback</h3>
            <p className="text-slate-400 text-[13px] leading-relaxed">
              Include what you were doing when it happened and, if possible, an exported
              save file — it makes tracking things down far easier.
            </p>
          </div>
          <div className="panel p-6">
            <h3 className="panel-title text-sm mb-2">More of My Work</h3>
            <p className="text-slate-400 text-[13px] leading-relaxed">
              BBAL Sim is one project of several — the rest live at{' '}
              <a href="https://ryansinha.dev" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                ryansinha.dev
              </a>.
            </p>
          </div>
        </div>

        <div className="panel-glow p-6">
          <h3 className="panel-title text-sm mb-2">Rights Holders</h3>
          <p className="text-slate-400 text-[13px] leading-relaxed">
            BBAL Sim is a free, non-commercial fan project. If you represent a rights
            holder and have concerns about any content, email{' '}
            <a href="mailto:ryan@ryansinha.dev" className="text-accent hover:underline">ryan@ryansinha.dev</a>{' '}
            with the subject line <span className="text-slate-200">"Content Removal Request"</span> and
            the material in question will be reviewed and removed promptly.
          </p>
        </div>
      </div>
    </PageTransition>
  )
}
