import { useMemo, useState, useEffect, useRef } from 'react'
import BodyMap, { BodyMapLegend } from './BodyMap.jsx'
import { Thumb } from './Media.jsx'
import Icon from './Icon.jsx'
import FitnessIcon, { bodyPartIconSlug, equipmentIconSlug } from './fitness-icons/index.jsx'
import { Button } from './ui.jsx'
import { EXIDX, allExercises, isGymEquipment, isGymMachine } from '../lib/exercises.js'
import { loadOfWorkouts, rankOf, MUSCLE_NAME, MUSCLES, musclesOf } from '../lib/muscles.js'
import { fmtDate, fmtNum } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import { exerciseDetailSheet, addToRoutineSheet, workoutDetailSheet } from '../sheets.jsx'
import { haptic } from '../lib/haptics.js'

// Quick chips for major muscle regions
const QUICK_MUSCLE_GROUPS = [
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

function bestSetLabel(entry, ex) {
  const sets = (entry.sets || []).filter(s => s.done)
  if (!sets.length) return t('planned')
  const cardio = ex?.bp === 'cardio'
  const timed = ex?.bp === 'waist' && entry.target?.mode === 'time'
  if (cardio) {
    const best = Math.max(...sets.map(s => s.speed || 0))
    return best ? best.toFixed(1) + ' km/h' : t('logged')
  }
  if (timed) {
    const best = Math.max(...sets.map(s => s.sec || 0))
    return best ? best + 's' : t('logged')
  }
  const best = Math.max(...sets.map(s => s.w || 0))
  return best ? best + ' kg' : t('logged')
}

// Recent workouts touching the selected muscle
function recentWorkoutsForMuscle(workouts, slug) {
  if (!workouts || !workouts.length || !slug) return []
  const matched = workouts
    .filter(w => (w.entries || []).some(e => {
      const ex = EXIDX[e.id]
      return ex && musclesOf(ex)[slug]
    }))
    .sort((a, b) => (b.start || 0) - (a.start || 0))
    .slice(0, 5)

  return matched.map(w => ({
    w,
    hits: (w.entries || []).filter(e => {
      const ex = EXIDX[e.id]
      return ex && musclesOf(ex)[slug]
    })
  }))
}

export default function BodyExplorer({ S }) {
  const [sel, setSel] = useState(null)
  const [hoverMuscle, setHoverMuscle] = useState(null)
  const [activeBody, setActiveBody] = useState(S?.body || 'male')
  const [viewMode, setViewMode] = useState('both') // 'both' | 'front' | 'back'
  const [shownCount, setShownCount] = useState(24)

  // Dynamic filter states
  const [searchQ, setSearchQ] = useState('')
  const [eqFilter, setEqFilter] = useState('all') // 'all' | 'gym' | specific equipment
  const [roleFilter, setRoleFilter] = useState('all') // 'all' | 'primary' | 'secondary'
  const [historyFilter, setHistoryFilter] = useState('all') // 'all' | 'trained' | 'media'
  const [sortBy, setSortBy] = useState('popular') // 'popular' | 'az' | 'trained'
  const [hasError, setHasError] = useState(false)

  const panelRef = useRef(null)

  // Keep body mode in sync if store changes
  useEffect(() => {
    if (S?.body && S.body !== activeBody) {
      setActiveBody(S.body)
    }
  }, [S?.body])

  // Reset pagination when muscle or filters change
  useEffect(() => {
    setShownCount(24)
  }, [sel, searchQ, eqFilter, roleFilter, historyFilter, sortBy])

  // Scroll smoothly to the panel when a muscle is selected
  const handleSelectMuscle = slug => {
    haptic('selection')
    setSel(prev => {
      const next = prev === slug ? null : slug
      if (next) {
        setTimeout(() => {
          panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        }, 80)
      }
      return next
    })
  }

  // Load calculation for shading
  const load = useMemo(() => loadOfWorkouts(S.workouts), [S.workouts])
  const { worked } = useMemo(() => rankOf(load), [load])

  // Map user workout history per exercise
  const userStats = useMemo(() => {
    const map = {}
    ;(S.workouts || []).forEach(w => {
      ;(w.entries || []).forEach(e => {
        const doneSets = (e.sets || []).filter(s => s.done)
        if (!doneSets.length) return
        const cur = map[e.id] || { sets: 0, sessions: 0, bestW: 0 }
        cur.sets += doneSets.length
        cur.sessions += 1
        const best = Math.max(0, ...doneSets.map(s => s.w || 0))
        if (best > cur.bestW) cur.bestW = best
        map[e.id] = cur
      })
    })
    return map
  }, [S.workouts])

  // Extract all exercises matching the selected muscle
  const allForMuscle = useMemo(() => {
    if (!sel) return []
    setHasError(false)
    try {
      const all = allExercises(S)
      const seen = new Set()
      const list = []

      for (const ex of all) {
        if (!ex || !ex.id || seen.has(ex.id)) continue
        const m = musclesOf(ex)
        const weight = m[sel]
        if (weight && weight > 0) {
          seen.add(ex.id)
          const st = userStats[ex.id]
          list.push({
            ex,
            weight,
            isPrimary: weight >= 0.75,
            userSets: st?.sets || 0,
            userSessions: st?.sessions || 0,
            userBestW: st?.bestW || 0,
          })
        }
      }
      return list
    } catch (err) {
      console.error('Error fetching exercises for muscle:', err)
      setHasError(true)
      return []
    }
  }, [sel, S.customEx, userStats])

  // Dynamic equipment options derived from exercises of the selected muscle
  const availableEquipments = useMemo(() => {
    if (!allForMuscle.length) return []
    const counts = {}
    allForMuscle.forEach(item => {
      const eq = item.ex.eq
      if (eq) {
        counts[eq] = (counts[eq] || 0) + 1
      }
    })
    return Object.keys(counts).sort((a, b) => counts[b] - counts[a])
  }, [allForMuscle])

  // Filter and sort exercises dynamically
  const filteredExercises = useMemo(() => {
    if (!allForMuscle.length) return []
    let list = [...allForMuscle]

    // 1. Text Search Filter
    if (searchQ.trim()) {
      const q = searchQ.trim().toLowerCase()
      list = list.filter(({ ex }) => {
        return (
          (ex.n && ex.n.toLowerCase().includes(q)) ||
          (ex.name && ex.name.toLowerCase().includes(q)) ||
          (ex.rawName && ex.rawName.toLowerCase().includes(q)) ||
          (Array.isArray(ex.keywords) && ex.keywords.some(k => k.toLowerCase().includes(q))) ||
          (ex.eq && ex.eq.toLowerCase().includes(q)) ||
          (ex.tg && ex.tg.toLowerCase().includes(q)) ||
          (ex.bp && ex.bp.toLowerCase().includes(q))
        )
      })
    }

    // 2. Equipment Filter
    if (eqFilter === 'gym') {
      list = list.filter(({ ex }) => isGymEquipment(ex.eq, ex) || isGymMachine(ex.eq))
    } else if (eqFilter !== 'all') {
      list = list.filter(({ ex }) => ex.eq && ex.eq.toLowerCase() === eqFilter.toLowerCase())
    }

    // 3. Role / Focus Filter
    if (roleFilter === 'primary') {
      list = list.filter(item => item.isPrimary)
    } else if (roleFilter === 'secondary') {
      list = list.filter(item => !item.isPrimary)
    }

    // 4. History / Media Filter
    if (historyFilter === 'trained') {
      list = list.filter(item => item.userSessions > 0)
    } else if (historyFilter === 'media') {
      list = list.filter(item => !!item.ex.video || !!item.ex.gif || !!item.ex.videoUrl || !!item.ex.gifUrl)
    }

    // 5. Sorting
    if (sortBy === 'az') {
      list.sort((a, b) => (a.ex.n || '').localeCompare(b.ex.n || '', 'pt-BR'))
    } else if (sortBy === 'trained') {
      list.sort((a, b) => b.userSets - a.userSets || b.userSessions - a.userSessions || (a.ex.n || '').localeCompare(b.ex.n || ''))
    } else {
      // Default: 'popular' -> trained first, then featured/with video, then primary target, then name
      list.sort((a, b) => {
        if (b.userSessions !== a.userSessions) return b.userSessions - a.userSessions
        const aHasMedia = a.ex.video || a.ex.gif ? 1 : 0
        const bHasMedia = b.ex.video || b.ex.gif ? 1 : 0
        if (bHasMedia !== aHasMedia) return bHasMedia - aHasMedia
        if (b.weight !== a.weight) return b.weight - a.weight
        return (a.ex.n || '').localeCompare(b.ex.n || '', 'pt-BR')
      })
    }

    return list
  }, [allForMuscle, searchQ, eqFilter, roleFilter, historyFilter, sortBy])

  // Workouts touching the selected muscle
  const recentWorkouts = useMemo(
    () => (sel ? recentWorkoutsForMuscle(S.workouts, sel) : []),
    [S.workouts, sel]
  )

  // Has active filters applied?
  const hasActiveFilters = searchQ.trim() !== '' || eqFilter !== 'all' || roleFilter !== 'all' || historyFilter !== 'all' || sortBy !== 'popular'

  const resetFilters = () => {
    haptic('light')
    setSearchQ('')
    setEqFilter('all')
    setRoleFilter('all')
    setHistoryFilter('all')
    setSortBy('popular')
  }

  // Active muscle display name
  const currentMuscleName = sel ? t(MUSCLE_NAME[sel] || sel) : (hoverMuscle ? t(MUSCLE_NAME[hoverMuscle] || hoverMuscle) : null)

  return (
    <div className="card bex-card" id="interactive-body-explorer">
      {/* Card Header & Controls */}
      <div className="row between" style={{ alignItems: 'flex-start', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div className="row" style={{ gap: 8, alignItems: 'center' }}>
            <div className="bex-title-badge"><Icon name="target" /></div>
            <h2 style={{ margin: 0 }}>{t('Interactive Skeleton')}</h2>
          </div>
          <div className="sub small dim" style={{ marginTop: 2 }}>
            {t('Tap a muscle to explore exercises')}
          </div>
        </div>

        {/* View and Gender Controls */}
        <div className="row" style={{ gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Gender toggle */}
          <div className="bex-view-selector" role="group" aria-label="Gênero">
            <button
              className={'bex-view-btn' + (activeBody === 'male' ? ' on' : '')}
              onClick={() => { haptic('light'); setActiveBody('male') }}
              title="Modelo Masculino"
            >
              {t('Male')}
            </button>
            <button
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
              className={'bex-view-btn' + (viewMode === 'both' ? ' on' : '')}
              onClick={() => { haptic('light'); setViewMode('both') }}
            >
              {t('Both')}
            </button>
            <button
              className={'bex-view-btn' + (viewMode === 'front' ? ' on' : '')}
              onClick={() => { haptic('light'); setViewMode('front') }}
            >
              {t('Front')}
            </button>
            <button
              className={'bex-view-btn' + (viewMode === 'back' ? ' on' : '')}
              onClick={() => { haptic('light'); setViewMode('back') }}
            >
              {t('Back')}
            </button>
          </div>

          {sel && (
            <Button
              size="sm"
              variant="ghost"
              icon="x"
              onClick={() => { haptic('light'); setSel(null) }}
            >
              {t('Clear')}
            </Button>
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
              {sel && (
                <span className="dim" style={{ marginLeft: 6, fontSize: 12 }}>
                  · {t('{0} exercises', allForMuscle.length)}
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
            selected={sel}
            onMuscle={handleSelectMuscle}
            onHoverMuscle={setHoverMuscle}
            viewMode={viewMode}
            showLabels={true}
            className="tappable"
          />
        </div>

        {/* Legend when user has workout volume */}
        {S.workouts.length > 0 && <BodyMapLegend />}

        {/* Muscle Quick-Chips for instant tap access */}
        <div className="bex-quickchips-wrapper">
          <div className="bex-quickchips-scroll">
            <button
              className={'bex-qchip nocap' + (!sel ? ' on' : '')}
              onClick={() => { haptic('light'); setSel(null) }}
            >
              {t('All')}
            </button>
            {QUICK_MUSCLE_GROUPS.map(({ slug, label }) => {
              const isSelected = sel === slug
              return (
                <button
                  key={slug}
                  className={'bex-qchip' + (isSelected ? ' on' : '')}
                  onClick={() => handleSelectMuscle(slug)}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* =========================================================================
          PAINEL IMEDIATAMENTE ABAIXO DO ESQUELETO
          Lista todos os exercícios do grupo muscular selecionado com filtros dinâmicos
          ========================================================================= */}
      <div className="bex-panel" ref={panelRef}>
        {!sel ? (
          /* Placeholder state when no muscle is selected */
          <div className="bex-empty-guide">
            <div className="bex-empty-guide-icon">
              <Icon name="target" />
            </div>
            <div className="bex-empty-guide-content">
              <h3>{t('Select a muscle on the skeleton above to explore exercises and dynamic filters.')}</h3>
              <p className="dim small">
                {t('Clique em qualquer região do corpo (frente ou costas) para listar todos os exercícios correspondentes, filtrar por equipamentos de academia e conferir demonstrações em vídeo.')}
              </p>
            </div>
          </div>
        ) : hasError ? (
          /* Error state */
          <div className="bex-error-card">
            <Icon name="alert" />
            <div>
              <div className="tt">{t('Failed to load exercises')}</div>
              <div className="ss dim">{t('Ocorreu um erro ao processar os dados deste músculo.')}</div>
            </div>
            <Button size="sm" onClick={() => setSel(s => s)}>{t('Retry')}</Button>
          </div>
        ) : (
          /* Active muscle exploration panel */
          <div className="bex-panel-active">
            {/* Panel Header */}
            <div className="bex-panel-header">
              <div className="bex-panel-title">
                <span className="bex-muscle-tag">{t(MUSCLE_NAME[sel] || sel)}</span>
                <span className="bex-stats-counter dim small">
                  {t('{0} exercises', allForMuscle.length)}
                  {recentWorkouts.length > 0 && ` · ${recentWorkouts.length} ${t('Recent workouts').toLowerCase()}`}
                </span>
              </div>
              <Button size="sm" variant="ghost" icon="x" onClick={() => setSel(null)}>
                {t('Clear')}
              </Button>
            </div>

            {/* Dynamic Filters Section */}
            <div className="bex-filters-box">
              {/* Search Bar */}
              <div className="bex-search-row">
                <div className="search bex-search">
                  <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
                  <input
                    className="input"
                    placeholder={t('Search exercises...')}
                    value={searchQ}
                    onChange={e => setSearchQ(e.target.value)}
                  />
                  {searchQ && (
                    <button
                      className="btn-icon bex-search-clear"
                      onClick={() => setSearchQ('')}
                      aria-label="Limpar busca"
                    >
                      <Icon name="x" />
                    </button>
                  )}
                </div>
              </div>

              {/* Dynamic Filter Chips */}
              <div className="bex-filter-groups">
                {/* Equipment Filter Chips */}
                <div className="bex-filter-row">
                  <span className="bex-filter-label">{t('Equipment') || 'Equipamento'}:</span>
                  <div className="bex-filter-chips">
                    <button
                      className={'bex-chip' + (eqFilter === 'all' ? ' on' : '')}
                      onClick={() => { haptic('light'); setEqFilter('all') }}
                    >
                      {t('All equipment')}
                    </button>
                    <button
                      className={'bex-chip' + (eqFilter === 'gym' ? ' on' : '')}
                      onClick={() => { haptic('light'); setEqFilter('gym') }}
                    >
                      <FitnessIcon slug="deadlift" size={14} className="chip-icn" />
                      {t('Gym')}
                    </button>
                    {availableEquipments.map(eq => {
                      const slug = equipmentIconSlug(eq)
                      return (
                        <button
                          key={eq}
                          className={'bex-chip' + (eqFilter === eq ? ' on' : '')}
                          onClick={() => { haptic('light'); setEqFilter(eq) }}
                        >
                          {slug && <FitnessIcon slug={slug} size={14} className="chip-icn" />}
                          {t(eq)}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Target Role & History Filters */}
                <div className="bex-filter-row between">
                  <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span className="bex-filter-label">{t('Focus') || 'Foco'}:</span>
                    <div className="bex-filter-chips">
                      <button
                        className={'bex-chip' + (roleFilter === 'all' ? ' on' : '')}
                        onClick={() => { haptic('light'); setRoleFilter('all') }}
                      >
                        {t('All roles')}
                      </button>
                      <button
                        className={'bex-chip' + (roleFilter === 'primary' ? ' on' : '')}
                        onClick={() => { haptic('light'); setRoleFilter('primary') }}
                      >
                        {t('Primary target')}
                      </button>
                      <button
                        className={'bex-chip' + (roleFilter === 'secondary' ? ' on' : '')}
                        onClick={() => { haptic('light'); setRoleFilter('secondary') }}
                      >
                        {t('Secondary')}
                      </button>
                    </div>

                    <span className="bex-filter-label" style={{ marginLeft: 4 }}>{t('Histórico')}:</span>
                    <div className="bex-filter-chips">
                      <button
                        className={'bex-chip' + (historyFilter === 'all' ? ' on' : '')}
                        onClick={() => { haptic('light'); setHistoryFilter('all') }}
                      >
                        {t('All')}
                      </button>
                      <button
                        className={'bex-chip' + (historyFilter === 'trained' ? ' on' : '')}
                        onClick={() => { haptic('light'); setHistoryFilter('trained') }}
                      >
                        {t('Trained by you')}
                      </button>
                      <button
                        className={'bex-chip' + (historyFilter === 'media' ? ' on' : '')}
                        onClick={() => { haptic('light'); setHistoryFilter('media') }}
                      >
                        <Icon name="video" style={{ fontSize: 12, marginRight: 2 }} />
                        {t('With video')}
                      </button>
                    </div>
                  </div>

                  {/* Sort Selector */}
                  <div className="row" style={{ gap: 6, alignItems: 'center', marginTop: 4 }}>
                    <span className="bex-filter-label">{t('Sort by')}:</span>
                    <select
                      className="bex-sort-select"
                      value={sortBy}
                      onChange={e => { haptic('light'); setSortBy(e.target.value) }}
                    >
                      <option value="popular">{t('Most popular')}</option>
                      <option value="az">{t('Name (A-Z)')}</option>
                      <option value="trained">{t('Most trained')}</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Status Bar: Counter & Reset */}
              <div className="bex-filter-status">
                <span className="bex-count-badge">
                  {t('Showing {0} of {1} exercises', filteredExercises.length, allForMuscle.length)}
                </span>
                {hasActiveFilters && (
                  <button className="bex-reset-link" onClick={resetFilters}>
                    <Icon name="x" />
                    <span>{t('Reset filters')}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Exercise List Results */}
            <div className="bex-results-area">
              {filteredExercises.length === 0 ? (
                <div className="bex-empty-results">
                  <div className="ico"><Icon name="magnifier" /></div>
                  <div className="tt">{t('No exercises found for these filters')}</div>
                  <div className="ss dim">{t('Try adjusting your filters or clearing search.')}</div>
                  {hasActiveFilters && (
                    <Button size="sm" variant="tinted" onClick={resetFilters} style={{ marginTop: 10 }}>
                      {t('Reset filters')}
                    </Button>
                  )}
                </div>
              ) : (
                <div className="bex-exercise-grid">
                  {filteredExercises.slice(0, shownCount).map(({ ex, isPrimary, userSets, userSessions, userBestW }) => {
                    const hasVideo = !!ex.video || !!ex.videoUrl
                    const bodyPartSlug = bodyPartIconSlug(ex.bp)
                    const equipSlug = equipmentIconSlug(ex.eq)

                    return (
                      <div
                        key={ex.id}
                        className="bex-ex-card"
                        onClick={() => { haptic('light'); exerciseDetailSheet(ex) }}
                      >
                        {/* Media Thumbnail */}
                        <div className="bex-ex-thumb-wrap">
                          <Thumb ex={ex} />
                          {hasVideo && (
                            <span className="bex-video-tag" title="Vídeo de Execução">
                              <Icon name="video" />
                            </span>
                          )}
                        </div>

                        {/* Exercise Information */}
                        <div className="bex-ex-info">
                          <div className="bex-ex-name">{ex.n || ex.name}</div>
                          <div className="bex-ex-badges">
                            <span className={'bex-badge' + (isPrimary ? ' primary' : ' secondary')}>
                              {bodyPartSlug && <FitnessIcon slug={bodyPartSlug} size={12} className="icn-inline" />}
                              {t(ex.tg || ex.bp)}
                            </span>
                            {ex.eq && (
                              <span className="bex-badge equip">
                                {equipSlug && <FitnessIcon slug={equipSlug} size={12} className="icn-inline" />}
                                {t(ex.eq)}
                              </span>
                            )}
                          </div>

                          {/* Personal Best or Sessions count */}
                          {userSessions > 0 && (
                            <div className="bex-ex-user-stat">
                              <span className="dot" />
                              {t('{0} sessions', userSessions)}
                              {userBestW > 0 && ` · Top ${fmtNum(userBestW)} ${S.unit || 'kg'}`}
                            </div>
                          )}
                        </div>

                        {/* Action buttons */}
                        <div className="bex-ex-actions" onClick={e => e.stopPropagation()}>
                          <button
                            className="bex-add-btn"
                            title="Planejar exercício na rotina"
                            onClick={() => { haptic('light'); addToRoutineSheet(ex) }}
                          >
                            <Icon name="plus" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Pagination Button */}
              {filteredExercises.length > shownCount && (
                <div className="bex-load-more-box">
                  <Button
                    variant="tinted"
                    onClick={() => { haptic('light'); setShownCount(c => c + 24) }}
                  >
                    {t('Load more exercises')} ({shownCount} / {filteredExercises.length})
                  </Button>
                </div>
              )}
            </div>

            {/* Recent Workouts Touching this Muscle (if any) */}
            {recentWorkouts.length > 0 && (
              <div className="bex-recent-workouts-box">
                <h4 className="sec" style={{ marginTop: 20, marginBottom: 8 }}>
                  {t('Recent workouts that trained this muscle')}
                </h4>
                <div className="bex-list">
                  {recentWorkouts.map(({ w, hits }) => (
                    <div
                      key={w.id}
                      className="bex-row bex-tap"
                      onClick={() => { haptic('light'); workoutDetailSheet(w.id) }}
                    >
                      <div className="bex-date">
                        <div className="bex-date-d">{fmtDate(w.d, true)}</div>
                        <div className="bex-date-s dim small">{hits.length} {t('hit')}</div>
                      </div>
                      <div className="grow">
                        <div className="tt bex-hits">
                          {hits.slice(0, 3).map(h => {
                            const ex = EXIDX[h.id]
                            return ex ? <span key={h.id} className="bex-hit">{ex.n}</span> : null
                          })}
                          {hits.length > 3 && <span className="bex-hit dim">+{hits.length - 3}</span>}
                        </div>
                        <div className="ss">
                          {hits.slice(0, 2).map(h => bestSetLabel(h, EXIDX[h.id])).join(' · ')}
                        </div>
                      </div>
                      <Icon name="chevronRight" className="chev" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}