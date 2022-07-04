export const consoleModifiers = new Map([
  ['Reset', 0],
  ['Bright', 1],
  ['Dim', 2],
  ['Underscore', 4],
  ['Blink', 5],
  ['Reverse', 7],
  ['Hidden', 8]
])

export const consoleColors = new Map([
  ['FgBlack', 30],
  ['FgRed', 31],
  ['FgGreen', 32],
  ['FgYellow', 33],
  ['FgBlue', 34],
  ['FgMagenta', 35],
  ['FgCyan', 36],
  ['FgWhite', 37],

  ['BgBlack', 40],
  ['BgRed', 41],
  ['BgGreen', 42],
  ['BgYellow', 43],
  ['BgBlue', 44],
  ['BgMagenta', 45],
  ['BgCyan', 46],
  ['BgWhite', 47]
])

/**
 * color text for the terminal
 * resets at the end of the text
 *
 * @param {String} text what needs coloring
 * @param {String|Number} color either a named color or a number between 0-255
 * @param {String|String[]} [modifiers] optional modifiers like 'Dim', 'Brigth', 'Underline' ...
 * @returns {String} colored text
 */
export function ct (text, color, modifiers) {
  const termColor = typeof color === 'number' ? c256(color) : cc(color)
  let termModifiers = ''
  if (modifiers && typeof modifiers === 'string') {
    termModifiers = cm(modifiers)
  }
  if (modifiers && Array.isArray(modifiers)) {
    termModifiers = modifiers.map(cm)
  }
  return `${termModifiers}${termColor}${text}${cm('Reset')}`
}

/**
 * return terminal text modifier
 *
 * @param {String} name modifier name
 * @returns {String} terminal color
 */
export function cc (name) {
  if (!consoleColors.has(name)) {
    throw new Error('Unknown terminal color name:' + name)
  }
  return `\x1b[${consoleColors.get(name)}m`
}

/**
 * return terminal text modifier
 *
 * @param {String} name modifier name
 * @returns {String} terminal color
 */
export function cm (name) {
  if (!consoleModifiers.has(name)) {
    throw new Error('Unknown terminal modifier:' + name)
  }
  return `\x1b[${consoleModifiers.get(name)}m`
}

/**
 * get xterm256color
 *
 * @param {Number} number color number 0-255
 * @returns
 */
export function c256 (number) {
  if (number < 0 || number > 255) {
    throw new Error('Color out of range:', number)
  }
  return `\x1b[38;5;${number}m`
}
