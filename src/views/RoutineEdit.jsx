import { useNavigate, useParams } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store/useStore.js'
import { exOr } from '../lib/exercises.js'
import { healCustomExercises } from '../lib/exercise-matcher.js'
import { uid } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import { supersetUnits, cleanupSg, exLine } from '../lib/history.js'
import { Thumb } from '../components/Media.jsx'
import { glyphPicker, exercisePicker, exConfigSheet, confirmSheet } from '../sheets.jsx'
import Icon from '../components/Icon.jsx'
import { glyphOf } from '../lib/glyphs.js'
import { Button, SelectRow } from '../components/ui.jsx'
import { POLICIES_FOR, POLICY_NAME, POLICY_DESC } from '../lib/progression.js'
import BodyMap from '../components/BodyMap.jsx'
import { loadOfRoutine, rankOf, MUSCLE_NAME } from '../lib/muscles.js'

export default function RoutineEdit() {
  const nav = useNavigate()
  const { id } = useParams()
  const S = useStore(s => s.S)
  const update = useStore(s => s.update)
  const r = S.routines.find(x => x.id === id)
  useEffect(() => {
    if (!r) {
      nav('/plan')
      return
    }
    // Auto-heal any exercises in routine that lack photo/video demonstrations
    let needsHeal = false
    for (const e of (r.ex || [])) {
      const exObj = exOr(e.id)
      if (exObj.missing || (!exObj.img && !exObj.gif && !exObj.video) || e.id.startsWith('c_')) {
        needsHeal = true
        break
      }
    }
    if (needsHeal) {
      update(s => { healCustomExercises(s) })
    }
  }, [r?.id])
  if (!r) return null

  const edit = fn => update(s => { fn(s.routines.find(x => x.id === id).ex) })
  const toggleLink = i => edit(ex => {
    if (i < 1) return
    const cur = ex[i], prev = ex[i - 1]
    if (cur.sg && prev.sg && cur.sg === prev.sg) delete cur.sg
    else { const gid = prev.sg || ('sg' + uid()); prev.sg = gid; cur.sg = gid }
    cleanupSg(ex)
  })

  const units = supersetUnits(r.ex)
  const unitFirst = new Set(units.filter(u => u.length > 1).map(u => u[0]))
  const inSS = new Set(units.filter(u => u.length > 1).flat())

  return <div className="narrow">
    <div className="hdr">
      <button className="iconbtn" onClick={() => nav('/plan')} aria-label={t('Plan')}><Icon name="chevronLeft" /></button>
      <div style={{ flex: 1, margin: '0 12px' }}>
        <input className="input" defaultValue={r.name} style={{ fontWeight: 600, fontSize: 20, letterSpacing: '-.021em' }}
          onChange={e => update(s => { s.routines.find(x => x.id === id).name = e.target.value.trim() || t('Routine') })} />
      </div>
      <button className="iconbtn" aria-label={t('Pick an icon')} onClick={() => glyphPicker(r.emoji, g => update(s => { s.routines.find(x => x.id === id).emoji = g }))}><Icon name={glyphOf(r.emoji)} /></button>
    </div>

    <div className="sect-b" style={{ marginBottom: 16 }}>
      <SelectRow icon="chartLine" title={t('Progression')} sheetTitle={t('Progression')}
        value={r.prog || 'linear'} onChange={v => update(s => { s.routines.find(x => x.id === id).prog = v })}
        options={POLICIES_FOR.reps.map(p => ({ value: p, label: t(POLICY_NAME[p]), subtitle: t(POLICY_DESC[p]) }))} />
    </div>
    <div className="small dim" style={{ margin: '-10px 2px 16px' }}>
      {t('Applies to every exercise in this routine that does not set its own rule.')}
    </div>

    {r.ex.length ? <ReorderableList
      ex={r.ex}
      inSS={inSS}
      unitFirst={unitFirst}
      toggleLink={toggleLink}
      onReorder={(from, to) => edit(list => {
        if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return
        const [moved] = list.splice(from, 1)
        list.splice(to, 0, moved)
        cleanupSg(list)
      })}
      onOpen={(i) => exConfigSheet(exOr(r.ex[i].id), r.ex[i], cfg => edit(x => { x[i] = { id: x[i].id, sg: x[i].sg, ...cfg } }), () => edit(x => { x.splice(i, 1); cleanupSg(x) }), r)}
    /> : <div className="empty"><div className="ico"><Icon name="dumbbell" /></div>{t('No exercises yet — add your first one.')}</div>}

    {/* Coverage of the routine as planned, so a gap shows up while you're building it
        rather than after a month of training around it. */}
    {r.ex.length > 0 && (() => {
      const load = loadOfRoutine(r)
      const { worked } = rankOf(load)
      return <div className="card" style={{ marginTop: 12 }}>
        <h2>{t('What this session hits')}</h2>
        <BodyMap load={load} body={S.body} />
        <div className="mchips">
          {worked.slice(0, 6).map(m => <span key={m} className="mchip">{t(MUSCLE_NAME[m])}</span>)}
        </div>
      </div>
    })()}

    <div className="small dim row" style={{ margin: '10px 2px', gap: 5 }}><Icon name="link" style={{ fontSize: 13 }} />{t('Tap the link button on an exercise to superset it with the one above — you’ll do them back-to-back.')}</div>
    <Button variant="primary" onClick={() => exercisePicker(ex => exConfigSheet(ex, null, cfg => edit(x => { x.push({ id: ex.id, ...cfg }) }), null, r))} icon="plus">{t('Add exercise')}</Button>
    <div style={{ height: 10 }} />
    <Button variant="danger" onClick={() => confirmSheet({
      title: t('Delete routine?'), message: t('“{0}” and its exercises will be removed.', r.name), confirmText: t('Delete'), danger: true,
      onConfirm: () => {
        update(s => {
          s.routines = s.routines.filter(x => x.id !== id)
          Object.keys(s.week).forEach(k => { if (s.week[k] === id) delete s.week[k] })
          Object.keys(s.dayPlan).forEach(k => { if (s.dayPlan[k] === id) delete s.dayPlan[k] })
        })
        nav('/plan')
      }
    })}>{t('Delete routine')}</Button>
  </div>
}

/* Drag-to-reorder list. The whole row is a `pointer` drag handle on the left;
   the rest of the card opens the config sheet on tap. Uses Pointer Events so
   mouse, touch and stylus all work the same way. While dragging we show a
   placeholder slot and a translated card; on release we commit the move. */
function ReorderableList({ ex, inSS, unitFirst, toggleLink, onReorder, onOpen }) {
  const [order, setOrder] = useState(ex.map((_, i) => i))
  const [dragFrom, setDragFrom] = useState(null)
  const [overIdx, setOverIdx] = useState(null)
  const containerRef = useRef(null)
  const itemRefs = useRef(new Map())
  const lastCommit = useRef(null)
  // Keep the local order in sync with the source list (e.g. when an item is added
  // or removed externally). Resetting on every change is fine — the list is short
  // and reordering commits the result back to the store, so this only fires on
  // structural changes.
  useEffect(() => { setOrder(ex.map((_, i) => i)) }, [ex.length, ex.map(e => e.id + ':' + (e.sg || '')).join('|')])

  // Move the dragged card above/below siblings by clientY. We don't animate the
  // reorder; we just keep the dragged card under the finger and snap the slot
  // divider. A 2-row-threshold keeps the move from feeling jittery.
  const onMove = ev => {
    if (dragFrom == null) return
    const y = ev.clientY
    let best = null
    for (const [i, el] of itemRefs.current.entries()) {
      if (!el) continue
      const r = el.getBoundingClientRect()
      if (y >= r.top + r.height * 0.35 && y <= r.bottom - r.height * 0.35) { best = i; break }
    }
    if (best == null) {
      // outside any item: clamp to first/last visible
      const first = itemRefs.current.get(0)
      const last = itemRefs.current.get(order.length - 1)
      if (first && y < first.getBoundingClientRect().top) best = 0
      else if (last && y > last.getBoundingClientRect().bottom) best = order.length - 1
    }
    if (best != null) setOverIdx(best)
  }

  const finish = () => {
    if (dragFrom != null && overIdx != null && dragFrom !== overIdx) {
      onReorder(dragFrom, overIdx)
    }
    setDragFrom(null); setOverIdx(null)
  }

  const start = (i, ev) => {
    if (ev.button != null && ev.button !== 0) return
    ev.preventDefault()
    setDragFrom(i); setOverIdx(i)
    try { ev.currentTarget.setPointerCapture(ev.pointerId) } catch {}
  }

  return <div className="list" ref={containerRef} onPointerMove={onMove} onPointerUp={finish} onPointerCancel={finish}>
    {order.map((origIdx, slot) => {
      const e = ex[origIdx]
      const exObj = exOr(e.id)
      const linkedPrev = slot > 0 && e.sg && ex[order[slot - 1]].sg === e.sg
      const isDragging = dragFrom === slot
      const isOver = overIdx === slot && dragFrom != null && dragFrom !== slot
      return <div key={origIdx}
        ref={el => { if (el) itemRefs.current.set(slot, el); else itemRefs.current.delete(slot) }}
        style={{ touchAction: 'none' }}
        onPointerMove={isDragging ? onMove : undefined}
      >
        {unitFirst.has(slot) && <div className="ss-label"><Icon name="link" />{t('Superset')}</div>}
        <div className={'item' + (inSS.has(slot) ? ' in-ss' : '') + (isOver ? ' drop-target' : '')}
          style={isDragging ? { opacity: 0.4 } : undefined}
          onClick={isDragging ? undefined : () => onOpen(slot)}
        >
          {/* Drag handle — the entire left column is the grab area. The rest of the card
              stays clickable for opening the config sheet. */}
          <div
            className="reorder-handle"
            onPointerDown={ev => start(slot, ev)}
            aria-label={t('Drag to reorder')}
            title={t('Drag to reorder')}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '0 4px 0 2px', marginRight: 8, color: 'var(--label-3)',
              cursor: 'grab', touchAction: 'none', flex: 'none'
            }}
          >
            <Icon name="grip" style={{ fontSize: 20 }} />
          </div>
          <Thumb ex={exObj} />
          <div className="grow"><div className="tt capitalize">{exObj.n}</div><div className="ss">{exLine(e, S().unit)}</div></div>
          {slot > 0 && <button className={'iconbtn' + (linkedPrev ? ' on-ss' : '')} title={t('Superset with exercise above')}
            style={{ width: 36, height: 36, flex: 'none' }}
            onPointerDown={ev => ev.stopPropagation()}
            onClick={ev => { ev.stopPropagation(); toggleLink(slot) }}><Icon name="link" /></button>}
        </div>
      </div>
    })}
  </div>
}

// Local S() so the list can read the current unit without re-rendering on every store change.
const S = () => useStore.getState().S
