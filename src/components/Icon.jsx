// openGym icon set — Powered by Font Awesome Free (Vector SVG paths)
//
// All icons are high-precision vector glyphs rendered with `fill="currentColor"`,
// preserving exact scalable metrics across devices with zero external font layout shift.
import faIcons from './fa-icons.json'

// Export all available icon names for pickers and validators
export const ICON_NAMES = Object.keys(faIcons)

/**
 * <Icon name="flame" />           — inherits font-size via 1em sizing
 * <Icon name="flame" size={28} /> — explicit pixel size
 * <Icon name="check" className="custom" />
 */
export default function Icon({ name, size, className = '', style, ...rest }) {
  const icon = faIcons[name]
  if (!icon) return null

  const s = size ? { width: size, height: size } : null

  return (
    <svg
      className={'icn ' + className}
      viewBox={icon.vb || '0 0 512 512'}
      aria-hidden="true"
      focusable="false"
      style={s ? { ...s, ...style } : style}
      {...rest}
    >
      <path fill="currentColor" d={icon.d} />
    </svg>
  )
}
