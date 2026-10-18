import { useEffect, useState } from 'react'
import { MUSCLES, INERT, MUSCLE_NAME, levelsOf } from '../lib/muscles.js'
import { t } from '../lib/i18n.js'

// Front and back views of a body, each muscle shaded by how hard it was worked.
//
// The five shade steps are the same ones the activity heatmap uses (.hm-c.l0…l4), so
// "more accent = more training" means one thing everywhere in the app rather than two.
//
// The geometry is ~90 KB and only some screens show a map, so it is fetched on first
// render instead of riding along in the main bundle. Until it lands the component
// renders nothing but keeps its height, so nothing below it jumps on arrival.

let CACHE = null                                  // shared across every mounted map
let PENDING = null

function useBodyPaths() {
  const [paths, setPaths] = useState(CACHE)
  useEffect(() => {
    if (CACHE) return
    let alive = true
    PENDING = PENDING || import('../lib/body-paths.js').then(m => (CACHE = m.default))
    PENDING.then(p => { if (alive) setPaths(p) }).catch(() => {})
    return () => { alive = false }
  }, [])
  return paths
}

function View({ view, label, levels, onMuscle, onHoverMuscle, selected }) {
  return (
    <div className="bm-col">
      {label && <div className="bm-label">{label}</div>}
      <svg className="bm-v" viewBox={view.vb} role="img" aria-label={label || 'Mapa Muscular'}>
        {INERT.map(slug => (view.p[slug] || []).map((d, i) =>
          <path key={slug + i} className="bm-sil" d={d} />))}
        {MUSCLES.map(slug => (view.p[slug] || []).map((d, i) => {
          const isSel = selected === slug
          return (
            <path
              key={slug + i}
              className={'bm-m l' + (levels[slug] || 0) + (isSel ? ' sel' : '')}
              d={d}
              tabIndex={onMuscle ? 0 : undefined}
              role={onMuscle ? 'button' : undefined}
              aria-label={t(MUSCLE_NAME[slug])}
              aria-pressed={isSel}
              onClick={onMuscle ? () => onMuscle(slug) : undefined}
              onKeyDown={onMuscle ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onMuscle(slug)
                }
              } : undefined}
              onMouseEnter={onHoverMuscle ? () => onHoverMuscle(slug) : undefined}
              onMouseLeave={onHoverMuscle ? () => onHoverMuscle(null) : undefined}
            >
              <title>{t(MUSCLE_NAME[slug])}</title>
            </path>
          )
        }))}
      </svg>
    </div>
  )
}

/**
 * <BodyMap load={{ chest: 12, … }} body="male" />
 * `load` is effective sets per muscle (see lib/muscles.js); shading is relative to
 * the hardest-worked muscle in that same load, so it always reads as a balance.
 */
export default function BodyMap({
  load = {},
  body = 'male',
  onMuscle,
  onHoverMuscle,
  selected,
  viewMode = 'both',
  showLabels = false,
  className = ''
}) {
  const paths = useBodyPaths()
  const levels = levelsOf(load)
  const g = paths && (paths[body] || paths.male)
  const showFront = viewMode === 'both' || viewMode === 'front'
  const showBack = viewMode === 'both' || viewMode === 'back'

  return (
    <div className={'bodymap ' + className + (viewMode !== 'both' ? ' bm-single' : '')}>
      {g ? <>
        {showFront && (
          <View
            view={g.front}
            label={showLabels ? t('Frente') : null}
            levels={levels}
            onMuscle={onMuscle}
            onHoverMuscle={onHoverMuscle}
            selected={selected}
          />
        )}
        {showBack && (
          <View
            view={g.back}
            label={showLabels ? t('Costas') : null}
            levels={levels}
            onMuscle={onMuscle}
            onHoverMuscle={onHoverMuscle}
            selected={selected}
          />
        )}
      </> : <div className="bm-ph" aria-hidden="true" />}
    </div>
  )
}

export function BodyMapLegend() {
  return <div className="hm-legend">
    {t('Less')} <div className="hm-c l0" /><div className="hm-c l1" /><div className="hm-c l2" />
    <div className="hm-c l3" /><div className="hm-c l4" /> {t('More')}
  </div>
}
