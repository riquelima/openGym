import { useState, useEffect, useMemo, useRef } from 'react'
import { useStore } from '../store/useStore.js'
import { BODYPARTS, equipmentOf, allExercises } from '../lib/exercises.js'
import { searchExerciseDB } from '../lib/exercisedb-api.js'
import { bestWeightFor } from '../lib/history.js'
import { fmtNum } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import { Thumb } from '../components/Media.jsx'
import { exerciseDetailSheet, addToRoutineSheet, customExSheet } from '../sheets.jsx'
import Icon from '../components/Icon.jsx'
import FitnessIcon, { bodyPartIconSlug, equipmentIconSlug } from '../components/fitness-icons/index.jsx'
import { Button } from '../components/ui.jsx'
import BodyExplorer from '../components/BodyExplorer.jsx'
import { musclesOf, MUSCLE_NAME } from '../lib/muscles.js'
import { haptic } from '../lib/haptics.js'

// Mapping from high-level body parts to default muscle highlight on the skeleton
const BODYPART_TO_MUSCLE = {
  chest: 'chest',
  back: 'upper-back',
  shoulders: 'deltoids',
  'upper arms': 'biceps',
  'lower arms': 'forearm',
  waist: 'abs',
  'upper legs': 'quadriceps',
  'lower legs': 'calves',
  neck: 'trapezius',
}

// Mapping from anatomical muscle slug to its body part in the database
const MUSCLE_TO_BODYPART = {
  chest: 'chest',
  'upper-back': 'back',
  'lower-back': 'back',
  trapezius: 'back',
  serratus: 'chest',
  deltoids: 'shoulders',
  biceps: 'upper arms',
  triceps: 'upper arms',
  forearm: 'lower arms',
  abs: 'waist',
  obliques: 'waist',
  gluteal: 'upper legs',
  quadriceps: 'upper legs',
  hamstring: 'upper legs',
  adductors: 'upper legs',
  'hip-flexors': 'upper legs',
  calves: 'lower legs',
  tibialis: 'lower legs',
}

export default function Library() {
  const S = useStore(s => s.S)
  const [q, setQ] = useState('')
  const [bp, setBp] = useState('')
  const [eq, setEq] = useState('')
  const [selectedMuscle, setSelectedMuscle] = useState(null)
  const [shown, setShown] = useState(40)
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(false)
  const listRef = useRef(null)

  // Equipment options based on all current exercises, filtered by active muscle or bodypart
  const all = allExercises(S)
  const eqOpts = useMemo(() => {
    return equipmentOf(all.filter(e => {
      if (selectedMuscle) {
        const m = musclesOf(e)
        return m[selectedMuscle] && m[selectedMuscle] > 0
      }
      return !bp || e.bp === bp
    }))
  }, [all, selectedMuscle, bp])

  const eqOn = eq === 'gym' ? 'gym' : (eqOpts.includes(eq) ? eq : '')

  // Load exercises directly from unified ExerciseDB
  useEffect(() => {
    let active = true
    setLoading(true)

    const timer = setTimeout(async () => {
      try {
        const results = await searchExerciseDB(q, {
          bodyPart: bp,
          equipment: eqOn,
          limit: 0
        })
        if (active) {
          setList(results)
          setLoading(false)
        }
      } catch {
        if (active) setLoading(false)
      }
    }, q ? 250 : 0)

    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [q, bp, eqOn])

  // Precise anatomical filter if a specific muscle is selected on the skeleton
  const filteredList = useMemo(() => {
    if (!selectedMuscle) return list
    return list.filter(e => {
      const m = musclesOf(e)
      return m[selectedMuscle] && m[selectedMuscle] > 0
    })
  }, [list, selectedMuscle])

  // Handle body part chip click (top filters)
  const handleBodyPartClick = b => {
    haptic('light')
    if (bp === b) {
      setBp('')
      setSelectedMuscle(null)
    } else {
      setBp(b)
      setSelectedMuscle(BODYPART_TO_MUSCLE[b] || null)
    }
    setEq('')
    setShown(40)
  }

  // Handle muscle selection on the interactive skeleton
  const handleSelectMuscle = slug => {
    haptic('selection')
    if (selectedMuscle === slug) {
      setSelectedMuscle(null)
      setBp('')
    } else {
      setSelectedMuscle(slug)
      setBp(MUSCLE_TO_BODYPART[slug] || '')
      setTimeout(() => {
        listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }, 100)
    }
    setShown(40)
  }

  // Reset all filters
  const resetAllFilters = () => {
    haptic('light')
    setQ('')
    setBp('')
    setEq('')
    setSelectedMuscle(null)
    setShown(40)
  }

  const hasActiveFilters = !!(q || bp || eqOn || selectedMuscle)

  return <>
    {/* Page Title */}
    <div className="hdr" style={{ paddingBottom: 6 }}>
      <div>
        <h1>{t('Exercises')}</h1>
      </div>
    </div>

    {/* Search Input (kept above as requested) */}
    <div className="search" style={{ marginBottom: 10 }}>
      <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
      <input
        className="input"
        placeholder={t('Buscar Exercícios')}
        value={q}
        onChange={e => { setQ(e.target.value); setShown(40) }}
      />
      {q && (
        <button
          type="button"
          className="btn-icon"
          style={{ position: 'absolute', right: 10, background: 'none', border: 'none', color: 'var(--label-2)', cursor: 'pointer' }}
          onClick={() => { setQ(''); setShown(40) }}
          aria-label="Limpar busca"
        >
          <Icon name="x" />
        </button>
      )}
    </div>

    {/* Body part chips (kept above as requested) */}
    <div className="chips" style={{ marginBottom: eqOpts.length > 1 ? 8 : 12 }}>
      <button
        type="button"
        className={'chip nocap' + (!bp && !selectedMuscle ? ' on' : '')}
        onClick={() => { haptic('light'); setBp(''); setSelectedMuscle(null); setEq(''); setShown(40) }}
      >
        {t('All')}
      </button>
      {BODYPARTS.map(b => {
        const slug = bodyPartIconSlug(b)
        const isActive = bp === b
        return (
          <button
            key={b}
            type="button"
            className={'chip' + (isActive ? ' on' : '')}
            onClick={() => handleBodyPartClick(b)}
          >
            {slug && <FitnessIcon slug={slug} size={18} className="chip-icn" />}
            {t(b)}
          </button>
        )
      })}
    </div>

    {/* Equipment chips (kept above as requested) */}
    {(eqOpts.length > 0 || eq === 'gym') && (
      <div className="chips" style={{ marginBottom: 14 }}>
        <button
          type="button"
          className={'chip nocap' + (!eqOn ? ' on' : '')}
          onClick={() => { haptic('light'); setEq(''); setShown(40) }}
        >
          {t('Any equipment')}
        </button>
        <button
          type="button"
          className={'chip' + (eqOn === 'gym' ? ' on' : '')}
          onClick={() => { haptic('light'); setEq(eqOn === 'gym' ? '' : 'gym'); setShown(40) }}
        >
          <FitnessIcon slug="deadlift" size={18} className="chip-icn" />
          {t('Academia')}
        </button>
        {eqOpts.map(x => {
          const slug = equipmentIconSlug(x)
          return (
            <button
              key={x}
              type="button"
              className={'chip' + (eqOn === x ? ' on' : '')}
              onClick={() => { haptic('light'); setEq(x); setShown(40) }}
            >
              {slug && <FitnessIcon slug={slug} size={18} className="chip-icn" />}
              {t(x)}
            </button>
          )
        })}
      </div>
    )}

    {/* Elegant Interactive Human Skeleton Section */}
    <BodyExplorer
      S={S}
      selected={selectedMuscle}
      onSelectMuscle={handleSelectMuscle}
      matchingCount={filteredList.length}
    />

    {/* Active filter summary pill bar (visible when filters are applied) */}
    <div ref={listRef}>
      {hasActiveFilters && (
        <div
          className="row between bex-active-filter-bar"
          style={{ alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}
        >
          <div className="row" style={{ gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="dim small" style={{ fontWeight: 600 }}>{t('Filtrando')}:</span>
            {selectedMuscle && (
              <span className="tag acc" style={{ fontSize: 12, padding: '3px 9px', borderRadius: 999, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <span className="dot" style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />
                {t(MUSCLE_NAME[selectedMuscle] || selectedMuscle)}
                <button
                  type="button"
                  onClick={() => { setSelectedMuscle(null); setBp('') }}
                  style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, marginLeft: 2, display: 'inline-flex' }}
                  title="Remover músculo"
                >
                  <Icon name="x" style={{ width: 11, height: 11 }} />
                </button>
              </span>
            )}
            {eqOn && (
              <span className="tag" style={{ fontSize: 12, padding: '3px 9px', borderRadius: 999, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                {eqOn === 'gym' ? t('Academia') : t(eqOn)}
                <button
                  type="button"
                  onClick={() => setEq('')}
                  style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, marginLeft: 2, display: 'inline-flex' }}
                  title="Remover equipamento"
                >
                  <Icon name="x" style={{ width: 11, height: 11 }} />
                </button>
              </span>
            )}
            {q && (
              <span className="tag" style={{ fontSize: 12, padding: '3px 9px', borderRadius: 999, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                "{q}"
                <button
                  type="button"
                  onClick={() => setQ('')}
                  style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, marginLeft: 2, display: 'inline-flex' }}
                  title="Remover busca"
                >
                  <Icon name="x" style={{ width: 11, height: 11 }} />
                </button>
              </span>
            )}
            <span className="dim small">({filteredList.length} {t('exercícios')})</span>
          </div>

          <Button size="sm" variant="ghost" icon="x" onClick={resetAllFilters}>
            {t('Limpar tudo')}
          </Button>
        </div>
      )}
    </div>

    {/* Exercise List */}
    <div className="list">
      {/* Option to create custom exercise */}
      <div className="item" onClick={() => customExSheet(null, ex => exerciseDetailSheet(ex), q.trim())}>
        <div className="thumb thumb-x"><Icon name="sparkles" /></div>
        <div className="grow">
          <div className="tt">{t('Create your own exercise')}</div>
          <div className="ss">{t('name + body part, no animation')}</div>
        </div>
        <Icon name="plus" className="chev" />
      </div>

      {loading && filteredList.length === 0 ? (
        <div className="empty">
          <div className="ico"><Icon name="cloud" /></div>
          {t('Searching ExerciseDB…')}
        </div>
      ) : filteredList.length > 0 ? (
        filteredList.slice(0, shown).map(e => {
          const best = bestWeightFor(S, e.id)
          const hasVideo = !!e.video || !!e.videoUrl
          return (
            <div key={e.id} className="item" onClick={() => exerciseDetailSheet(e)}>
              <Thumb ex={e} />
              <div className="grow">
                <div className="tt capitalize">{e.n}</div>
                <div className="ss capitalize">{t(e.tg || e.bp)} · {t(e.eq)}</div>
              </div>

              {hasVideo && (
                <span className="tag acc" style={{ fontSize: 11, padding: '2px 6px' }} title="Vídeo de demonstração">
                  <Icon name="video" style={{ fontSize: 11 }} />
                </span>
              )}

              {best > 0 && <span className="tag acc">{fmtNum(best)}</span>}

              <Button
                size="sm"
                variant="tinted"
                icon="plus"
                onClick={ev => { ev.stopPropagation(); addToRoutineSheet(e) }}
              >
                {t('Plan')}
              </Button>
            </div>
          )
        })
      ) : (
        <div className="empty" style={{ padding: '32px 16px', textAlign: 'center' }}>
          <div className="ico"><Icon name="magnifier" /></div>
          <div style={{ fontWeight: 600, fontSize: 15, marginTop: 8 }}>{t('No exercises found for these filters')}</div>
          <div className="ss dim" style={{ fontSize: 13, marginTop: 4 }}>
            {t('Try adjusting your filters or clearing search.')}
          </div>
          <div style={{ marginTop: 14 }}>
            <Button size="sm" variant="tinted" onClick={resetAllFilters}>
              {t('Clear filters')}
            </Button>
          </div>
        </div>
      )}
    </div>

    {filteredList.length > shown && (
      <>
        <div style={{ height: 10 }} />
        <Button onClick={() => setShown(s => s + 40)}>
          {t('Show more')} ({shown} / {filteredList.length})
        </Button>
      </>
    )}
  </>
}
