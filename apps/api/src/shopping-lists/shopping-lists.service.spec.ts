import { ShoppingListsService } from './shopping-lists.service';
import type { PrismaService } from '../prisma/prisma.service';

describe('ShoppingListsService', () => {
  const service = new ShoppingListsService({} as PrismaService);

  describe('categorize', () => {
    it('maps produce and protein keywords', () => {
      expect(service.categorize('Fresh spinach')).toBe('produce');
      expect(service.categorize('Chicken breast')).toBe('protein');
    });

    it('returns other for unknown items', () => {
      expect(service.categorize('Mystery ingredient')).toBe('other');
    });
  });
});
