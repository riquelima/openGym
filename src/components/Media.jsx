import { useState, useRef, useEffect } from 'react'
import { imgSrc, gifSrc, videoSrc } from '../lib/exercises.js'
import { useStore } from '../store/useStore.js'
import { t } from '../lib/i18n.js'
import Icon from './Icon.jsx'
import { haptic } from '../lib/haptics.js'

// Displays exercise demonstration media:
// 1. HD MP4 Video (ExerciseDB V2) with loop, autoplay, muted, tap-to-pause/play
// 2. GIF Animation (legacy catalogue)
// 3. High-res still frame fallback
export default function Media({ ex, id, compact, minimizable }) {
  const [playing, setPlaying] = useState(true)
  const [videoError, setVideoError] = useState(false)
  const [imgError, setImgError] = useState(false)
  const videoRef = useRef(null)
  const gifSize = useStore(s => s.S.gifSize)
  const update = useStore(s => s.update)

  const video = videoSrc(ex)
  const hasVideo = !!video && !videoError
  const poster = imgSrc(ex)
  const animSrc = gifSrc(ex)
  const displayImg = playing ? (animSrc || poster) : poster

  const mini = minimizable && gifSize === 'mini'
  const toggleSize = e => {
    e.stopPropagation()
    haptic('light')
    update(s => { s.gifSize = mini ? 'full' : 'mini' })
  }

  const togglePlayback = () => {
    haptic('selection')
    if (hasVideo && videoRef.current) {
      if (playing) {
        videoRef.current.pause()
        setPlaying(false)
      } else {
        videoRef.current.play()
        setPlaying(true)
      }
    } else {
      setPlaying(p => !p)
    }
  }

  return (
    <div
      className={'exmedia' + (compact ? ' compact' : '') + (mini ? ' mini' : '') + (hasVideo ? ' has-video' : '')}
      id={id}
      onClick={togglePlayback}
    >
      {hasVideo ? (
        <video
          ref={videoRef}
          src={video}
          poster={poster || undefined}
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
          className="explayer"
          onError={() => setVideoError(true)}
        />
      ) : (!imgError && displayImg) ? (
        <img
          decoding="async"
          src={displayImg}
          alt={ex.n}
          onError={() => {
            // If animSrc failed and was different from poster, try static poster before giving up
            if (displayImg !== poster && poster) {
              // fallback to static image
            }
            setImgError(true)
          }}
        />
      ) : (
        <div className="media-placeholder">
          <div className="media-placeholder-icon">
            <Icon name="dumbbell" />
          </div>
          <div className="media-placeholder-title capitalize">{ex.n}</div>
          <div className="media-placeholder-sub capitalize">{t(ex.tg || ex.bp)} · {t(ex.eq)}</div>
        </div>
      )}

      {minimizable && (
        <button className="giftoggle" onClick={toggleSize}>
          <Icon name={mini ? 'expand' : 'minimize'} />
          {mini ? t('Expand') : t('Minimize')}
        </button>
      )}

      {!mini && (hasVideo || (!imgError && animSrc)) && (
        <span className="gifhint">
          <Icon name={playing ? 'pause' : 'play'} />
          {playing ? t('tap to pause') : t('tap to play')}
        </span>
      )}
    </div>
  )
}

export function Thumb({ ex }) {
  const [err, setErr] = useState(false)
  const src = imgSrc(ex)
  const hasVid = !!ex?.video || !!ex?.videoUrl

  if (err || (!src && !ex?.img && !ex?.imageUrl)) {
    return (
      <div className="thumb thumb-x">
        <Icon name={hasVid ? 'video' : 'dumbbell'} />
      </div>
    )
  }

  return (
    <div className="thumb-wrap" style={{ position: 'relative', display: 'inline-block' }}>
      <img
        className="thumb"
        loading="lazy"
        decoding="async"
        src={src}
        alt=""
        onError={() => setErr(true)}
      />
      {hasVid && (
        <span className="thumb-vid-badge" title="Vídeo disponível">
          <Icon name="video" style={{ fontSize: 9 }} />
        </span>
      )}
    </div>
  )
}
