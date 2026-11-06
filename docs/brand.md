# Tenantry brand

<p align="center"><img src="../packages/ui/assets/brand/tenantry-logo.svg" alt="Tenantry" width="336"></p>

## The mark

Five square tiles make a **T**. Each tile stands on its own, with clear space around it: separate workspaces, one platform. The tile where the bar meets the stem is blue, for the platform that holds the others together.

## Colours

| Name     | Hex       | Use                                                  |
| -------- | --------- | ---------------------------------------------------- |
| Blue 60  | `#0f62fe` | the one blue tile; also the default workspace colour |
| Gray 100 | `#161616` | the other tiles and the word on light backgrounds    |
| Gray 10  | `#f4f4f4` | the other tiles and the word on dark backgrounds     |

These are IBM Carbon's own colours, so the brand sits with the Carbon UI without new tokens.

## Type

The word "Tenantry" is set in IBM Plex Sans, semibold (600). Where Plex isn't installed, the SVG falls back to Helvetica Neue, then Arial.

## Use

- **Clear space:** keep at least a quarter of the mark's width empty around the mark or the logo.
- **Minimum size:** 16 px for the mark, 96 px wide for the logo.
- **Don't** stretch it, recolour the tiles, change which tile is blue, add shadows or outlines, or set the word in another typeface.

## Files

In `packages/ui/assets/brand/`:

| File                                                     | What                                                                     |
| -------------------------------------------------------- | ------------------------------------------------------------------------ |
| `tenantry-mark.svg`, `tenantry-mark-dark.svg`            | the mark alone, for light and dark backgrounds (the app header is dark)  |
| `tenantry-logo.svg`, `tenantry-logo-dark.svg`            | mark and word, for light and dark backgrounds                            |
| `tenantry-logo-card.svg`                                 | the dark logo on its own black card; the README's, readable in any theme |
| `favicon.svg`                                            | the mark, following the browser's light or dark scheme                   |
| `favicon-32.png`, `apple-touch-icon.png`, `icon-512.png` | rendered icons                                                           |
| `social-preview.png`                                     | 1280×640, for the GitHub repository's social preview                     |

The SVGs are written by hand. After changing one, run `pnpm brand:icons` to render the PNGs again, and commit them.
