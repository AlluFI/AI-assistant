import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SHOPPING_CATEGORIES } from '../shared/dietary-catalog';

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  produce: [
    'tomato',
    'cucumber',
    'lettuce',
    'onion',
    'garlic',
    'pepper',
    'spinach',
    'carrot',
    'broccoli',
    'apple',
    'banana',
    'lemon',
    'herb',
  ],
  dairy: ['milk', 'cheese', 'yogurt', 'butter', 'cream', 'feta', 'mozzarella'],
  protein: [
    'chicken',
    'beef',
    'pork',
    'fish',
    'salmon',
    'tuna',
    'egg',
    'tofu',
    'lentil',
    'bean',
    'turkey',
  ],
  grains: ['rice', 'quinoa', 'oats', 'pasta', 'bread', 'flour', 'noodle'],
  pantry: [
    'oil',
    'salt',
    'pepper',
    'spice',
    'vinegar',
    'honey',
    'sugar',
    'stock',
  ],
  frozen: ['frozen'],
  beverages: ['water', 'juice', 'coffee', 'tea'],
};

@Injectable()
export class ShoppingListsService {
  constructor(private readonly prisma: PrismaService) {}

  categorize(name: string): string {
    const lower = name.toLowerCase();
    for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
      if (keywords.some((k) => lower.includes(k))) return cat;
    }
    return 'other';
  }

  async generateFromVersion(userId: string, versionId: string, title?: string) {
    const version = await this.prisma.mealPlanVersion.findFirst({
      where: { id: versionId, mealPlan: { userId } },
      include: {
        meals: {
          include: {
            recipe: { include: { ingredients: true } },
          },
        },
      },
    });
    if (!version) throw new NotFoundException('Meal plan version not found');
    if (version.meals.some((meal) => !meal.recipeId)) {
      throw new BadRequestException(
        'Confirm meal plan recipes before creating a shopping list.',
      );
    }

    const aggregated = new Map<
      string,
      {
        name: string;
        ingredientId?: string;
        quantityGrams: number;
        quantityMl: number;
      }
    >();

    for (const meal of version.meals) {
      if (!meal.recipe) continue;
      for (const ri of meal.recipe.ingredients) {
        const key = ri.ingredientId;
        const existing = aggregated.get(key);
        if (existing) {
          existing.quantityGrams += ri.quantity;
        } else {
          aggregated.set(key, {
            name: ri.name,
            ingredientId: ri.ingredientId,
            quantityGrams: ri.quantity,
            quantityMl: 0,
          });
        }
      }
    }
    if (aggregated.size === 0) {
      throw new BadRequestException(
        'No recipe ingredients available for this meal plan version.',
      );
    }

    const list = await this.prisma.shoppingList.create({
      data: {
        userId,
        mealPlanVersionId: versionId,
        title: title ?? `Shopping list — ${version.versionLabel}`,
        items: {
          create: [...aggregated.values()].map((item) => ({
            name: item.name,
            ingredientId: item.ingredientId,
            category: this.categorize(item.name),
            quantityGrams: item.quantityGrams,
            quantityMl: item.quantityMl || null,
          })),
        },
      },
      include: { items: true },
    });
    return list;
  }

  async generateFromMeal(
    userId: string,
    versionId: string,
    mealId: string,
    title?: string,
  ) {
    const meal = await this.prisma.plannedMeal.findFirst({
      where: {
        id: mealId,
        versionId,
        version: { mealPlan: { userId } },
      },
      include: {
        recipe: { include: { ingredients: true } },
      },
    });
    if (!meal) throw new NotFoundException('Meal not found');
    if (!meal.recipe) {
      throw new BadRequestException(
        'Confirm recipes first. This meal has no linked recipe ingredients yet.',
      );
    }
    const items = meal.recipe.ingredients.map((ingredient) => ({
      name: ingredient.name,
      ingredientId: ingredient.ingredientId,
      category: this.categorize(ingredient.name),
      quantityGrams: ingredient.quantity,
      quantityMl: null,
    }));

    const list = await this.prisma.shoppingList.create({
      data: {
        userId,
        mealPlanVersionId: versionId,
        title: title ?? `Shopping list — ${meal.title}`,
        items: {
          create: items,
        },
      },
      include: { items: true },
    });
    return list;
  }

  async list(userId: string) {
    return this.prisma.shoppingList.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { items: true },
    });
  }

  async updateItem(
    userId: string,
    listId: string,
    itemId: string,
    data: { quantityGrams?: number; quantityMl?: number; excluded?: boolean },
  ) {
    await this.assertListOwner(userId, listId);
    return this.prisma.shoppingListItem.update({
      where: { id: itemId, shoppingListId: listId },
      data,
    });
  }

  async deleteItem(userId: string, listId: string, itemId: string) {
    await this.assertListOwner(userId, listId);
    await this.prisma.shoppingListItem.delete({
      where: { id: itemId, shoppingListId: listId },
    });
    return { ok: true };
  }

  categories() {
    return SHOPPING_CATEGORIES;
  }

  private async assertListOwner(userId: string, listId: string) {
    const list = await this.prisma.shoppingList.findFirst({
      where: { id: listId, userId },
    });
    if (!list) throw new NotFoundException('Shopping list not found');
  }
}
