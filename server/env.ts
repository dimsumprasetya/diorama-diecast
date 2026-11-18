// Memuat file .env (tanpa dependency tambahan). Harus di-import paling awal.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const file = path.resolve('.env');
if (existsSync(file)) {
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
