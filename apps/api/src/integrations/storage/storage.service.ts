// ---------------------------------------------------------------------------
// Local disk storage service
// ---------------------------------------------------------------------------
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { AppError } from '../../common/errors/app-error.js';

// Resolve upload directory — prefer env var, fall back to apps/api/uploads
const _filename = fileURLToPath(import.meta.url);
// Goes up: storage/ -> integrations/ -> src/ -> apps/api/
const _apiRoot = path.resolve(path.dirname(_filename), '..', '..', '..');
const UPLOAD_DIR = process.env.UPLOAD_DIR ?? path.join(_apiRoot, 'uploads');

/**
 * Saves a buffer to disk at UPLOAD_DIR/<key>, creating intermediate directories.
 */
export async function saveFile(key: string, buffer: Buffer): Promise<void> {
  const dest = path.join(UPLOAD_DIR, key);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.writeFile(dest, buffer);
}

/**
 * Reads a file from disk at UPLOAD_DIR/<key>.
 * Throws NOT_FOUND AppError if the file is missing.
 */
export async function readFile(key: string): Promise<Buffer> {
  const src = path.join(UPLOAD_DIR, key);
  try {
    return await fs.readFile(src);
  } catch (err: unknown) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === 'ENOENT') {
      throw AppError.notFound(`File not found: ${key}`);
    }
    throw err;
  }
}

/**
 * Deletes a file at UPLOAD_DIR/<key>. Silently ignores ENOENT.
 */
export async function deleteFile(key: string): Promise<void> {
  const target = path.join(UPLOAD_DIR, key);
  try {
    await fs.unlink(target);
  } catch (err: unknown) {
    const e = err as NodeJS.ErrnoException;
    if (e.code !== 'ENOENT') {
      throw err;
    }
  }
}

/**
 * Builds a unique storage key: `<orgId>/<folder>/<timestamp>-<sanitizedFilename>`
 */
export function buildStorageKey(orgId: string, folder: string, filename: string): string {
  // Replace spaces and special characters with underscores
  const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `${orgId}/${folder}/${Date.now()}-${sanitized}`;
}
