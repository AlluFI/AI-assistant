import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { JwtStrategy } from '../src/auth/jwt.strategy';
import { PrismaModule } from '../src/prisma/prisma.module';
import { MealPlansController } from '../src/meal-plans/meal-plans.controller';
import { MealPlansService } from '../src/meal-plans/meal-plans.service';
import { RecipesController } from '../src/recipes/recipes.controller';
import { RecipesService } from '../src/recipes/recipes.service';

function testEnv() {
  return {
    JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET ?? '0'.repeat(32),
    JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET ?? '0'.repeat(32),
  };
}

describe('Nutrition routes auth (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
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
      controllers: [MealPlansController, RecipesController],
      providers: [
        JwtStrategy,
        {
          provide: MealPlansService,
          useValue: { list: jest.fn(), generate: jest.fn() },
        },
        {
          provide: RecipesService,
          useValue: { search: jest.fn(), getById: jest.fn() },
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('GET /api/meal-plans requires authentication', () => {
    return request(app.getHttpServer()).get('/api/meal-plans').expect(401);
  });

  it('POST /api/meal-plans/generate requires authentication', () => {
    return request(app.getHttpServer())
      .post('/api/meal-plans/generate')
      .send({
        duration: 'daily',
        startDate: '2026-06-01',
      })
      .expect(401);
  });

  it('GET /api/recipes requires authentication', () => {
    return request(app.getHttpServer()).get('/api/recipes?q=salad').expect(401);
  });
});
