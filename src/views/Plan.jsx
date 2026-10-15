import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { DAYN, uid, exCount } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import { dayAssignSheet, loadStarterPlan, planToolsSheet } from '../sheets.jsx'
import Icon from '../components/Icon.jsx'
import { Button } from '../components/ui.jsx'
import { glyphOf, DEFAULT_GLYPH } from '../lib/glyphs.js'
import { coachAvailable, hasConsent } from '../lib/coach.js'

export default function Plan() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const user = useStore(s => s.user)
  const config = useStore(s => s.config)
  const update = useStore(s => s.update)
  const coachOn = coachAvailable(config, user, { demo: true })

  const addRoutine = () => {
    const r = { id: uid(), name: t('New routine'), emoji: DEFAULT_GLYPH, ex: [] }
    update(s => { s.routines.push(r) })
    nav('/plan/r/' + r.id)
  }

  return <>
    <div className="hdr">
      <div>
        <h1>{t('Plan')}</h1>
        <div className="sub">{t('Your weekly routine')}</div>
      </div>
      <div className="row" style={{ gap: 8 }}>
        <button className="iconbtn" onClick={planToolsSheet} aria-label={t('Share your plan')} title={t('Share your plan')}>
          <Icon name="upload" />
        </button>
      </div>
    </div>

    {/* AI Coach Banner */}
    {coachOn && (
      <div
        style={{
          margin: '12px 0 18px 0',
          padding: '14px 16px',
          borderRadius: 18,
          background: 'linear-gradient(135deg, var(--acc-soft) 0%, var(--glass-bg) 100%)',
          border: '1px solid var(--acc-line)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: 'var(--glass-shadow)',
          cursor: 'pointer'
        }}
        onClick={() => nav(hasConsent(S) ? '/coach' : '/coach')}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 14,
              background: 'var(--acc)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              overflow: 'hidden'
            }}
          >
            <img
              src="https://cdn-icons-png.flaticon.com/512/16806/16806607.png"
              alt="AI Coach"
              style={{ width: 28, height: 28, objectFit: 'contain' }}
            />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--label)' }}>
              {t('AI Coach')}
            </div>
            <div style={{ fontSize: 12, color: 'var(--label-2)', marginTop: 2 }}>
              {S.routines.length ? t('Revisar rotinas e ajustar sobrecarga com IA') : t('Criar plano de treino personalizado com IA')}
            </div>
          </div>
        </div>
        <button
          style={{
            background: 'var(--acc)',
            color: 'var(--on-acc)',
            border: 'none',
            padding: '7px 15px',
            borderRadius: 12,
            fontWeight: 700,
            fontSize: 12,
            cursor: 'pointer',
            flexShrink: 0
          }}
          onClick={e => { e.stopPropagation(); nav(hasConsent(S) ? '/coach' : '/coach') }}
        >
          {S.routines.length ? t('Revisar') : t('Criar')}
        </button>
      </div>
    )}

    <div className="cols">
      <div>
        <h4 className="sec">{t('Week schedule')}</h4>
        <div className="list" style={{ display: 'flex', flexDirection: 'column' }}>
          {[1, 2, 3, 4, 5, 6, 0].map(d => {
            const r = S.routines.find(x => x.id === S.week[d])
            return <div key={d} className="item" onClick={() => dayAssignSheet(d)}>
              <div className="grow"><div className="tt">{t(DAYN[d])}</div></div>
              {r ? <span className="tag acc"><Icon name={glyphOf(r.emoji)} />{r.name}</span> : <span className="tag">{t('Rest')}</span>}
              <Icon name="chevronRight" className="chev" />
            </div>
          })}
        </div>
      </div>
      <div>
        <div className="row between" style={{ marginTop: 22, marginBottom: 10 }}>
          <h4 className="sec" style={{ margin: 0 }}>{t('Routines')}</h4>
          <Button size="sm" variant="tinted" icon="plus" onClick={addRoutine}>{t('New')}</Button>
        </div>
        {S.routines.length ? (
          <div className="list">
            {S.routines.map(r => (
              <div key={r.id} className="item" onClick={() => nav('/plan/r/' + r.id)}>
                <span className="lrow-i"><Icon name={glyphOf(r.emoji)} /></span>
                <div className="grow"><div className="tt">{r.name}</div><div className="ss">{exCount(r.ex.length)}</div></div>
                <Icon name="chevronRight" className="chev" />
              </div>
            ))}
          </div>
        ) : (
          <>
            <div className="empty">
              <div className="ico"><Icon name="clipboard" /></div>
              {t('No routines yet.')}<br />{t('Create one or load the starter plan.')}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {coachOn && (
                <Button variant="primary" icon="sparkles" onClick={() => nav(hasConsent(S) ? '/coach/intake' : '/coach')}>
                  {t('Let the Coach build it')}
                </Button>
              )}
              <Button variant={coachOn ? 'plain' : 'primary'} icon="sparkles" onClick={loadStarterPlan}>
                {t('Load starter plan (Push / Pull / Legs)')}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  </>
}
