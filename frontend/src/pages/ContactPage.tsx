import PageTransition from '../components/layout/PageTransition'

export default function ContactPage() {
  return (
    <PageTransition>
      <div className="max-w-2xl mx-auto">
        <h1 className="font-display text-5xl tracking-wide text-white mb-6">
          Contact
        </h1>
        <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl p-8 space-y-4">
          <p className="text-gray-300 leading-relaxed">
            Have feedback or found a bug? Reach out.
          </p>
          <a
            href="mailto:sinha.ry@northeastern.edu"
            className="inline-block text-accent hover:underline text-sm"
          >
            sinha.ry@northeastern.edu
          </a>
        </div>
      </div>
    </PageTransition>
  )
}
