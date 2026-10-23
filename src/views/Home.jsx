import { useState, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { effectiveRoutine, effectiveRoutineId, streakWeeks, lastBW, setsDoneActive } from '../lib/history.js'
import { fmtNum, fmtDate, todayISO, isoOf, weekKey, DAYS } from '../lib/format.js'
import { t, dateLocale } from '../lib/i18n.js'
import { bwSheet, goalSheet, dayOverrideSheet, calendarSheet, startFlow, loadStarterPlan, bwDeltaColor } from '../sheets.jsx'
import LineChart from '../components/LineChart.jsx'
import Icon from '../components/Icon.jsx'
import { Button } from '../components/ui.jsx'
import { glyphOf } from '../lib/glyphs.js'
import { coachAvailable, hasConsent } from '../lib/coach.js'
import { useCoachStatus } from '../lib/coach-api.js'
import { DEMO } from '../lib/demo.js'
import { MOBILE } from '../lib/mobile.js'
import { generateAICoachCards } from '../lib/recommendations.js'

// A job in flight or a proposal waiting is the only reason the Coach interrupts Home. When it
// has nothing to say it renders nothing at all — and it only polls while Home is on screen.
function CoachCard({ nav }) {
  const S = useStore(s => s.S)
  const { job, pending } = useCoachStatus(hasConsent(S))
  if (!hasConsent(S) || (!job && !pending)) return null
  const ready = !!pending
  return <div className="card" style={ready ? { borderColor: 'var(--acc)' } : null}>
    <div className="today-row" onClick={() => nav(ready ? '/coach/proposal' : '/coach')}>
      <div className="row" style={{ gap: 9, minWidth: 0 }}>
        <span className="lrow-i" style={{ background: ready ? 'var(--acc)' : 'var(--orange)' }}><Icon name="sparkles" /></span>
        <div style={{ minWidth: 0 }}>
          <div className="lbl2">{t('Coach')}</div>
          <div className="ttl">{ready
            ? (pending.kind === 'create'
              ? t('Your plan is ready')
              : t(pending.changes?.length === 1 ? '{0} suggestion for you' : '{0} suggestions for you', pending.changes?.length || 0))
            : t('Reading your training…')}</div>
        </div>
      </div>
      {ready ? <span className="tag acc">{t('Review')}</span> : <Icon name="chevronRight" className="chev" />}
    </div>
  </div>
}

// Home = what to do now + a quick glance. Deep charts & history live in Stats.
export default function Home() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const user = useStore(s => s.user)
  const config = useStore(s => s.config)
  const [weekOffset, setWeekOffset] = useState(0)
  const coachOn = coachAvailable(config, user, { demo: true })

  const today = new Date()
  const routine = effectiveRoutine(S, todayISO())
  const todayOvr = S.dayPlan[todayISO()] !== undefined
  const bw = lastBW(S)
  const prevBW = S.bodyweight.length > 1 ? S.bodyweight[S.bodyweight.length - 2] : null
  const delta = bw && prevBW ? bw.w - prevBW.w : null

  const monday = new Date(today); monday.setDate(today.getDate() - ((today.getDay() + 6) % 7) + weekOffset * 7)
  const doneDays = new Set(S.workouts.map(w => w.d))
  const strip = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday); d.setDate(monday.getDate() + i)
    const iso = isoOf(d)
    const eff = effectiveRoutineId(S, iso), ovr = S.dayPlan[iso] !== undefined, done = doneDays.has(iso)
    const dot = done ? ' done' : ovr && eff ? ' ovr' : eff ? ' plan' : ''
    strip.push(<div key={i} className={'wday' + (iso === todayISO() ? ' today' : '')} onClick={() => dayOverrideSheet(iso)}>
      <div className="lbl">{t(DAYS[d.getDay()])}</div><div className="num">{d.getDate()}</div><div className={'dot' + dot} /></div>)
  }
  const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6)
  const wkLabel = weekOffset === 0 ? t('This week') : `${monday.getDate()} ${monday.toLocaleDateString(dateLocale(), { month: 'short' })} – ${sunday.getDate()} ${sunday.toLocaleDateString(dateLocale(), { month: 'short' })}`

  const wThisWeek = S.workouts.filter(w => weekKey(w.d) === weekKey(todayISO())).length
  const plannedPerWeek = Object.keys(S.week).filter(k => S.week[k]).length
  const bwPoints = S.bodyweight.slice(-30).map(b => ({ t: b.t || new Date(b.d).getTime(), y: b.w, d: b.d }))

  // today's session shown right under the week strip
  const onToday = () => { if (S.active) nav('/workout'); else if (routine) startFlow(routine.id); else dayOverrideSheet(todayISO()) }

  // AI Coach Dynamic Recommendation Engine
  const coachCards = useMemo(() => generateAICoachCards(S), [S])
  const carouselRef = useRef(null)
  const scrollCarousel = (dir) => {
    if (carouselRef.current) {
      carouselRef.current.scrollBy({ left: dir * 300, behavior: 'smooth' })
    }
  }

  return <div className="narrow">
    {/* Figma Header Greeting */}
    <div className="hdr">
      <div>
        <h1>{user ? t('Hi {0}', user.name) : 'Open Workout'}</h1>
        <div className="sub">{t("It's time to challenge your limits.")}</div>
      </div>
      <button className="iconbtn" onClick={() => nav('/settings')} aria-label={t('Settings')}>
        <Icon name="gear" />
      </button>
    </div>

    {/* Figma Frame 16: Category Quick Nav */}
    <div className="cat-nav">
      <button className={"cat-nav-item" + (S.active || routine ? " active" : "")} onClick={onToday}>
        <span className="cat-icon"><Icon name="dumbbell" /></span>
        <span className="cat-label">{t('Workout')}</span>
      </button>
      <div className="cat-nav-divider" />
      <button className="cat-nav-item" onClick={() => nav('/stats')}>
        <span className="cat-icon"><Icon name="chart" /></span>
        <span className="cat-label">{t('Progress')}</span>
      </button>
      <div className="cat-nav-divider" />
      <button className="cat-nav-item" onClick={() => nav('/library')}>
        <span className="cat-icon"><Icon name="list" /></span>
        <span className="cat-label">{t('Exercises')}</span>
      </button>
      <div className="cat-nav-divider" />
      <button className="cat-nav-item" onClick={() => nav('/plan')}>
        <span className="cat-icon"><Icon name="calendar" /></span>
        <span className="cat-label">{t('Routines')}</span>
      </button>
    </div>

    {/* Figma Group 14: Weekly Challenge Banner */}
    <div className="challenge-banner" onClick={() => calendarSheet()}>
      <div className="row between" style={{ alignItems: 'flex-start' }}>
        <div>
          <div className="challenge-title">{t('Weekly Challenge')}</div>
          <div className="challenge-sub">
            {wThisWeek} de {plannedPerWeek || 4} treinos na semana · {t('{0} week streak', streakWeeks(S))}
          </div>
        </div>
        <span className="play-btn-circle lime" style={{ width: 38, height: 38, fontSize: 16 }}>
          <Icon name="flame" />
        </span>
      </div>
    </div>

    {/* Training Schedule Card */}
    <div className="card">
      <div className="row between" style={{ marginBottom: 8 }}>
        <button className="iconbtn" style={{ width: 30, height: 30, fontSize: 15 }} onClick={() => setWeekOffset(w => w - 1)} aria-label="Previous week"><Icon name="chevronLeft" /></button>
        <div className="small muted" style={{ fontWeight: 500, fontFamily: 'var(--font-athletic)' }}>{wkLabel}</div>
        <button className="iconbtn" style={{ width: 30, height: 30, fontSize: 15 }} onClick={() => setWeekOffset(w => w + 1)} aria-label="Next week"><Icon name="chevronRight" /></button>
      </div>
      <div className="week">{strip}</div>
      <div className="today-row" onClick={onToday} style={{ marginTop: 10 }}>
        <div className="row" style={{ gap: 10, minWidth: 0 }}>
          <span className="lrow-i" style={{ background: S.active ? 'var(--orange)' : routine ? 'var(--acc)' : 'var(--surface-3)', color: (S.active || !routine) ? '#FFFFFF' : 'var(--on-acc)' }}>
            <Icon name={S.active ? 'timer' : routine ? glyphOf(routine.emoji) : 'moon'} />
          </span>
          <div style={{ minWidth: 0 }}>
            <div className="lbl2" style={{ fontFamily: 'var(--font-athletic)', color: 'var(--label-2)' }}>{t('Today')}</div>
            <div className="ttl" style={{ fontFamily: 'var(--font-display)', fontWeight: 600 }}>{S.active ? t('{0} — in progress', S.active.name) : routine ? routine.name : t('Rest day')}{todayOvr && routine ? ' · ' + t('rescheduled') : ''}</div>
          </div>
        </div>
        {S.active ? <span className="tag" style={{ color: 'var(--orange)', background: 'rgba(255,159,10,0.18)' }}>{t('Resume')}</span>
          : routine ? <span className="tag acc">{t('Start')}</span>
          : <Icon name="plus" className="chev" />}
      </div>
    </div>

    {coachOn && <CoachCard nav={nav} />}

    {!S.routines.length && !S.active && (
      <div className="card">
        <div className="row" style={{ gap: 10, marginBottom: 6 }}>
          <span className="lrow-i" style={{ background: 'var(--acc)', color: 'var(--on-acc)' }}><Icon name="sparkles" /></span>
          <div className="big" style={{ fontSize: 22, fontFamily: 'var(--font-display)' }}>{t('Welcome!')}</div>
        </div>
        <div className="muted small" style={{ marginBottom: 14 }}>{t('Set up your weekly routine to get going — or load a ready-made Push / Pull / Legs plan.')}</div>
        {coachOn && <>
          <Button variant="primary" icon="sparkles" onClick={() => nav(hasConsent(S) ? '/coach/intake' : '/coach')}>{t('Let the Coach build it')}</Button>
          <div style={{ height: 8 }} />
        </>}
        <Button variant={coachOn ? 'plain' : 'primary'} icon="sparkles" onClick={loadStarterPlan}>{t('Load starter plan (PPL)')}</Button>
        <div style={{ height: 8 }} /><Button onClick={() => nav('/plan')}>{t('Build my own plan')}</Button>
      </div>
    )}

    {/* AI Coach Dynamic Recommendations Carousel */}
    <div style={{ marginTop: 22, marginBottom: 14 }}>
      <div className="row between" style={{ marginBottom: 10, padding: '0 4px', alignItems: 'flex-end' }}>
        <div>
          <div className="row" style={{ gap: 6, alignItems: 'center' }}>
            <span style={{ color: 'var(--acc)', display: 'inline-flex', fontSize: 16 }}>
              <Icon name="sparkles" />
            </span>
            <h3 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--acc)', fontWeight: 600 }}>
              {t('Recommendations')}
            </h3>
            <span className="ai-coach-pill">{coachCards.length} {t('dicas')}</span>
          </div>
          <div className="small muted" style={{ marginTop: 2, fontFamily: 'var(--font-athletic)' }}>
            {t('Dicas do AI Coach personalizadas para seu treino e peso')}
          </div>
        </div>
        <div className="row" style={{ gap: 6 }}>
          <button
            className="iconbtn"
            style={{ width: 28, height: 28, fontSize: 13 }}
            onClick={() => scrollCarousel(-1)}
            aria-label="Anterior"
          >
            <Icon name="chevronLeft" />
          </button>
          <button
            className="iconbtn"
            style={{ width: 28, height: 28, fontSize: 13 }}
            onClick={() => scrollCarousel(1)}
            aria-label="Próximo"
          >
            <Icon name="chevronRight" />
          </button>
        </div>
      </div>

      <div ref={carouselRef} className="ai-coach-carousel">
        {coachCards.map((card, idx) => (
          <div
            key={card.id || idx}
            className="ai-coach-card"
            onClick={() => {
              if (card.action?.type === 'nav') nav(card.action.path)
              else if (card.action?.type === 'bwSheet') bwSheet()
              else if (card.action?.type === 'startFlow') startFlow(card.action.routineId)
            }}
          >
            <div>
              <div className="ai-coach-card-header">
                <span
                  className="ai-coach-badge"
                  style={{
                    color: card.badgeColor || 'var(--acc)',
                    background: card.badgeColor ? `${card.badgeColor}18` : 'rgba(var(--acc-rgb), 0.12)',
                    borderColor: card.badgeColor ? `${card.badgeColor}33` : 'rgba(var(--acc-rgb), 0.25)'
                  }}
                >
                  {card.badge}
                </span>
                <span
                  className="ai-coach-icon-bubble"
                  style={{
                    color: card.badgeColor || 'var(--acc)',
                    background: card.badgeColor ? `${card.badgeColor}14` : 'var(--surface-2)'
                  }}
                >
                  <Icon name={card.icon || 'sparkles'} />
                </span>
              </div>

              <div className="ai-coach-card-title">{card.title}</div>

              {card.metric && (
                <div className="ai-coach-metric-pill">
                  <Icon name="flame" style={{ fontSize: 11, color: card.badgeColor || 'var(--acc)' }} />
                  <span>{card.metric}</span>
                </div>
              )}

              <div className="ai-coach-card-summary">{card.summary}</div>
              <div className="ai-coach-card-detail">{card.detail}</div>
            </div>

            {card.action && (
              <div className="ai-coach-card-footer">
                <span className="ai-coach-action-link">
                  {card.action.label} →
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>

    {/* Body Weight Card */}
    <div className="card">
      <div className="row between" style={{ marginBottom: 6 }}>
        <h2 style={{ margin: 0 }}>{t('Body weight')}</h2>
        <div className="row" style={{ gap: 8 }}>
          <Button size="sm" icon="target" style={S.targetW ? { color: 'var(--yellow)' } : undefined} onClick={goalSheet}>{S.targetW ? fmtNum(S.targetW) : t('Goal')}</Button>
          <Button size="sm" icon="plus" onClick={() => bwSheet()}>{t('Log')}</Button>
        </div>
      </div>
      {bw ? <>
        <div className="row" style={{ gap: 8, alignItems: 'baseline' }}>
          <div className="big">{fmtNum(bw.w)} <span className="muted" style={{ fontSize: '1rem' }}>{S.unit}</span></div>
          {!!delta && (
            <span className="small row" style={{ gap: 2, fontWeight: 500, color: bwDeltaColor(delta, bw.w) }}>
              <Icon name={delta > 0 ? 'arrowUp' : 'arrowDown'} style={{ fontSize: 12 }} />
              {fmtNum(Math.abs(delta))}
            </span>
          )}
          <span className="dim small" style={{ marginLeft: 'auto' }}>{fmtDate(bw.d, true)}</span>
        </div>
        {S.targetW && (
          <div className="small row" style={{ color: 'var(--yellow)', marginTop: 4, gap: 5 }}>
            <Icon name="target" style={{ fontSize: 13 }} />
            <span>{t('Goal')} {fmtNum(S.targetW)} {S.unit} · {Math.abs(S.targetW - bw.w) < 0.05 ? t('reached!') : t(S.targetW > bw.w ? '{0} to gain' : '{0} to lose', fmtNum(Math.abs(S.targetW - bw.w)) + ' ' + S.unit)}</span>
          </div>
        )}
        <div className="chart" style={{ marginTop: 8 }}><LineChart points={bwPoints} h={130} unit={S.unit} goal={S.targetW} /></div>
      </> : <div className="muted small">{t("No entries yet — log your weight to start the curve. It's also asked before every workout.")}</div>}
    </div>

    {/* Streak & Consistency Card */}
    <div className="card tappable" style={{ cursor: 'pointer' }} onClick={() => calendarSheet()}>
      <div className="row between">
        <div>
          <div className="row" style={{ gap: 7, fontSize: 22, fontWeight: 600, letterSpacing: '-.021em' }}>
            <Icon name="flame" style={{ color: 'var(--acc)' }} />
            {t('{0} week streak', streakWeeks(S))}
          </div>
          <div className="muted small" style={{ marginTop: 2 }}>{wThisWeek}{plannedPerWeek ? ' / ' + plannedPerWeek : ''} {t('this week')} · {t(S.workouts.length === 1 ? '{0} workout total' : '{0} workouts total', S.workouts.length)}</div>
        </div>
        <Icon name="calendar" className="chev" style={{ fontSize: 20 }} />
      </div>
    </div>
  </div>
}
