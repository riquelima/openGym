import { useState, useEffect, useMemo } from 'react'
import BodyMap, { BodyMapLegend } from './BodyMap.jsx'
import Icon from './Icon.jsx'
import { loadOfWorkouts, MUSCLE_NAME } from '../lib/muscles.js'
import { t } from '../lib/i18n.js'
import { haptic } from '../lib/haptics.js'

// Quick chips for major muscle regions
export const QUICK_MUSCLE_GROUPS = [
  { slug: 'chest', label: 'Peito' },
  { slug: 'upper-back', label: 'Costas' },
  { slug: 'deltoids', label: 'Ombros' },
  { slug: 'biceps', label: 'Bíceps' },
  { slug: 'triceps', label: 'Tríceps' },
  { slug: 'abs', label: 'Abdômen' },
  { slug: 'quadriceps', label: 'Quadríceps' },
  { slug: 'gluteal', label: 'Glúteos' },
  { slug: 'hamstring', label: 'Posteriores' },
  { slug: 'calves', label: 'Panturrilhas' },
  { slug: 'forearm', label: 'Antebraços' },
  { slug: 'lower-back', label: 'Lombar' },
  { slug: 'trapezius', label: 'Trapézio' },
]

export default function BodyExplorer({ S, selected, onSelectMuscle, matchingCount }) {
  const [hoverMuscle, setHoverMuscle] = useState(null)
  const [activeBody, setActiveBody] = useState(S?.body || 'male')
  const [viewMode, setViewMode] = useState('both') // 'both' | 'front' | 'back'

  useEffect(() => {
    if (S?.body && S.body !== activeBody) {
      setActiveBody(S.body)
    }
  }, [S?.body])

  const load = useMemo(() => (S?.workouts ? loadOfWorkouts(S.workouts) : {}), [S?.workouts])

  const handleSelect = slug => {
    haptic('selection')
    if (onSelectMuscle) {
      onSelectMuscle(slug)
    }
  }

  const currentMuscleName = selected
    ? t(MUSCLE_NAME[selected] || selected)
    : hoverMuscle
    ? t(MUSCLE_NAME[hoverMuscle] || hoverMuscle)
    : null

  return (
    <div className="card bex-card" id="interactive-body-explorer" style={{ marginBottom: 14 }}>
      {/* Header with Title, Subtitle and Controls */}
      <div className="row between" style={{ alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
        <div className="row" style={{ gap: 8, alignItems: 'center' }}>
          <div className="bex-title-badge"><Icon name="target" /></div>
          <div>
            <h2 style={{ margin: 0, fontSize: 16, lineHeight: 1.2 }}>{t('Interactive Skeleton')}</h2>
            <div className="sub small dim" style={{ fontSize: 12, marginTop: 1 }}>
              {t('Tap a muscle to explore exercises')}
            </div>
          </div>
        </div>

        {/* View and Gender Controls */}
        <div className="row" style={{ gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Gender toggle */}
          <div className="bex-view-selector" role="group" aria-label="Gênero">
            <button
              type="button"
              className={'bex-view-btn' + (activeBody === 'male' ? ' on' : '')}
              onClick={() => { haptic('light'); setActiveBody('male') }}
              title="Modelo Masculino"
            >
              {t('Male')}
            </button>
            <button
              type="button"
              className={'bex-view-btn' + (activeBody === 'female' ? ' on' : '')}
              onClick={() => { haptic('light'); setActiveBody('female') }}
              title="Modelo Feminino"
            >
              {t('Female')}
            </button>
          </div>

          {/* View toggle (Front / Back / Both) */}
          <div className="bex-view-selector" role="group" aria-label="Visualização">
            <button
              type="button"
              className={'bex-view-btn' + (viewMode === 'both' ? ' on' : '')}
              onClick={() => { haptic('light'); setViewMode('both') }}
            >
              {t('Both')}
            </button>
            <button
              type="button"
              className={'bex-view-btn' + (viewMode === 'front' ? ' on' : '')}
              onClick={() => { haptic('light'); setViewMode('front') }}
            >
              {t('Front')}
            </button>
            <button
              type="button"
              className={'bex-view-btn' + (viewMode === 'back' ? ' on' : '')}
              onClick={() => { haptic('light'); setViewMode('back') }}
            >
              {t('Back')}
            </button>
          </div>

          {selected && (
            <button
              type="button"
              className="bex-view-btn"
              style={{ color: 'var(--red)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}
              onClick={() => handleSelect(selected)}
            >
              <Icon name="x" style={{ width: 12, height: 12 }} />
              {t('Clear')}
            </button>
          )}
        </div>
      </div>

      {/* Interactive Anatomical Skeleton Model */}
      <div className="bex-skeleton-section">
        {/* Active muscle hover/selected pill */}
        <div className="bex-active-pill">
          {currentMuscleName ? (
            <span className="bex-active-pill-tag">
              <span className="dot" />
              <b>{currentMuscleName}</b>
              {selected && typeof matchingCount === 'number' && (
                <span className="dim" style={{ marginLeft: 6, fontSize: 12 }}>
                  · {matchingCount} {t('exercises').toLowerCase()}
                </span>
              )}
            </span>
          ) : (
            <span className="bex-active-pill-hint">
              <Icon name="sparkles" />
              <span>{t('Tap a muscle to dig in')}</span>
            </span>
          )}
        </div>

        {/* Vector SVG Body Model */}
        <div className="bex-map-container">
          <BodyMap
            load={load}
            body={activeBody}
            selected={selected}
            onMuscle={handleSelect}
            onHoverMuscle={setHoverMuscle}
            viewMode={viewMode}
            showLabels={true}
            className="tappable"
          />
        </div>

        {/* Legend when user has workout volume */}
        {S?.workouts && S.workouts.length > 0 && <BodyMapLegend />}

        {/* Muscle Quick-Chips for instant tap access */}
        <div className="bex-quickchips-wrapper">
          <div className="bex-quickchips-scroll">
            <button
              type="button"
              className={'bex-qchip nocap' + (!selected ? ' on' : '')}
              onClick={() => handleSelect(selected)}
            >
              {t('All')}
            </button>
            {QUICK_MUSCLE_GROUPS.map(({ slug, label }) => {
              const isSelected = selected === slug
              return (
                <button
                  type="button"
                  key={slug}
                  className={'bex-qchip' + (isSelected ? ' on' : '')}
                  onClick={() => handleSelect(slug)}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
