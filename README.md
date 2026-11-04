# Piper Clean GitHub Baseline
Upload the contents of this folder directly to the root of the empty `Piper` GitHub repository.

## Brand source of truth
- Header logo: `public/assets/piper-logo.png`
- Home Screen source icon: `public/icons/piper-icon-cream.png`
- Generated app sizes: 180, 192, and 512 PNGs in `public/icons/`

The current app source supplied by the user is preserved in `src/App.tsx`, with only the Brand renderer replaced so the approved PNG cannot render at its native oversized dimensions.

GitHub Pages uses the included `.github/workflows/deploy.yml` and `/Piper/` Vite base.
