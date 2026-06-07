import { plainToInstance } from 'class-transformer';
import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

class EnvironmentVariables {
  @IsString()
  @IsNotEmpty()
  DATABASE_URL!: string;

  @IsString()
  @IsNotEmpty()
  REDIS_URL!: string;

  @IsString()
  @MinLength(32)
  JWT_ACCESS_SECRET!: string;

  @IsString()
  @MinLength(32)
  JWT_REFRESH_SECRET!: string;

  @IsNumber()
  @Min(60)
  @IsOptional()
  JWT_ACCESS_EXPIRES_SEC?: number;

  @IsNumber()
  @Min(300)
  @IsOptional()
  JWT_REFRESH_EXPIRES_SEC?: number;

  @IsString()
  @IsOptional()
  MAIL_HOST?: string;

  @IsNumber()
  @Min(1)
  @IsOptional()
  MAIL_PORT?: number;

  @IsString()
  @IsOptional()
  MAIL_USER?: string;

  @IsString()
  @IsOptional()
  MAIL_PASS?: string;

  @IsString()
  @IsOptional()
  MAIL_FROM?: string;

  @IsString()
  @IsOptional()
  WEB_APP_URL?: string;

  @IsString()
  @IsOptional()
  OAUTH_CALLBACK_BASE?: string;

  @IsString()
  @IsOptional()
  GOOGLE_CLIENT_ID?: string;

  @IsString()
  @IsOptional()
  GOOGLE_CLIENT_SECRET?: string;

  @IsString()
  @IsOptional()
  GITHUB_CLIENT_ID?: string;

  @IsString()
  @IsOptional()
  GITHUB_CLIENT_SECRET?: string;

  @IsString()
  @IsOptional()
  OPENAI_API_KEY?: string;

  @IsString()
  @IsOptional()
  AI_MODEL?: string;

  @IsString()
  @IsOptional()
  ANTHROPIC_API_KEY?: string;

  @IsString()
  @IsOptional()
  GEMINI_API_KEY?: string;

  @IsString()
  @IsOptional()
  GEMINI_VISION_MODEL?: string;

  @IsString()
  @IsOptional()
  MEAL_PHOTO_MAX_BYTES?: string;

  @IsString()
  @IsOptional()
  RECIPE_MODERATOR_EMAILS?: string;

  @IsString()
  @IsOptional()
  ASSISTANT_MODEL?: string;

  @IsString()
  @IsOptional()
  ASSISTANT_OPENAI_MODEL?: string;

  @IsString()
  @IsOptional()
  ASSISTANT_RESPONSE_MODE?: string;

  @IsString()
  @IsOptional()
  ASSISTANT_LLM_PROVIDER?: string;

  @IsString()
  @IsOptional()
  ASSISTANT_ENABLED?: string;

  @IsString()
  @IsOptional()
  PORT?: string;

  @IsString()
  @IsOptional()
  NODE_ENV?: string;

  @IsBoolean()
  @IsOptional()
  COOKIE_SECURE?: boolean;

  @IsBoolean()
  @IsOptional()
  AUTH_REFRESH_COOKIE_ONLY?: boolean;

  @IsNumber()
  @Min(1)
  @IsOptional()
  DELETE_RETENTION_DAYS?: number;

  @IsString()
  @IsOptional()
  PURGE_ADMIN_SECRET?: string;

  @IsString()
  @IsOptional()
  PURGE_ADMIN_EMAILS?: string;
}

export function validateEnv(config: Record<string, unknown>) {
  const normalized = { ...config };
  if (
    normalized.MAIL_PORT !== undefined &&
    typeof normalized.MAIL_PORT === 'string'
  ) {
    normalized.MAIL_PORT = Number(normalized.MAIL_PORT);
  }
  if (
    normalized.JWT_ACCESS_EXPIRES_SEC !== undefined &&
    typeof normalized.JWT_ACCESS_EXPIRES_SEC === 'string'
  ) {
    normalized.JWT_ACCESS_EXPIRES_SEC = Number(
      normalized.JWT_ACCESS_EXPIRES_SEC,
    );
  }
  if (
    normalized.JWT_REFRESH_EXPIRES_SEC !== undefined &&
    typeof normalized.JWT_REFRESH_EXPIRES_SEC === 'string'
  ) {
    normalized.JWT_REFRESH_EXPIRES_SEC = Number(
      normalized.JWT_REFRESH_EXPIRES_SEC,
    );
  }
  if (
    normalized.COOKIE_SECURE !== undefined &&
    typeof normalized.COOKIE_SECURE === 'string'
  ) {
    normalized.COOKIE_SECURE = normalized.COOKIE_SECURE === 'true';
  }
  if (
    normalized.AUTH_REFRESH_COOKIE_ONLY !== undefined &&
    typeof normalized.AUTH_REFRESH_COOKIE_ONLY === 'string'
  ) {
    normalized.AUTH_REFRESH_COOKIE_ONLY =
      normalized.AUTH_REFRESH_COOKIE_ONLY === 'true';
  }
  if (
    normalized.DELETE_RETENTION_DAYS !== undefined &&
    typeof normalized.DELETE_RETENTION_DAYS === 'string'
  ) {
    normalized.DELETE_RETENTION_DAYS = Number(normalized.DELETE_RETENTION_DAYS);
  }

  const validated = plainToInstance(EnvironmentVariables, normalized, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validated, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    const messages = errors
      .map((e) => Object.values(e.constraints ?? {}).join(', '))
      .join('; ');
    throw new Error(`Invalid environment: ${messages}`);
  }

  return validated as unknown as Record<string, unknown>;
}
