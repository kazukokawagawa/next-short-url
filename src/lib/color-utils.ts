/** WCAG helpers for configurable brand colors. */
export function relativeLuminance(hex: string): number {
    const normalized = /^#[0-9a-f]{6}$/i.test(hex) ? hex : '#1a1a1f'
    const channels = [1, 3, 5].map(offset => parseInt(normalized.slice(offset, offset + 2), 16) / 255)
    const linear = channels.map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
    return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722
}

export function contrastRatio(a: string, b: string): number {
    const values = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x)
    return (values[0] + 0.05) / (values[1] + 0.05)
}

/** Preserve the public HEX -> OKLCH API used by the theme provider. */
export function hexToOklch(hex: string): string {
    const cleanHex = (/^#[0-9a-f]{6}$/i.test(hex) ? hex : '#1a1a1f').slice(1)
    const rgb = [0, 2, 4].map(offset => parseInt(cleanHex.slice(offset, offset + 2), 16) / 255)
    const linear = rgb.map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
    const [r, g, b] = linear
    const x = 0.4124564 * r + 0.3575761 * g + 0.1804375 * b
    const y = 0.2126729 * r + 0.7151522 * g + 0.0721750 * b
    const z = 0.0193339 * r + 0.1191920 * g + 0.9503041 * b
    const lms = [
        0.8189330101 * x + 0.3618667424 * y - 0.1288597137 * z,
        0.0329845436 * x + 0.9293118715 * y + 0.0361456387 * z,
        0.0482003018 * x + 0.2643662691 * y + 0.6338517070 * z,
    ].map(Math.cbrt)
    const lightness = 0.2104542553 * lms[0] + 0.7936177850 * lms[1] - 0.0040720468 * lms[2]
    const a = 1.9779984951 * lms[0] - 2.4285922050 * lms[1] + 0.4505937099 * lms[2]
    const labB = 0.0259040371 * lms[0] + 0.7827717662 * lms[1] - 0.8086757660 * lms[2]
    let hue = Math.atan2(labB, a) * (180 / Math.PI)
    if (hue < 0) hue += 360
    return `oklch(${Math.round(lightness * 1000) / 1000} ${Math.round(Math.sqrt(a * a + labB * labB) * 1000) / 1000} ${Math.round(hue * 1000) / 1000})`
}

function accessibleBrand(hex: string, background: string) {
    let primary = /^#[0-9a-f]{6}$/i.test(hex) ? hex : '#1a1a1f'
    const target = background === '#ffffff' ? 0 : 255
    for (let step = 0; contrastRatio(primary, background) < 4.5 && step < 256; step++) {
        primary = '#' + [1, 3, 5].map(offset => {
            const channel = parseInt(primary.slice(offset, offset + 2), 16)
            return Math.max(0, Math.min(255, channel + Math.sign(target - channel))).toString(16).padStart(2, '0')
        }).join('')
    }
    return {
        primary: hexToOklch(primary),
        primaryForeground: contrastRatio(primary, '#ffffff') >= contrastRatio(primary, '#000000') ? '#ffffff' : '#000000'
    }
}

export function generatePrimaryColors(hex: string) { return accessibleBrand(hex, '#ffffff') }
export function generateDarkModePrimaryColors(hex: string) { return accessibleBrand(hex, '#18181b') }
