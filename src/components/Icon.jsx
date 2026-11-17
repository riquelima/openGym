// openGym icon set — Powered by Activeicons (Sports & Fitness) & Font Awesome (System UI)
//
// All icons are high-precision vector glyphs rendered with `fill="currentColor"`,
// preserving exact scalable metrics across devices with zero external font layout shift.
import faIcons from './fa-icons.json'
import activeIcons from './active-icons.json'

// Local glyphs that aren't in the FA bundle. Kept inline so we don't touch
// the generated fa-icons.json (which is regenerated from upstream).
const LOCAL_ICONS = {
  // 6-dot vertical grip, used as the drag handle on reorderable lists
  grip: { d: 'M96 96a32 32 0 1 1 0 64 32 32 0 1 1 0-64zM256 96a32 32 0 1 1 0 64 32 32 0 1 1 0-64zM416 96a32 32 0 1 1 0 64 32 32 0 1 1 0-64zM96 224a32 32 0 1 1 0 64 32 32 0 1 1 0-64zM256 224a32 32 0 1 1 0 64 32 32 0 1 1 0-64zM416 224a32 32 0 1 1 0 64 32 32 0 1 1 0-64zM96 352a32 32 0 1 1 0 64 32 32 0 1 1 0-64zM256 352a32 32 0 1 1 0 64 32 32 0 1 1 0-64zM416 352a32 32 0 1 1 0 64 32 32 0 1 1 0-64z' }
}

// Export all available icon names for pickers and validators
export const ICON_NAMES = Array.from(new Set([...Object.keys(activeIcons), ...Object.keys(faIcons), ...Object.keys(LOCAL_ICONS)]))

/**
 * <Icon name="dumbbell" />        — inherits font-size via 1em sizing
 * <Icon name="flame" size={28} /> — explicit pixel size
 * <Icon name="check" className="custom" />
 */
export default function Icon({ name, size, className = '', style, ...rest }) {
  const icon = (name === 'grip' ? LOCAL_ICONS.grip : null) || activeIcons[name] || faIcons[name] || LOCAL_ICONS[name]
  if (!icon) return null

  const s = size ? { width: size, height: size } : null
  const is24 = icon.vb === '0 0 24 24'

  return (
    <svg
      className={'icn ' + className}
      viewBox={icon.vb || '0 0 512 512'}
      aria-hidden="true"
      focusable="false"
      style={s ? { ...s, ...style } : style}
      {...rest}
    >
      <path
        fill="currentColor"
        fillRule={is24 ? 'evenodd' : 'nonzero'}
        clipRule={is24 ? 'evenodd' : 'nonzero'}
        d={icon.d}
      />
    </svg>
  )
}
