import { useState, useEffect } from 'react'
import { useStore } from '../store/useStore.js'
import { BODYPARTS, equipmentOf, allExercises } from '../lib/exercises.js'
import { searchExerciseDB } from '../lib/exercisedb-api.js'
import { bestWeightFor } from '../lib/history.js'
import { fmtNum } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import { Thumb } from '../components/Media.jsx'
import { exerciseDetailSheet, addToRoutineSheet, customExSheet } from '../sheets.jsx'
import Icon from '../components/Icon.jsx'
import { Button } from '../components/ui.jsx'

export default function Library() {
  const S = useStore(s => s.S)
  const [q, setQ] = useState('')
  const [bp, setBp] = useState('')
  const [eq, setEq] = useState('')
  const [shown, setShown] = useState(40)
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(false)

  // Equipment options based on all current exercises
  const all = allExercises(S)
  const eqOpts = equipmentOf(all.filter(e => !bp || e.bp === bp))
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
          limit: 120
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

  return <>
    <div className="hdr" style={{ paddingBottom: 6 }}>
      <div>
        <h1>{t('Exercises')}</h1>
        <div className="sub">
          {t('ExerciseDB · 11.000+ exercícios com demonstração em vídeo HD')}
        </div>
      </div>
    </div>

    {/* Search Input */}
    <div className="search" style={{ marginBottom: 10 }}>
      <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
      <input
        className="input"
        placeholder={t('Buscar no ExerciseDB (ex: Supino, Bench Press, Peito)…')}
        value={q}
        onChange={e => { setQ(e.target.value); setShown(40) }}
      />
      {q && (
        <button
          className="btn-icon"
          style={{ position: 'absolute', right: 10, background: 'none', border: 'none', color: 'var(--label-2)', cursor: 'pointer' }}
          onClick={() => { setQ(''); setShown(40) }}
        >
          <Icon name="x" />
        </button>
      )}
    </div>

    {/* Body part chips */}
    <div className="chips" style={{ marginBottom: eqOpts.length > 1 ? 8 : 12 }}>
      <button className={'chip nocap' + (!bp ? ' on' : '')} onClick={() => { setBp(''); setEq(''); setShown(40) }}>
        {t('All')}
      </button>
      {BODYPARTS.map(b => (
        <button key={b} className={'chip' + (bp === b ? ' on' : '')} onClick={() => { setBp(b); setEq(''); setShown(40) }}>
          {t(b)}
        </button>
      ))}
    </div>

    {/* Equipment chips */}
    {(eqOpts.length > 0 || eq === 'gym') && (
      <div className="chips" style={{ marginBottom: 12 }}>
        <button className={'chip nocap' + (!eqOn ? ' on' : '')} onClick={() => { setEq(''); setShown(40) }}>
          {t('Any equipment')}
        </button>
        <button className={'chip' + (eqOn === 'gym' ? ' on' : '')} onClick={() => { setEq(eqOn === 'gym' ? '' : 'gym'); setShown(40) }}>
          {t('Academia')}
        </button>
        {eqOpts.map(x => (
          <button key={x} className={'chip' + (eqOn === x ? ' on' : '')} onClick={() => { setEq(x); setShown(40) }}>
            {t(x)}
          </button>
        ))}
      </div>
    )}

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

      {loading && list.length === 0 ? (
        <div className="empty">
          <div className="ico"><Icon name="cloud" /></div>
          {t('Searching ExerciseDB…')}
        </div>
      ) : list.length > 0 ? (
        list.slice(0, shown).map(e => {
          const best = bestWeightFor(S, e.id)
          const hasVideo = !!e.video || !!e.videoUrl
          const hasGif = !!e.gif || !!e.gifUrl
          return (
            <div key={e.id} className="item" onClick={() => exerciseDetailSheet(e)}>
              <Thumb ex={e} />
              <div className="grow">
                <div className="tt capitalize">{e.n}</div>
                <div className="ss capitalize">{t(e.tg || e.bp)} · {t(e.eq)}</div>
              </div>

              {hasVideo && (
                <span className="tag acc" style={{ fontSize: 11, padding: '2px 6px' }} title="Vídeo">
                  <Icon name="video" style={{ fontSize: 11 }} />
                </span>
              )}

              {best > 0 && <span className="tag acc">{fmtNum(best)}</span>}

              <Button size="sm" variant="tinted" icon="plus" onClick={ev => { ev.stopPropagation(); addToRoutineSheet(e) }}>
                {t('Plan')}
              </Button>
            </div>
          )
        })
      ) : (
        <div className="empty">
          <div className="ico"><Icon name="magnifier" /></div>
          {t('No match in ExerciseDB.')}
        </div>
      )}
    </div>

    {list.length > shown && (
      <>
        <div style={{ height: 10 }} />
        <Button onClick={() => setShown(s => s + 40)}>{t('Show more')}</Button>
      </>
    )}
  </>
}
