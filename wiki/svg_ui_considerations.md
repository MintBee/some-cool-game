# SVG UI Development Considerations

Practical gotchas discovered while building the SVG+GSAP and DOM+GSAP prototypes. Each entry documents a silent failure or non-obvious behavior that future development should avoid.

---

## SVG Transform Origins Require Absolute Coordinates

**Apparent issue:** `transformOrigin: '50% 50%'` on an SVG `<g>` element causes the animation to pivot from the wrong point — no error, just incorrect visual behavior.

**Why it fails:** SVG `<g>` elements have no intrinsic width or height, so percentage-based origins resolve to nothing.

**Correct approach:** Use GSAP's `svgOrigin` with absolute pixel coordinates calculated from the element's known position and size:

```js
gsap.set(group, {
  svgOrigin: `${x + width / 2} ${y + height / 2}`,
});
```

---

## GSAP `attr: {}` Wrapper Required for SVG Attributes

**Apparent issue:** `tl.to(el, { stroke: 'red', r: 20 })` silently does nothing on SVG elements.

**Why it fails:** `stroke`, `stroke-width`, `r`, `cx`, `cy` are SVG attributes, not CSS properties. GSAP treats bare properties as CSS by default.

**Correct approach:** Wrap SVG attributes in the `attr` object:

```js
tl.to(el, { attr: { stroke: '#fbbf24', 'stroke-width': 3, r: 20 } });
```

---

## GSAP `addPause()` Halts Timeline Permanently

**Apparent issue:** Using `tl.addPause('+=0.5')` to insert a gap between animation phases causes the timeline to freeze. The demo never reaches subsequent tweens.

**Why it fails:** `addPause()` literally pauses the timeline and requires a manual `.play()` call to resume — it is not a delay.

**Correct approach:** Use a spacer tween with an empty target:

```js
tl.to({}, { duration: 0.5 }); // non-blocking gap
```

---

## Timeline Labels with Relative Offsets Cause Sequencing Issues

**Apparent issue:** Using label-based positioning like `lane0+=0.7` leads to overlapping or mis-ordered tweens, especially when some lanes have conditional steps (e.g., card flip on some lanes but not others).

**Why it fails:** Relative label offsets are calculated from a fixed point. When conditional branches add or skip tweens, the offsets no longer reflect the actual timeline position.

**Correct approach:** Use sequential `tl.to()` calls. Each tween appends after the previous one, so conditional branches naturally extend the timeline:

```js
if (needsFlip) {
  tl.to(card, { scaleX: 0, duration: 0.2 });
  tl.to(card, { scaleX: 1, duration: 0.2 });
}
// This always runs after the flip (or immediately if no flip)
tl.to(winner, { ... });
```

---

## Dynamic SVG Elements Require `createElementNS`

**Apparent issue:** `document.createElement('circle')` produces an element that appears in the DOM tree but does not render or behave as an SVG element.

**Why it fails:** Without the SVG namespace, the browser treats it as an unknown HTML element, not an SVG primitive.

**Correct approach:** Always use the SVG namespace URI:

```js
document.createElementNS('http://www.w3.org/2000/svg', 'circle');
```

---

## Effect Element Cleanup is Critical for Replay

**Apparent issue:** Clicking "Play Demo" multiple times causes VFX elements to accumulate — old slash lines, explosion circles, etc. persist underneath new ones.

**Why it fails:** Dynamically created effect elements are appended to the DOM/SVG during timeline execution but are not automatically removed when the timeline completes or restarts.

**Correct approach:** Tag all dynamic effect elements and remove them before creating a new timeline:

```js
// When creating:
el.dataset.effect = 'true';

// Before new timeline:
svgEl.querySelectorAll('[data-effect]').forEach(el => el.remove());
```

---

## `npx` vs `pnpm exec` in Monorepos

**Apparent issue:** `npx vite build` from the workspace root fails or uses wrong dependencies, even though `vite` is installed in the package.

**Why it fails:** `npx` resolves to a globally cached binary that lacks the workspace's local dependencies (Preact, GSAP plugins, etc.).

**Correct approach:** Run from within the package directory using the workspace package manager:

```bash
cd sources/prototype-svg && pnpm exec vite build
```
