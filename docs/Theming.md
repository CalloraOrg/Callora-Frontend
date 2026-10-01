# Theming

This document traces how theming works in the Callora Frontend, from the pre-paint inline script in `index.html` through to runtime theme transitions. Theme handling is split across four pieces that must stay in agreement:

- `idxex.html` — the pre-paint inline script that applies the theme before first paint.
- `src/ThemeContext.ts` — the Rune context that owns the current theme and persists changes.
- `src/ThemeToggle.tsx` — the UI control that cycles between light and dark.
- `src/styles/theme-transition.css` — the CSS that gates color transitions until the app is ready.

## Load order

1. The browser parses `index.html`. The inline script in the `<head>` runs before the body is painted. It reads the stored theme from `localStorage` under the key `callora-theme`, resolves `system` against `window.matchMedia('(prefers-color-scheme: dark)')`, and sets `data-theme` on `<html>`. This prevents a flash of the wrong theme because the correct theme is already on the root element before any pixel is drawn.
2. The main bundle loads and `ThemeProvider` mounts. `ThemeContext` initializes its state from the same sources the inline script used: the `callora-theme` localStorage key and the system color scheme media query. It also attaches a `matchMedia` listener so that when the user has `system` selected, the effective theme follows the operating system in real time.
3. `ThemeContext` writes `data-theme` on `document.documentElement` whenever the resolved theme changes and persists the selection to `localStorage`.
4. `ThemeToggle` calls into the context to change the theme. The context adds the `theme-transitions-ready` class to `<html>` on a later tick so the initial paint is not animated.
5. `src/styles/theme-transition.css` only enables color transitions when `theme-transitions-ready` is present on `<html>`. The `no-theme-transition` class is an escape hatch that suppresses transitions for a specific subtree or element.

## Storage key and allowed values

| Item | Value |
| --- | --- |
| Storage key | `callora-theme` |
| Allowed values | `light`, `dark`, `system` |
| Default when nothing is stored | `dark` |
| Resolved theme attribute | `data-theme="light"` or `data-theme="dark"` on `<html>` |

`light` and `dark` are the effective themes. `system` is a preference that resolves to `light` or `dark` based on `prefers-color-scheme`. The inline script and `ThemeContext` must agree on this key and these values; changing one without the other will regress to a flash of the wrong theme.

## Transition gating

Theme transitions are disabled by default and only become active once the app has mounted and applied the initial theme. This is controlled by the `theme-transitions-ready` class on `<html>`.

- `ThemeContext` adds `theme-transitions-ready` after the first render (e.g. in a `requestAnimationFrame` or `useEffect` tick).
- `src/styles/theme-transition.css` scopes its color transition rules under `html.theme-transitions-ready`.
- Because the class is added after the initial paint, loading the app never animates from the default to the stored theme.

## The `.no-theme-transition` escape hatch

Add the `no-theme-transition` class to an element or subtree to opt it out of theme color transitions. This is useful for elements that must snap to the new theme immediately, such as media, canvases, or components that manage their own animations.

```css
/* Example: this element will not animate when the theme changes. */
.no-theme-transition,
.no-theme-transition * {
  transition: none !important;
}
```

## Checklist for adding themed components

- [] Use CSS variables (e.g. `--color-background`, `--color-text`) rather than hard-coded colors.
- [] Verify the component renders correctly in both `data-theme="light"` and `data-theme="dark`"`.
- [] If the component must not animate during theme changes, add the `no-theme-transition` class.
- [] Do not read or write `data-theme` or the `callora-theme` localStorage key directly; use `ThemeContext`.
- [] If the component needs the resolved theme, consume it from `ThemeContext` so `system` is resolved consistently.
- [] Test the component with the existing theme tests (`npm test -- --run src/ThemeContext.test.tsx src/theme-transition.test.tsx`).
