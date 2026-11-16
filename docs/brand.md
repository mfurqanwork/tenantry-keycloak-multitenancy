# Tenantry brand

<p align="center"><img src="../packages/ui/assets/brand/tenantry-logo.svg" alt="Tenantry" width="336"></p>

## The mark

Five rounded tiles make a **T**. Each tile stands on its own, with clear space around it: separate workspaces, one platform. The tile where the bar meets the stem is opal, for the platform that holds the others together. Tenantry is a Pengopal product, so the mark wears the Pengopal brand: navy ink and the opal mosaic, as PengOPA does.

## Colours

| Name     | Value           | Use                                                         |
| -------- | --------------- | ----------------------------------------------------------- |
| Opal     | `opal-tile.png` | the one opal tile: a square cut from Pengopal's opal mosaic |
| Navy ink | `#12224a`       | the other tiles and the word on light backgrounds           |
| Pale     | `#eef2ff`       | the other tiles and the word on dark backgrounds            |

On light backgrounds the opal tile is deepened slightly, as on pengopal.com, so it holds against white.

## Type

The word "Tenantry" is set in Geist, semibold (600), as PengOPA's is. Where Geist isn't installed, the SVG falls back to Inter, then Segoe UI and the system face; the PNGs use Segoe UI.

## Use

- **Clear space:** keep at least a quarter of the mark's width empty around the mark or the logo.
- **Minimum size:** 16 px for the mark, 96 px wide for the logo.
- **Don't** stretch it, recolour the tiles, change which tile is opal, add shadows or outlines, or set the word in another typeface.

## Files

In `packages/ui/assets/brand/`:

| File                                                     | What                                                                          |
| -------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `tenantry-mark.svg`, `tenantry-mark-dark.svg`            | the mark alone, for light and dark backgrounds (the header follows the theme) |
| `tenantry-logo.svg`, `tenantry-logo-dark.svg`            | mark and word, for light and dark backgrounds                                 |
| `tenantry-logo-card.svg`                                 | the dark logo on its own black card; the README's, readable in any theme      |
| `favicon.svg`                                            | the mark, following the browser's light or dark scheme                        |
| `favicon-32.png`, `apple-touch-icon.png`, `icon-512.png` | rendered icons; the app icons put the mark on a navy tile                     |
| `opal-tile.png`                                          | the square of opal mosaic the SVGs embed                                      |
| `social-preview.png`                                     | 1280×640, for the GitHub repository's social preview                          |

`pnpm brand:icons` (`scripts/brand-icons.mjs`) writes the SVGs, with `opal-tile.png` embedded, and renders the PNGs. Change the script, not the SVGs, then run it and commit what it writes.
