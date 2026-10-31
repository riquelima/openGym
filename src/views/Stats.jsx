import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { EXIDX } from '../lib/exercises.js'
import { lastBW, streakWeeks, setLabel, modeOf, effortOf } from '../lib/history.js'
import { fmtNum, fmtDate, fmtVol, todayISO, weekKey } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import { bwSheet, goalSheet, calendarSheet, workoutDetailSheet, WorkoutRow, bwDeltaColor } from '../sheets.jsx'
import LineChart from '../components/LineChart.jsx'
import Heatmap from '../components/Heatmap.jsx'
import Icon from '../components/Icon.jsx'
import BodyMap, { BodyMapLegend } from '../components/BodyMap.jsx'
import { loadOfWorkouts, rankOf, MUSCLE_NAME } from '../lib/muscles.js'
import { e1rmSeries, best1RM } from '../lib/onerm.js'
import {
  hasEffort, displayScale, scaleName, toScale, avgRir, effortSummary, effortWeeks,
  effortHistogram, isHardSet, HARD_RIR
} from '../lib/effort.js'
import { Button, Segmented, SelectRow } from '../components/ui.jsx'
import { computeDashboardKPIs, computeDashboardAttention } from '../lib/dashboard.js'

// Muscle Balance: Ranked breakdown with 3px slim share bars and anatomical silhouette
function MuscleBalance({ S }) {
  const [win, setWin] = useState(7)
  const [hard, setHard] = useState(false)
  const [sel, setSel] = useState(null)
  const now = Date.now()
  const inWin = S.workouts.filter(w =>
    win === 0 ? true
      : win === 7 ? weekKey(w.d) === weekKey(todayISO())
        : (w.start || new Date(w.d).getTime()) > now - win * 86400000)

  const rated = inWin.some(w => w.entries.some(e => e.sets.some(s => s.done && isHardSet(s))))
  const on = hard && rated
  const load = loadOfWorkouts(inWin, on ? isHardSet : null)
  const { worked, missed } = rankOf(load)
  const top = worked.slice(0, 5)
  const max = worked.length ? load[worked[0]] : 0
  const sets = m => Math.round((load[m] || 0) * 10) / 10
  const totalSets = Object.values(load).reduce((a, b) => a + b, 0) || 1

  return <div className="card">
    <div className="row between" style={{ marginBottom: 8 }}>
      <h2 style={{ margin: 0 }}>
        {t('Muscle balance')} <span className="dim" style={{ textTransform: 'none', letterSpacing: 0, fontSize: 13 }}>· {on ? t('by hard sets') : t('by sets worked')}</span>
      </h2>
      {rated && (
        <Button size="sm" icon="flame" style={on ? { color: 'var(--yellow)' } : undefined}
          onClick={() => { setHard(h => !h); setSel(null) }}>
          {on ? t('Hard') : t('All')}
        </Button>
      )}
    </div>
    <Segmented className="seg-range" value={win} onChange={v => { setWin(v); setSel(null) }}
      options={[{ value: 7, label: t('Week') }, { value: 30, label: '30d' }, { value: 90, label: '90d' }, { value: 0, label: t('All') }]} />

    {inWin.length ? <>
      <BodyMap className="tappable" load={load} body={S.body} selected={sel}
        onMuscle={m => setSel(s => (s === m ? null : m))} />
      <BodyMapLegend />

      {sel && (
        <div className="mrow" style={{ borderTop: 'var(--hair) solid var(--sep)', marginTop: 8, paddingTop: 10 }}>
          <span className="nm"><b>{t(MUSCLE_NAME[sel] || sel)}</b></span>
          <span className="v tnum">{sets(sel) ? t('{0} sets', sets(sel)) : on ? t('no hard sets') : t('not trained')}</span>
        </div>
      )}

      {/* Ranked breakdown list with 3px slim rounded share bars (dashboard-design rule) */}
      {!sel && (
        <div className="dash-ranked-list" style={{ marginTop: 10 }}>
          <div className="row between small muted" style={{ padding: '0 10px 4px 10px', fontSize: 11 }}>
            <span>{t('Grupo muscular')}</span>
            <span>{t('Séries · % do volume')}</span>
          </div>
          {top.map(m => {
            const sCount = sets(m)
            const pct = Math.round((load[m] / (max || 1)) * 100)
            const sharePct = Math.round((load[m] / totalSets) * 100)
            return (
              <div key={m} className="dash-ranked-row">
                <div className="dash-ranked-row-left">
                  <span className="dash-ranked-name">{t(MUSCLE_NAME[m] || m)}</span>
                </div>
                <div className="dash-ranked-right">
                  <span className="dash-ranked-val">{sCount} {t('sets')}</span>
                  <span className="dash-ranked-share">{sharePct}%</span>
                </div>
                <div className="dash-share-track">
                  <div
                    className="dash-share-bar"
                    style={{
                      width: `${Math.max(2, Math.min(100, pct))}%`,
                      background: on ? 'var(--yellow)' : 'var(--acc)'
                    }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {missed.length > 0 && <>
        <h4 className="sec" style={{ marginTop: 14 }}>{on ? t('No hard sets in this period') : t('Not trained in this period')}</h4>
        <div className="mchips">{missed.map(m => <span key={m} className="mchip miss">{t(MUSCLE_NAME[m] || m)}</span>)}</div>
      </>}
      {!missed.length && worked.length > 0 && (
        <div className="muted small" style={{ marginTop: 10 }}>
          {on ? t('Every muscle group got at least one hard set in this period.') : t('Every muscle group got some work in this period.')}
        </div>
      )}
    </> : <div className="muted small" style={{ marginTop: 8 }}>{t('No workouts in this period yet.')}</div>}
  </div>
}

// Effort & Intensity: RIR / RPE Failure Proximity Dashboard Card
function EffortCard({ S }) {
  const [win, setWin] = useState(90)
  const kind = displayScale(S)
  const hd = scaleName(kind)
  const sum = effortSummary(S, win)
  const weeks = effortWeeks(S, win)
  const hist = effortHistogram(S, win)
  const maxBin = Math.max(1, ...hist.map(b => b.n))
  const pts = weeks.map(w => ({ t: w.t, y: toScale(kind, w.rir), note: t('{0} sets', w.sets) }))
  const binLabel = b => kind === 'rpe' ? (b.tail ? '≤ 6' : String(10 - b.rir)) : (b.tail ? b.rir + '+' : String(b.rir))

  return <div className="card">
    <div className="row between" style={{ marginBottom: 6 }}>
      <h2 style={{ margin: 0 }}>{t('Effort')} <span className="dim" style={{ textTransform: 'none', letterSpacing: 0, fontSize: 13 }}>· {t('how close to failure')}</span></h2>
    </div>
    <Segmented className="seg-range" value={win} onChange={setWin}
      options={[{ value: 30, label: '30d' }, { value: 90, label: '90d' }, { value: 365, label: '1Y' }, { value: 0, label: t('All') }]} />

    {sum.rated === 0 ? <div className="muted small" style={{ marginTop: 8 }}>{t('No rated sets in this period.')}</div> : <>
      <div className="row between" style={{ alignItems: 'flex-end', gap: 12, marginTop: 10 }}>
        <div>
          <div className="stat-v tnum">{sum.avg == null ? '—' : fmtNum(toScale(kind, sum.avg)) + ' ' + hd}</div>
          <div className="small dim">{t('average effort')}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="stat-v tnum" style={{ color: 'var(--yellow)' }}>{sum.hardPct == null ? '—' : Math.round(sum.hardPct * 100) + '%'}</div>
          <div className="small dim">{t('at {0} {1} or harder', hd, fmtNum(toScale(kind, HARD_RIR)))}</div>
        </div>
      </div>
      <div className="small dim" style={{ marginTop: 6 }}>{t('{0} of {1} finished sets rated', sum.rated, sum.done)}</div>
      {effortOf(S) === 'none' && (
        <div className="small" style={{ color: 'var(--yellow)', marginTop: 4 }}>
          {t('Effort per set is switched off — turn it on in Settings to keep rating.')}
        </div>
      )}

      {pts.length > 1 && <>
        <h4 className="sec" style={{ marginTop: 12 }}>{t('Week by week')}</h4>
        <div className="chart"><LineChart points={pts} h={140} unit={hd} color="var(--yellow)" invert={kind === 'rir'} /></div>
      </>}

      <h4 className="sec" style={{ marginTop: 14 }}>{t('Where the sets land')}</h4>
      {/* Ranked distribution with 3px slim share bar */}
      <div className="dash-ranked-list">
        <div className="row between small muted" style={{ padding: '0 10px 4px 10px', fontSize: 11 }}>
          <span>{t('Faixa de esforço')}</span>
          <span>{t('Séries · Frequência')}</span>
        </div>
        {hist.map(b => {
          const isHard = b.rir <= HARD_RIR
          const pct = Math.round((b.n / maxBin) * 100)
          const sharePct = Math.round(b.pct * 100)
          return (
            <div key={b.rir} className="dash-ranked-row">
              <div className="dash-ranked-row-left">
                <span className="dash-ranked-name">{hd} {binLabel(b)}</span>
              </div>
              <div className="dash-ranked-right">
                <span className="dash-ranked-val" style={{ color: isHard ? 'var(--yellow)' : 'inherit' }}>{b.n} sets</span>
                <span className="dash-ranked-share">{b.n ? `${sharePct}%` : '—'}</span>
              </div>
              <div className="dash-share-track">
                <div
                  className="dash-share-bar"
                  style={{
                    width: `${Math.max(b.n ? 2 : 0, Math.min(100, pct))}%`,
                    background: isHard ? 'var(--yellow)' : 'var(--label-3)'
                  }}
                />
              </div>
            </div>
          )
        })}
      </div>
      <div className="small dim" style={{ marginTop: 8 }}>
        {t('Most working sets belong close to failure without living there — half at the floor and half at the top average out to a healthy-looking middle.')}
      </div>
    </>}
  </div>
}

// Stats = the analytics hub: all charts, progress, metrics and history live here.
export default function Stats() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const [range, setRange] = useState(90)
  const [selectedKpi, setSelectedKpi] = useState('workouts')
  const [exId, setExId] = useState(null)
  const [exMetric, setExMetric] = useState('top')

  const now = Date.now()
  const anyEffort = hasEffort(S)
  const kind = displayScale(S)
  const hd = scaleName(kind)

  // Unified Dashboard KPIs with honest deltas and same-elapsed-time comparisons
  const kpis = useMemo(() => computeDashboardKPIs(S, range), [S, range])
  const attentionItems = useMemo(() => computeDashboardAttention(S), [S])

  const bwPts = S.bodyweight.filter(b => range === 0 || (b.t || new Date(b.d).getTime()) > now - range * 86400000)
    .map(b => ({ t: b.t || new Date(b.d).getTime(), y: b.w, d: b.d }))
  const bw30 = S.bodyweight.filter(b => (b.t || new Date(b.d).getTime()) > now - 30 * 86400000)
  const bwDelta30 = bw30.length > 1 ? bw30[bw30.length - 1].w - bw30[0].w : null

  const exHist = [...new Set(S.workouts.flatMap(w => w.entries.map(e => e.id)))].filter(id => EXIDX[id]).sort((a, b) => EXIDX[a].n < EXIDX[b].n ? -1 : 1)
  const curEx = exId && exHist.includes(exId) ? exId : exHist[0] || null

  const curMode = curEx ? (() => {
    for (let i = S.workouts.length - 1; i >= 0; i--) {
      const en = S.workouts[i].entries.find(e => e.id === curEx)
      if (en) return modeOf({ ...(en.target || {}), id: curEx })
    }
    return modeOf({ id: curEx })
  })() : 'reps'
  const curCardio = curMode === 'cardio'
  const curTimed = curMode === 'time'
  const metric = s => curCardio ? (s.speed || 0) : curTimed ? (s.sec || 0) : (s.w || 0)
  const exUnit = curCardio ? 'km/h' : curTimed ? 's' : S.unit
  let exPts = [], exList = [], exBest = 0
  if (curEx) {
    S.workouts.forEach(w => {
      const en = w.entries.find(e => e.id === curEx)
      if (en) {
        const mx = Math.max(0, ...en.sets.filter(s => s.done).map(metric), curCardio || curTimed ? 0 : (en.topW || 0))
        if (mx > 0) {
          exPts.push({ t: w.start, y: mx, d: w.d, sets: en.sets.filter(s => s.done), target: en.target })
          if (mx > exBest) exBest = mx
        }
      }
    })
    exList = exPts.slice(-5).reverse()
  }

  const e1Pts = curEx ? e1rmSeries(S, curEx) : []
  const e1Best = curEx ? best1RM(S, curEx) : null
  const showE1 = e1Pts.length > 0
  const exRir = exPts.map(p => avgRir(p.sets))
  const showEff = exRir.filter(v => v != null).length >= 3
  const effPts = exPts.map((p, i) => (exRir[i] == null ? null : { t: p.t, y: toScale(kind, exRir[i]), d: p.d })).filter(Boolean)
  const onE1 = showE1 && exMetric === 'e1rm'
  const onEff = showEff && exMetric === 'effort'
  const topPts = exPts.map((p, i) => ({
    t: p.t, y: p.y, d: p.d,
    m: exRir[i] == null ? null : 1 - Math.min(4, Math.max(0, exRir[i])) / 4,
    note: exRir[i] == null ? undefined : hd + ' ' + fmtNum(toScale(kind, exRir[i]))
  }))
  const exOpts = [{ value: 'top', label: t('Top set') }]
  if (showE1) exOpts.push({ value: 'e1rm', label: t('Est. 1RM') })
  if (showEff) exOpts.push({ value: 'effort', label: t('Effort') })

  return <>
    {/* Calm Dashboard Header with Live Dot & Range Pill Group */}
    <div className="hdr" style={{ marginBottom: 12 }}>
      <div>
        <h1>{t('Stats')}</h1>
        <div className="sub">{t('Progresso, métricas e histórico de treino')}</div>
      </div>
      <div className="dash-toolbar">
        <div className="dash-live-pill" title={t('Dados sincronizados')}>
          <span className="dash-live-dot" />
          <span>{t('Sincronizado')}</span>
        </div>
        <button className="iconbtn" onClick={() => nav('/history')} aria-label={t('History')} title={t('History')}>
          <Icon name="history" />
        </button>
      </div>
    </div>

    {/* Range Switcher Bar */}
    <div style={{ marginBottom: 12 }}>
      <Segmented
        className="seg-range"
        value={range}
        onChange={setRange}
        options={[
          { value: 30, label: '30d' },
          { value: 90, label: '90d' },
          { value: 365, label: '1A' },
          { value: 0, label: t('Tudo') }
        ]}
      />
    </div>

    {/* Unified KPI Strip (Dashboard-Design Standard) */}
    <div className="dash-kpi-card">
      {/* 1. Workouts count */}
      <div
        className={`dash-kpi-tile ${selectedKpi === 'workouts' ? 'selected' : ''}`}
        onClick={() => setSelectedKpi('workouts')}
        title={t('Total de sessões de treino concluídas no período')}
      >
        <div className="dash-kpi-header">
          <span className="dash-kpi-label">{t('Workouts')}</span>
          <span className="dash-kpi-icon"><Icon name="dumbbell" /></span>
        </div>
        <div className="dash-kpi-value">{kpis.workouts.count}</div>
        <div className="dash-kpi-footer">
          {kpis.workouts.delta && (
            <span className={`dash-delta ${kpis.workouts.delta.status}`}>
              {kpis.workouts.delta.text}
            </span>
          )}
          <span className="dash-baseline">{kpis.workouts.delta?.vs || kpis.workouts.baseline}</span>
        </div>
      </div>

      {/* 2. Tonnage / Volume */}
      <div
        className={`dash-kpi-tile ${selectedKpi === 'tonnage' ? 'selected' : ''}`}
        onClick={() => setSelectedKpi('tonnage')}
        title={t('Carga média levantada por sessão (peso × repetições)')}
      >
        <div className="dash-kpi-header">
          <span className="dash-kpi-label">{t('Volume Médio')}</span>
          <span className="dash-kpi-icon"><Icon name="chartLine" /></span>
        </div>
        <div className="dash-kpi-value">
          {kpis.tonnage.avg >= 1000 ? `${(kpis.tonnage.avg / 1000).toFixed(1)}k` : kpis.tonnage.avg}{' '}
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--label-2)' }}>{kpis.tonnage.unit}</span>
        </div>
        <div className="dash-kpi-footer">
          {kpis.tonnage.delta && (
            <span className={`dash-delta ${kpis.tonnage.delta.status}`}>
              {kpis.tonnage.delta.text}
            </span>
          )}
          <span className="dash-baseline">{t('por treino')}</span>
        </div>
      </div>

      {/* 3. Streak / Constancy */}
      <div
        className={`dash-kpi-tile ${selectedKpi === 'streak' ? 'selected' : ''}`}
        onClick={() => setSelectedKpi('streak')}
        title={t('Semanas consecutivas cumprindo o cronograma semanal')}
      >
        <div className="dash-kpi-header">
          <span className="dash-kpi-label">{t('Week streak')}</span>
          <span className="dash-kpi-icon"><Icon name="flame" /></span>
        </div>
        <div className="dash-kpi-value">
          {kpis.streak.weeks}{' '}
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--label-2)' }}>sem</span>
        </div>
        <div className="dash-kpi-footer">
          <span className={`dash-delta ${kpis.streak.active ? 'up' : 'neutral'}`}>
            {kpis.streak.active ? '● Ativa' : 'Pausada'}
          </span>
          <span className="dash-baseline">{kpis.streak.plannedWeekly}x/sem</span>
        </div>
      </div>

      {/* 4. Bodyweight & Goal */}
      <div
        className={`dash-kpi-tile ${selectedKpi === 'bodyweight' ? 'selected' : ''}`}
        onClick={() => setSelectedKpi('bodyweight')}
        title={t('Peso corporal mais recente e variação nos últimos 30 dias')}
      >
        <div className="dash-kpi-header">
          <span className="dash-kpi-label">{t('Body weight')}</span>
          <span className="dash-kpi-icon"><Icon name="scale" /></span>
        </div>
        <div className="dash-kpi-value">
          {kpis.bodyweight.current ? fmtNum(kpis.bodyweight.current) : '—'}{' '}
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--label-2)' }}>{kpis.bodyweight.unit}</span>
        </div>
        <div className="dash-kpi-footer">
          {kpis.bodyweight.delta30d !== null ? (
            <span className={`dash-delta ${kpis.bodyweight.delta30d === 0 ? 'neutral' : kpis.bodyweight.delta30d < 0 ? 'down' : 'up'}`}>
              {kpis.bodyweight.delta30d > 0 ? '+' : ''}{fmtNum(kpis.bodyweight.delta30d)} {kpis.bodyweight.unit}
            </span>
          ) : kpis.bodyweight.target ? (
            <span className="dash-delta neutral" style={{ color: 'var(--yellow)' }}>
              Alvo {fmtNum(kpis.bodyweight.target)}
            </span>
          ) : (
            <span className="dash-baseline">{t('Sem meta')}</span>
          )}
          <span className="dash-baseline">30d</span>
        </div>
      </div>
    </div>

    {/* Monitor: Attention and Actions (dashboard-design rule) */}
    {attentionItems.length > 0 && (
      <div className="dash-attention-strip">
        {attentionItems.map(item => (
          <div key={item.id} className={`dash-attention-item ${item.type}`}>
            <div className="dash-attention-text">
              <span className="dash-attention-icon">
                <Icon name={item.icon} />
              </span>
              <div>
                <div className="dash-attention-title">{item.title}</div>
                <div className="dash-attention-desc">{item.desc}</div>
              </div>
            </div>
            <button
              className="dash-attention-btn"
              onClick={() => {
                if (item.action === 'bwSheet') bwSheet()
                else if (item.action === 'navPlan') nav('/plan')
                else if (item.action === 'navLibrary') nav('/library')
              }}
            >
              {item.actionLabel} →
            </button>
          </div>
        ))}
      </div>
    )}

    {/* Activity Calendar Matrix / Heatmap */}
    <div className="card">
      <div className="row between" style={{ marginBottom: 4 }}>
        <h2 style={{ margin: 0 }}>
          {t('Activity — last 12 months')} <span className="dim" style={{ textTransform: 'none', letterSpacing: 0, fontSize: 13, whiteSpace: 'nowrap' }}>· {t('by time trained')}</span>
        </h2>
      </div>
      <Heatmap S={S} onDay={iso => {
        const ws = S.workouts.filter(w => w.d === iso)
        if (ws.length === 1) workoutDetailSheet(ws[0])
        else if (ws.length) calendarSheet(iso)
      }} />
    </div>

    {/* Muscle Balance & Effort Analytics */}
    {S.workouts.length > 0 && <MuscleBalance S={S} />}
    {anyEffort && <EffortCard S={S} />}

    {/* Two Columns Grid for Charts */}
    <div className="cols">
      {/* Body Weight Progression */}
      <div className="card">
        <div className="row between" style={{ marginBottom: 8 }}>
          <div>
            <h2 style={{ margin: 0 }}>{t('Body weight')}</h2>
            {kpis.bodyweight.current && (
              <div className="small muted" style={{ marginTop: 2 }}>
                {t('Atual')}: <b>{fmtNum(kpis.bodyweight.current)} {kpis.bodyweight.unit}</b>
                {kpis.bodyweight.target && <> · {t('Alvo')}: <b>{fmtNum(kpis.bodyweight.target)} {kpis.bodyweight.unit}</b></>}
              </div>
            )}
          </div>
          <div className="row" style={{ gap: 8 }}>
            <Button size="sm" icon="target" style={S.targetW ? { color: 'var(--yellow)' } : undefined} onClick={goalSheet}>
              {S.targetW ? fmtNum(S.targetW) : t('Goal')}
            </Button>
            <Button size="sm" icon="plus" onClick={() => bwSheet()}>{t('Log')}</Button>
          </div>
        </div>
        <div className="chart"><LineChart points={bwPts} h={160} unit={S.unit} goal={S.targetW} /></div>
      </div>

      {/* Exercise Progression */}
      <div className="card">
        <h2>{t('Exercise progress')}</h2>
        {exHist.length ? <>
          <div className="sect-b" style={{ marginBottom: 10 }}>
            <SelectRow title={t('Exercise')} sheetTitle={t('Exercise progress')} value={curEx} onChange={setExId}
              options={exHist.map(id => ({ value: id, label: EXIDX[id].n }))} />
          </div>
          {exOpts.length > 1 && (
            <Segmented className="seg-range" value={onEff ? 'effort' : onE1 ? 'e1rm' : 'top'} onChange={setExMetric} options={exOpts} />
          )}
          <div className="chart">
            {onEff
              ? <LineChart points={effPts} h={150} unit={hd} color="var(--yellow)" invert={kind === 'rir'} />
              : <LineChart points={onE1 ? e1Pts.map(p => ({ t: p.t, y: p.y, d: p.d })) : topPts} h={150} unit={exUnit} color="var(--blue)" />}
          </div>
          <div style={{ marginTop: 8 }}>
            {exList.map((p, i) => (
              <div key={i} className="row between small" style={{ padding: '6px 0', borderBottom: 'var(--hair) solid var(--sep)' }}>
                <span className="muted">{fmtDate(p.d, true)}</span>
                <span className="tnum">{p.sets.map(s => setLabel(curEx, s, p.target)).join('  ')}</span>
              </div>
            ))}
          </div>
          <div className="small dim" style={{ marginTop: 8 }}>
            {onEff ? t('Average effort per workout') : onE1 ? t('Estimated 1RM per workout') : curCardio ? t('Top speed per workout') : curTimed ? t('Longest hold per workout') : t('Best set weight per workout')}
            {onEff ? '' : <> · {t('Best:')}{' '}<b className="accent">{fmtNum(onE1 ? e1Best.est : exBest)} {onE1 ? S.unit : exUnit}</b></>}
          </div>
        </> : <div className="muted small" style={{ marginTop: 8 }}>{t('Finish your first workout to see progress curves here.')}</div>}
      </div>
    </div>

    {/* Recent Activity Table */}
    {S.workouts.length > 0 && <>
      <div className="row between" style={{ marginBottom: 10, marginTop: 14 }}>
        <h4 className="sec" style={{ margin: 0 }}>{t('Recent workouts')}</h4>
        <Button size="sm" variant="ghost" trailingIcon="chevronRight" onClick={() => nav('/history')}>{t('All')} {S.workouts.length}</Button>
      </div>
      <div className="list">
        {[...S.workouts].reverse().slice(0, 6).map(w => <WorkoutRow key={w.id} w={w} onClick={() => workoutDetailSheet(w)} />)}
      </div>
    </>}
  </>
}
