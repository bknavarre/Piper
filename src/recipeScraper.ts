export type ScrapedRecipe = {
  title: string;
  image: string;
  servings: number;
  time: number;
  ingredients: string[];
  instructions: string[];
  tags: string[];
  sourceName: string;
  sourceUrl: string;
};

export async function scrapeRecipe(url: string): Promise<ScrapedRecipe> {
  const endpoint =
    (import.meta as any).env?.VITE_RECIPE_SCRAPER_URL || '';

  if (!endpoint) {
    throw new Error(
      'Recipe web importer is not configured yet.'
    );
  }

  const cleanUrl = url.trim();

  if (!/^https?:\/\//i.test(cleanUrl)) {
    throw new Error(
      'Paste the full recipe webpage address beginning with http:// or https://.'
    );
  }

  const response = await fetch(
    endpoint.replace(/\/+$/, '') +
      '?url=' +
      encodeURIComponent(cleanUrl)
  );

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'Could not import recipe.');
  }

  const recipe = await response.json();

  if (
    !recipe ||
    !recipe.title ||
    !Array.isArray(recipe.ingredients) ||
    !Array.isArray(recipe.instructions)
  ) {
    throw new Error(
      'A complete recipe could not be found on that webpage.'
    );
  }

  return recipe as ScrapedRecipe;
}
