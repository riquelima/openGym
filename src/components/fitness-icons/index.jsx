// Fitness icon set powered by bryllim/workout-guide (CC BY-SA 4.0).
// We render pre-bundled <symbol> elements via <use> so we ship a single
// sprite (one HTTP request) and avoid loading 302 separate SVGs.
import meta from './fitness-icons.json'

export const FITNESS_SLUGS = meta.slugs
const HAS = new Set(FITNESS_SLUGS)
const exists = slug => HAS.has(slug)

// Mount the sprite once on first render. Lazy-loads the SVG so it is
// only fetched the first time an icon is actually drawn.
let mounted = false
let pending = null
async function ensureSprite() {
  if (mounted) return
  if (pending) return pending
  pending = fetch(import.meta.env.BASE_URL + 'fitness-icons.svg')
    .then(r => r.text())
    .then(svg => {
      if (mounted) return
      const host = document.createElement('div')
      host.id = 'fitness-icons-sprite'
      host.setAttribute('aria-hidden', 'true')
      host.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;clip:rect(0 0 0 0)'
      host.innerHTML = svg
      document.body.prepend(host)
      mounted = true
    })
    .catch(() => { mounted = false })
  return pending
}

// Curated mapping: app body-part → most representative exercise icon.
const BODY_PART_ICON = {
  chest:        'bench-press',
  back:         'pull-up',
  shoulders:    'arnold-press',
  legs:         'squat',
  upper_legs:   'squat',
  lower_legs:   'calf-raise',
  arms:         'bicep-curl',
  upper_arms:   'bicep-curl',
  lower_arms:   'hammer-curl',
  core:         'plank',
  abs:          'crunch',
  waist:        'russian-twist',
  cardio:       'running',
  neck:         'shrug',
  stretching:   'childs-pose',
  warmup:       'arm-circles'
}

// Equipment → most representative exercise icon.
const EQUIPMENT_ICON = {
  barbell:      'deadlift',
  dumbbell:     'bicep-curl',
  ez_barbell:   'ez-bar-curl',
  kettlebells:  'goblet-squat',
  kettlebell:   'goblet-squat',
  cable:        'cable-fly',
  cable_machine: 'cable-fly',
  machine:      'leg-press',
  leverage_machine: 'leg-press',
  smith_machine:    'squat',
  sled_machine:     'leg-press',
  elliptical_machine: 'elliptical',
  skierg_machine:   'rowing',
  stepmill_machine: 'stair-climber',
  stationary_bike:  'cycling',
  upper_body_ergometer: 'rowing',
  band:         'banded-row',
  resistance_band:    'banded-row',
  medicine_ball:      'medicine-ball',
  stability_ball:     'stability-ball',
  exercise_ball:      'stability-ball',
  bosu:         'bosu-ball',
  olympic_rings: 'ring-dip',
  rope:         'battle-ropes',
  trx:          'inverted-row',
  bodyweight:   'push-up',
  body_weight:  'push-up',
  body_only:    'push-up',
  none:         'push-up'
}

export function bodyPartIconSlug(bp) {
  if (!bp) return null
  const key = String(bp).toLowerCase().trim().replace(/\s+/g, '_')
  const slug = BODY_PART_ICON[key]
  return slug && exists(slug) ? slug : null
}

export function equipmentIconSlug(eq) {
  if (!eq) return null
  const key = String(eq).toLowerCase().trim().replace(/\s+/g, '_')
  const slug = EQUIPMENT_ICON[key]
  if (slug && exists(slug)) return slug
  // Try a slug guess (e.g. "leverage machine" -> "leverage-machine")
  const guess = key.replace(/_/g, '-')
  return exists(guess) ? guess : null
}

export default function FitnessIcon({ slug, size, className = '', style, fallback, ...rest }) {
  // Kick off the sprite load on first use; the <use href="#…" /> will resolve
  // as soon as the sprite is mounted (or fallback if the load fails).
  ensureSprite()
  const id = slug && exists(slug) ? `ex-${slug}` : null
  if (!id) return fallback || null
  const s = size ? { width: size, height: size } : null
  return (
    <svg
      className={'ficn ' + className}
      aria-hidden="true"
      focusable="false"
      style={s ? { ...s, ...style } : style}
      {...rest}
    >
      <use href={`#${id}`} />
    </svg>
  )
}