import type { TransformFnParams } from 'class-transformer';

/** Normalize repeated or comma-separated query params into a string array. */
export function toQueryStringArray({
  value,
}: TransformFnParams): string[] | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (Array.isArray(value)) {
    const flat = value.flatMap((item) =>
      typeof item === 'string'
        ? item
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : [],
    );
    return flat.length ? flat : undefined;
  }
  if (typeof value === 'string') {
    const parts = value
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    return parts.length ? parts : undefined;
  }
  return undefined;
}
