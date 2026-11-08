# Web recipe importer
GitHub Pages cannot fetch arbitrary recipe pages directly because browser CORS rules block many sites. The included `worker/` folder is a Cloudflare Worker that performs server-side retrieval and parses Schema.org Recipe JSON-LD (`recipeIngredient`, `recipeInstructions`, `image`, `recipeYield`, times, categories, keywords).

Deploy once:
1. Create a free Cloudflare account and a Worker.
2. From `worker/`, run `npx wrangler deploy` or paste `worker/src/index.js` into the Cloudflare Worker editor.
3. Copy the resulting `https://...workers.dev` URL.
4. In GitHub Actions/build environment set `VITE_RECIPE_SCRAPER_URL` to that URL, or create `.env.production` containing `VITE_RECIPE_SCRAPER_URL=https://...workers.dev`.

Until this URL is configured, the app reports that the recipe web importer is not configured rather than pretending a browser-only scrape succeeded.
