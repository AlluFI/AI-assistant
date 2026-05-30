import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(__dirname, '../.env') });

process.env.JWT_ACCESS_SECRET ??= '0'.repeat(32);
process.env.JWT_REFRESH_SECRET ??= '0'.repeat(32);
process.env.REDIS_URL ??= 'redis://127.0.0.1:6379';
