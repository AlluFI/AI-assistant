import {
  extractCreateRecipeQuery,
  inferCreateRecipeCta,
  resolveCreateRecipePayload,
  userWantsRecipeSaved,
} from './wingman-create-recipe.util';
import { parseCreateRecipeIntent } from './wingman-intent';

describe('wingman create recipe', () => {
  it('extracts query from create recipe phrases', () => {
    expect(
      extractCreateRecipeQuery(
        'Create a recipe for high-protein vegan buddha bowl with tahini',
      ),
    ).toBe('high-protein vegan buddha bowl with tahini');
    expect(
      extractCreateRecipeQuery(
        'Save spicy lentil soup to the recipe catalog',
      ),
    ).toBe('spicy lentil soup');
  });

  it('parseCreateRecipeIntent requires recipe/catalog wording', () => {
    expect(
      parseCreateRecipeIntent(
        'Create a recipe for gluten-free banana pancakes',
      ),
    ).toEqual({
      query: 'gluten-free banana pancakes',
      meal: undefined,
    });
    expect(parseCreateRecipeIntent('Find banana pancakes')).toBeNull();
  });

  it('offers CTA after empty search_recipes', () => {
    const cta = inferCreateRecipeCta('Find tahini buddha bowl recipes', [
      {
        name: 'search_recipes',
        args: { query: 'tahini buddha bowl' },
        result: { count: 0, query: 'tahini buddha bowl' },
      },
    ]);
    expect(cta?.action).toBe('confirm_create_recipe');
    expect(cta?.payload?.query).toBe('tahini buddha bowl');
  });

  it('does not offer CTA when search has results unless user asks to save', () => {
    expect(
      inferCreateRecipeCta('Show chicken recipes', [
        {
          name: 'search_recipes',
          args: { query: 'chicken' },
          result: { count: 3, query: 'chicken' },
        },
      ]),
    ).toBeNull();
    expect(userWantsRecipeSaved('Save a custom recipe to the catalog')).toBe(
      true,
    );
    expect(
      resolveCreateRecipePayload('Save a custom recipe to the catalog', [
        {
          name: 'search_recipes',
          args: { query: 'chicken' },
          result: { count: 3, query: 'chicken' },
        },
      ]),
    ).not.toBeNull();
  });
});
