import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard';
import { JwtStrategy } from '../src/auth/jwt.strategy';
import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { RecipeCommunityService } from '../src/recipe-feedback/recipe-community.service';
import { RecipeFeedbackController } from '../src/recipe-feedback/recipe-feedback.controller';
import { RecipeFeedbackService } from '../src/recipe-feedback/recipe-feedback.service';

function testEnv() {
  return {
    DATABASE_URL:
      process.env.DATABASE_URL ??
      'postgresql://postgres:postgres@127.0.0.1:15432/numbers?schema=public',
    REDIS_URL: process.env.REDIS_URL ?? 'redis://127.0.0.1:6379',
    JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET ?? '0'.repeat(32),
    JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET ?? '0'.repeat(32),
  };
}

function buildFeedbackModule() {
  return Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        ignoreEnvFile: true,
        load: [testEnv],
      }),
      PrismaModule,
      PassportModule.register({ defaultStrategy: 'jwt' }),
      JwtModule.register({
        secret: process.env.JWT_ACCESS_SECRET ?? '0'.repeat(32),
        signOptions: { expiresIn: '15m' },
      }),
    ],
    controllers: [RecipeFeedbackController],
    providers: [RecipeFeedbackService, RecipeCommunityService, JwtStrategy],
  });
}

async function initApp(
  moduleFixture: TestingModule,
): Promise<INestApplication<App>> {
  const app = moduleFixture.createNestApplication();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.init();
  return app;
}

describe('Recipe feedback auth (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture = await buildFeedbackModule().compile();
    app = await initApp(moduleFixture);
  });

  afterAll(async () => {
    await app?.close();
  });

  it('POST /api/recipe-feedback requires authentication', () => {
    return request(app.getHttpServer())
      .post('/api/recipe-feedback')
      .send({ recipeId: 'r0001', rating: 5 })
      .expect(401);
  });
});

describe('Recipe feedback (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let dbAvailable = false;
  let userId = '';
  const testEmail = `e2e-feedback-${Date.now()}@test.local`;
  const recipeId = 'r0001';

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) {
      console.warn(
        'DATABASE_URL not set — skipping recipe feedback DB e2e (set in apps/api/.env).',
      );
      return;
    }

    const moduleFixture = await buildFeedbackModule()
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: {
          switchToHttp: () => { getRequest: () => { user?: unknown } };
        }) => {
          const req = context.switchToHttp().getRequest();
          req.user = { userId, email: testEmail };
          return true;
        },
      })
      .compile();

    app = await initApp(moduleFixture);
    prisma = app.get(PrismaService);

    try {
      await prisma.$queryRaw`SELECT 1`;
      const user = await prisma.user.create({
        data: {
          email: testEmail,
          passwordHash: 'e2e-test-hash',
          emailVerifiedAt: new Date(),
        },
      });
      userId = user.id;
      dbAvailable = true;
    } catch (err) {
      const hint =
        err instanceof Error &&
        err.message.includes('role "postgres" does not exist')
          ? ' Your DATABASE_URL uses user postgres, but this Postgres has no such role. For Docker use port 15432 (see .env.example); on macOS Homebrew use your OS username in the URL.'
          : ' Start Postgres (pnpm compose:up) or fix DATABASE_URL in apps/api/.env.';
      console.warn(
        `Database not reachable — skipping recipe feedback DB e2e.${hint}`,
      );
      dbAvailable = false;
    }
  });

  afterAll(async () => {
    if (dbAvailable && prisma && userId) {
      await prisma.recipeFeedback.deleteMany({ where: { userId } });
      await prisma.user
        .delete({ where: { id: userId } })
        .catch(() => undefined);
    }
    await app?.close();
  });

  it('POST star-only rating then GET /api/recipe-feedback/recipe/:id', async () => {
    if (!dbAvailable) return;

    const recipe = await prisma.recipe.findUnique({ where: { id: recipeId } });
    if (!recipe) {
      console.warn(
        `Recipe ${recipeId} not found — run pnpm nutrition:seed for full e2e coverage.`,
      );
      return;
    }

    await request(app.getHttpServer())
      .post('/api/recipe-feedback')
      .send({ recipeId, rating: 5 })
      .expect(201);

    const res = await request(app.getHttpServer())
      .get(`/api/recipe-feedback/recipe/${recipeId}`)
      .expect(200);

    const body = res.body as {
      communityRatingCount: number;
      myFeedback: { rating: number } | null;
    };
    expect(body.communityRatingCount).toBeGreaterThanOrEqual(1);
    expect(body.myFeedback?.rating).toBe(5);
  });
});
