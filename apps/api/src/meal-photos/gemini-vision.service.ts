import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { DetectedFoodItem } from './meal-photo.types';

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

@Injectable()
export class GeminiVisionService {
  private readonly timeoutMs = 45_000;

  constructor(private readonly config: ConfigService) {}

  get isConfigured(): boolean {
    return Boolean(this.config.get<string>('GEMINI_API_KEY')?.trim());
  }

  get model(): string {
    return (
      this.config.get<string>('GEMINI_VISION_MODEL')?.trim() ||
      'gemini-2.0-flash'
    );
  }

  validateImage(file: Express.Multer.File) {
    const maxBytes = Number(
      this.config.get<string>('MEAL_PHOTO_MAX_BYTES') ?? 5_242_880,
    );
    if (!file?.buffer?.length) {
      throw new BadRequestException('Image file is required');
    }
    if (!ALLOWED_MIME.has(file.mimetype)) {
      throw new BadRequestException('Image must be JPEG, PNG, or WebP');
    }
    if (file.size > maxBytes) {
      throw new BadRequestException(
        `Image too large (max ${Math.round(maxBytes / 1024 / 1024)} MB)`,
      );
    }
  }

  async detectFoods(
    file: Express.Multer.File,
    hints?: { mealType?: string; date?: string },
  ): Promise<{ description: string; items: DetectedFoodItem[] }> {
    const apiKey = this.config.get<string>('GEMINI_API_KEY')?.trim();
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'GEMINI_API_KEY is not configured for meal photo analysis',
      );
    }

    const mealHint = hints?.mealType ? `Meal type hint: ${hints.mealType}.` : '';
    const prompt = `You are a meal photo analyst. Identify visible foods and estimate portion sizes in grams.
${mealHint}
Return JSON only:
{
  "meal_description": "short label for the meal",
  "items": [
    { "name": "ingredient name suitable for a nutrition database", "quantity_grams": number, "confidence": 0.0-1.0 }
  ]
}
Rules:
- List each distinct food (not utensils or packaging).
- quantity_grams is your best estimate for the portion shown.
- Do NOT include calorie or macro numbers.
- Use simple English names (e.g. "grilled chicken breast", "white rice", "green salad").`;

    const body = {
      contents: [
        {
          parts: [
            {
              inline_data: {
                mime_type: file.mimetype,
                data: file.buffer.toString('base64'),
              },
            },
            { text: prompt },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: 'application/json',
      },
    };

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!resp.ok) {
        const err = await resp.text();
        throw new Error(`Gemini ${resp.status}: ${err.slice(0, 400)}`);
      }
      const data = (await resp.json()) as {
        candidates?: Array<{
          content?: { parts?: Array<{ text?: string }> };
        }>;
      };
      const text =
        data.candidates?.[0]?.content?.parts
          ?.map((p) => p.text ?? '')
          .join('') ?? '';
      return this.parseFoodJson(text);
    } finally {
      clearTimeout(timer);
    }
  }

  private parseFoodJson(raw: string): {
    description: string;
    items: DetectedFoodItem[];
  } {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new BadRequestException('Gemini returned invalid food JSON');
    }
    const parsed = JSON.parse(match[0]) as {
      meal_description?: string;
      items?: Array<{
        name?: string;
        quantity_grams?: number;
        confidence?: number;
      }>;
    };
    const description =
      typeof parsed.meal_description === 'string'
        ? parsed.meal_description.trim().slice(0, 200)
        : 'Meal from photo';
    const items: DetectedFoodItem[] = [];
    for (const row of parsed.items ?? []) {
      const name = typeof row.name === 'string' ? row.name.trim() : '';
      const quantityGrams = Number(row.quantity_grams);
      if (!name || !Number.isFinite(quantityGrams) || quantityGrams <= 0) {
        continue;
      }
      items.push({
        name: name.slice(0, 120),
        quantityGrams: Math.min(2000, Math.round(quantityGrams)),
        confidence:
          typeof row.confidence === 'number' && row.confidence >= 0
            ? Math.min(1, row.confidence)
            : undefined,
      });
    }
    if (!items.length) {
      throw new BadRequestException(
        'Could not detect foods in this photo. Try a clearer image.',
      );
    }
    return { description, items };
  }
}
