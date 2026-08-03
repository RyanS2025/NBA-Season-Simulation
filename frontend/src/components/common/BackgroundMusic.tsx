import { useState, useEffect } from 'react'

const TRACKS = ['/music/BBALSIMTHEME1.m4a', '/music/BBALSIMTHEME2.m4a']
const GAP_MS = 1000

let audio: HTMLAudioElement | null = null
let currentTrack = 0
let gapTimer: ReturnType<typeof setTimeout> | null = null
let initialized = false

function playTrack(index: number) {
  if (!audio) return
  if (gapTimer) {
    clearTimeout(gapTimer)
    gapTimer = null
  }
  currentTrack = index
  audio.src = TRACKS[index]
  audio.play().catch(() => {})
}

function queueNextTrack() {
  if (gapTimer) clearTimeout(gapTimer)
  gapTimer = setTimeout(() => {
    gapTimer = null
    playTrack((currentTrack + 1) % TRACKS.length)
  }, GAP_MS)
}

function getAudio(): HTMLAudioElement {
  if (!audio) {
    audio = new Audio()
    audio.volume = 1.0
    audio.preload = 'auto'
    audio.addEventListener('ended', queueNextTrack)
    // If a track stalls or errors out mid-play, move on rather than dying
    audio.addEventListener('error', queueNextTrack)
    audio.src = TRACKS[0]
  }
  return audio
}

/** Resume playback safely: a finished track advances instead of re-firing 'ended'. */
function resume() {
  const el = getAudio()
  el.muted = false
  if (el.ended) {
    playTrack((currentTrack + 1) % TRACKS.length)
  } else if (!gapTimer) {
    el.play().catch(() => {})
  }
}

function tryAutoplay() {
  if (initialized) return
  const saved = localStorage.getItem('bbalsim-muted')
  if (saved === 'true') {
    initialized = true
    return
  }

  const el = getAudio()

  // Trick: start muted (browsers allow this), then unmute after a frame
  el.muted = true
  el.play().then(() => {
    initialized = true
    requestAnimationFrame(() => {
      el.muted = false
      el.volume = 1.0
    })
  }).catch(() => {
    // Browser fully blocked it — fall back to interaction listener
    el.muted = false
  })
}

export default function BackgroundMusic() {
  const [paused, setPaused] = useState(() => {
    return localStorage.getItem('bbalsim-muted') === 'true'
  })

  useEffect(() => {
    tryAutoplay()

    if (initialized) return

    const kick = () => {
      if (initialized) return
      initialized = true
      const saved = localStorage.getItem('bbalsim-muted')
      if (saved !== 'true') {
        resume()
      }
      cleanup()
    }

    const cleanup = () => {
      document.removeEventListener('click', kick, true)
      document.removeEventListener('keydown', kick, true)
      document.removeEventListener('touchstart', kick, true)
      document.removeEventListener('scroll', kick, true)
    }

    document.addEventListener('click', kick, true)
    document.addEventListener('keydown', kick, true)
    document.addEventListener('touchstart', kick, true)
    document.addEventListener('scroll', kick, true)

    return cleanup
  }, [])

  useEffect(() => {
    const el = getAudio()
    if (paused) {
      if (gapTimer) {
        clearTimeout(gapTimer)
        gapTimer = null
      }
      el.pause()
    } else if (initialized) {
      resume()
    }
    localStorage.setItem('bbalsim-muted', String(paused))
  }, [paused])

  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        setPaused(p => !p)
      }}
      className="text-gray-500 hover:text-white transition-colors"
      aria-label={paused ? 'Unmute' : 'Mute'}
      title={paused ? 'Unmute' : 'Mute'}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {paused ? (
          <>
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <line x1="23" y1="9" x2="17" y2="15" />
            <line x1="17" y1="9" x2="23" y2="15" />
          </>
        ) : (
          <>
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
          </>
        )}
      </svg>
    </button>
  )
}
