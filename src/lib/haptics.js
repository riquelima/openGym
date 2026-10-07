// Mobile haptic feedback engine for iOS and touch devices.
// Uses Web Vibration API and degrades gracefully if not available.
import { vibrate } from './sound.js'

export function hapticLight() {
  vibrate(8)
}

export function hapticMedium() {
  vibrate(18)
}

export function hapticHeavy() {
  vibrate(35)
}

export function hapticSuccess() {
  vibrate([12, 35, 18])
}

export function hapticSelection() {
  vibrate(5)
}

export function hapticImpact() {
  vibrate(22)
}

export function haptic(type = 'light') {
  if (type === 'selection') hapticSelection()
  else if (type === 'medium') hapticMedium()
  else if (type === 'heavy') hapticHeavy()
  else if (type === 'success') hapticSuccess()
  else if (type === 'impact') hapticImpact()
  else hapticLight()
}
