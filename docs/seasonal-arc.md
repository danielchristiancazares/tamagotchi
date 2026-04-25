# Seasonal Arc Feature Specification

## Overview

The Seasonal Arc feature adds real-world seasonal decorations and atmosphere to the pet's world, creating a dynamic visual experience that changes month-to-month. The pet's environment subtly evolves with the seasons, providing delightful "check-in" moments without requiring player interaction.

## Seasons

| Season | Months | Decorations | Atmosphere | Particle Effects |
|--------|--------|-------------|------------|------------------|
| Spring | Mar, Apr, May | Flowers, butterflies | Soft pastel #E8F5E9 background | Floating petals |
| Summer | Jun, Jul, Aug | Sun rays, sparkles | Warm bright #FFFDE7 background | Golden floaters |
| Fall | Sep, Oct, Nov | Falling leaves | Muted warm #FFF8E1 background | Drifting leaves |
| Winter | Dec, Jan, Feb | Snow, icicles | Cool blue-gray #ECEFF1 background | Snowflakes |

## Implementation Plan

### 1. Season Detection

Add to `animator.js`:

```javascript
const SEASONS = {
  SPRING: { start: 2, end: 4, name: 'spring' },    // 0-indexed months
  SUMMER: { start: 5, end: 7, name: 'summer' },
  FALL:   { start: 8, end: 10, name: 'fall' },
  WINTER: { start: 11, end: 1, name: 'winter' }
};

_getSeason(month) {
  // month: 0-11 (JS Date convention)
  if (month >= 2 && month <= 4) return 'spring';
  if (month >= 5 && month <= 7) return 'summer';
  if (month >= 8 && month <= 10) return 'fall';
  return 'winter';
}
```

### 2. Background Color Overrides

Modify `_drawBackground()` to blend seasonal base color:

- **Spring**: #E8F5E9 base, subtle green tint overlay
- **Summer**: #FFFDE7 base, warm yellow tint  
- **Fall**: #FFF8E1 base, orange-brown tint
- **Winter**: #ECEFF1 base, cool blue-gray tint

Blend with existing day/night colors (see `animator.js:257-281`).

### 3. Seasonal Decoration Sprites

New sprites in `renderer/data/sprites/`:

| Filename | Description |
|---------|-------------|
| `season-spring-flower.png` | Pink/yellow flower clusters (16x16) |
| `season-spring-butterfly.png` | Small butterfly (8x8) |
| `season-summer-sunray.png` | Golden light rays (24x24) |
| `season-summer-sparkle.png` | Golden sparkle (8x8) |
| `season-fall-leaf1.png` | Orange maple leaf (12x12) |
| `season-fall-leaf2.png` | Brown oak leaf (12x12) |
| `season-winter-snowflake.png` | White snowflake (8x8) |
| `season-winter-icicle.png` | Blue icicle (8x16) |

### 4. Particle System Integration

Extend existing particle system (`_particles` array in animator.js):

**Spring particles:**
- Spawn rate: 1 per 3 seconds
- Type: 'petal' (drifting down, slight horizontal sway)
- Color: pink/white
- Max active: 5

**Summer particles:**
- Spawn rate: 1 per 2 seconds
- Type: 'sparkle' (fade in/out, static position)
- Color: gold
- Max active: 8

**Fall particles:**
- Spawn rate: 1 per 2 seconds
- Type: 'leaf' (drifting down with wind)
- Color: orange/brown/red
- Max active: 6

**Winter particles:**
- Spawn rate: 1 per second
- Type: 'snow' (falling with slight drift)
- Color: white
- Max active: 15

### 5. Holiday Overlays

Subtle decorations for specific dates:

- **Late Dec** (Dec 20-25): Small Christmas tree in corner, lights
- **Oct 31**: Extra orange particles, darker dusk
- **Feb 14**: Heart-shaped particles (Valentine's)
- **Jul 4** (if applicable): Subtle red/blue accents

### 6. Pet Behavior Integration (Optional)

If pet is autonomous, consider light seasonal behavior tweaks:

- **Winter**: Pet seeks warm station (bed) more often
- **Summer**: Pet plays more frequently 
- **Spring**: Random "happy" animations may include jumping
- **Fall**: More napping, cozy behavior

(Keep non-essential - core feature is visual.)

## Save Data

Season is computed from system clock on render - no save data needed. 

Holiday flag can be ephemeral (reset each check).

## Compatibility Notes

- Existing day/night system (`_cachedHour`) takes precedence over season
- Night override: darker colors, snowflakes continue in winter night
- Companion mode: Reduced particle count (max 3), simplified decorations
- Works with existing background sprite if present

## Files to Modify

1. `renderer/animator.js` - Add season detection, particle types, decorate `_drawBackground()`
2. `renderer/data/sprites/` - Add seasonal sprite PNGs
3. `renderer/animator.js` - Extend `SPRITE_PATHS` with new sprites

## Testing

- Verify background changes at month boundaries (mock `Date` in tests)
- Verify particles spawn at correct rates
- Verify companion mode particle limits
- Visual regression tests in `test/visual/`