import { useLocation, useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { effectiveRoutine } from '../lib/history.js'
import { todayISO } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import { hapticLight, hapticMedium } from '../lib/haptics.js'
import Icon from './Icon.jsx'

export default function TabBar({ onStart }) {
  const nav = useNavigate()
  const loc = useLocation()
  const S = useStore(s => s.S)
  const user = useStore(s => s.user)
  const isGuest = useStore(s => s.isGuest())
  if (!user && !isGuest) return null

  const cur = loc.pathname.split('/')[1] || 'home'
  const on = k => cur === k || (cur === 'history' && k === 'stats') || (cur === 'settings' && k === 'home')

  const handleTab = (k, to) => {
    hapticLight()
    if (on(k)) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    nav(to)
  }

  const startWorkout = () => {
    hapticMedium()
    if (!S.active) {
      const r = effectiveRoutine(S, todayISO())
      if (r && r.ex.length) { onStart(r.id); return }
    }
    nav('/workout')
  }

  const Tab = ({ k, icon, to, label }) => {
    const active = on(k)
    return (
      <button
        className={`tab-btn ${active ? 'on' : ''}`}
        onClick={() => handleTab(k, to)}
        aria-label={label}
        aria-current={active ? 'page' : undefined}
      >
        <span className="tab-icon-wrap">
          <Icon name={icon} />
          {active && <span className="tab-active-glow" />}
        </span>
        <span className="tab-label">{label}</span>
      </button>
    )
  }

  return (
    <nav id="tabbar" className="tabbar-ios">
      <Tab k="home" icon="house" to="/home" label={t('Home')} />
      <Tab k="plan" icon="calendar" to="/plan" label={t('Plan')} />
      <button
        className={'tab-start' + (S.active ? ' rec' : '')}
        onClick={startWorkout}
        aria-label={S.active ? t('Resume') : t('Start')}
      >
        <span className="cir">
          <Icon name={S.active ? 'play' : 'dumbbell'} />
          {S.active && <span className="radar-wave" />}
        </span>
        <span className="tab-start-text">{S.active ? t('Resume') : t('Start')}</span>
      </button>
      <Tab k="stats" icon="chart" to="/stats" label={t('Stats')} />
      <Tab k="library" icon="list" to="/library" label={t('Exercises')} />
    </nav>
  )
}
