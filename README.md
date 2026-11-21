# Panopticon Sentinel website

Landing page (with a 7-slide presentation) and pricing page for Panopticon Sentinel.
Static HTML, CSS and JavaScript: no build step, no external requests (fonts are self-hosted).

| File | What it is |
| --- | --- |
| `index.html` | Landing page: hero, the case in 7 slides, worked example, advantages, dashboard |
| `pricing.html` | Four plans, seat calculator, volume discounts, getting started, FAQ |
| `404.html` | Not-found page served by GitHub Pages |
| `privacy.html` | Privacy notice for the website (no cookies or tracking; GitHub Pages hosting; email contact) |
| `assets/site.css` | Design tokens and styles (Slate theme from the Sentinel dashboard, light and dark) |
| `assets/site.js` | Theme toggle, Game of Life hero, presentation controls, pricing calculator, demo video chapters |
| `assets/video/` | The 2-minute demo video: a light and a dark silent recording that match frame for frame (WebM VP9 + MP4 H.264, posters) and one music track (Bach, Prelude in C, synthesised; Opus + AAC). The music keeps time; the page crossfades the pictures when the theme changes |

## Run locally

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

## Publish on GitHub Pages

Settings → Pages → Build and deployment → Source: **Deploy from a branch**, branch `main`, folder `/ (root)`.
The site is then served at `https://dit-commit.github.io/sentinel/`. `.nojekyll` makes Pages serve the files as they are.

On a custom domain, add a `CNAME` file with the domain and change `<base href="/sentinel/">` in `404.html` to `/`.


## Cache busting

GitHub Pages lets browsers cache files for 10 minutes. The pages load `assets/site.css?v=…` and
`assets/site.js?v=…`: change the `v=` value in `index.html`, `pricing.html` and `404.html` whenever
you change the CSS or JS, so a new page never runs with an old stylesheet.
