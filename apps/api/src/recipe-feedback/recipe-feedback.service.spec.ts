import { ConfigService } from '@nestjs/config';
import { RecipeFeedbackService } from './recipe-feedback.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { RecipeCommunityService } from './recipe-community.service';

describe('RecipeFeedbackService', () => {
  function createService(moderatorEmails?: string) {
    const config = {
      get: jest.fn((key: string) =>
        key === 'RECIPE_MODERATOR_EMAILS' ? moderatorEmails : undefined,
      ),
    } as unknown as ConfigService;
    return new RecipeFeedbackService(
      {} as PrismaService,
      config,
      {} as RecipeCommunityService,
    );
  }

  describe('isModerator', () => {
    it('matches emails case-insensitively', () => {
      const service = createService('Admin@Example.com, demo@numbers.local');
      expect(service.isModerator('admin@example.com')).toBe(true);
      expect(service.isModerator('DEMO@numbers.local')).toBe(true);
    });

    it('returns false for non-listed emails', () => {
      const service = createService('demo@numbers.local');
      expect(service.isModerator('other@example.com')).toBe(false);
    });

    it('falls back to demo@numbers.local when env is unset', () => {
      const service = createService(undefined);
      expect(service.isModerator('demo@numbers.local')).toBe(true);
      expect(service.isModerator('not-moderator@test.com')).toBe(false);
    });
  });
});
