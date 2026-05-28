import { BadRequestException } from '@nestjs/common';

/** Parse ISO or YYYY-MM-DD; date-only values use 12:00 local time. */
export function parseRecordedAt(input?: string): Date {
  if (!input?.trim()) return new Date();
  const raw = input.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [y, m, d] = raw.split('-').map(Number);
    const dt = new Date(y, m - 1, d, 12, 0, 0, 0);
    if (Number.isNaN(dt.getTime())) {
      throw new BadRequestException('Invalid date.');
    }
    return dt;
  }
  const dt = new Date(raw);
  if (Number.isNaN(dt.getTime())) {
    throw new BadRequestException('Invalid date or timestamp.');
  }
  return dt;
}
