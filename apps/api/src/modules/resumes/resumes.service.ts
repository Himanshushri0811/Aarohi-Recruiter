// ---------------------------------------------------------------------------
// Resumes service — file upload, text extraction, and DB management
// ---------------------------------------------------------------------------
import type { Resume } from '@prisma/client';
import { getPrismaClient } from '../../config/database.js';
import { AppError } from '../../common/errors/app-error.js';
import { saveFile, buildStorageKey, deleteFile } from '../../integrations/storage/storage.service.js';
import { extractText, parseResumeText } from '../../integrations/resume-parser.js';

/**
 * Uploads a resume file, saves it to disk, parses it, and persists the record.
 */
export async function uploadResume(
  orgId: string,
  candidateId: string,
  file: Express.Multer.File,
): Promise<Resume> {
  const prisma = getPrismaClient();

  // 1. Verify candidate belongs to org
  const candidate = await prisma.candidate.findFirst({
    where: { id: candidateId, organizationId: orgId },
  });
  if (!candidate) {
    throw AppError.notFound('Candidate not found');
  }

  // 2. Build storage key
  const storageKey = buildStorageKey(orgId, 'resumes', file.originalname);

  // 3. Save file to disk
  await saveFile(storageKey, file.buffer);

  // 4. Create Resume record with PENDING status
  let resume = await prisma.resume.create({
    data: {
      candidateId,
      organizationId: orgId,
      fileName: file.originalname,
      fileSize: file.size,
      fileType: file.mimetype,
      storageKey,
      parsingStatus: 'PENDING',
    },
  });

  // 5. Extract and parse text
  try {
    const rawText = await extractText(file.buffer, file.mimetype);
    const parsedData = parseResumeText(rawText);

    // 6. Update record with parsed data
    resume = await prisma.resume.update({
      where: { id: resume.id },
      data: {
        extractedText: rawText,
        parsedData: parsedData as object,
        parsingStatus: 'PARSED',
      },
    });
  } catch (err: unknown) {
    // 7. Mark as failed
    const message = err instanceof Error ? err.message : 'Unknown parsing error';
    resume = await prisma.resume.update({
      where: { id: resume.id },
      data: {
        parsingStatus: 'FAILED',
        errorMessage: message,
      },
    });
  }

  return resume;
}

/**
 * Lists all resumes for a candidate within an organization.
 */
export async function listResumes(orgId: string, candidateId: string): Promise<Resume[]> {
  const prisma = getPrismaClient();

  // Verify candidate belongs to org
  const candidate = await prisma.candidate.findFirst({
    where: { id: candidateId, organizationId: orgId },
  });
  if (!candidate) {
    throw AppError.notFound('Candidate not found');
  }

  return prisma.resume.findMany({
    where: { candidateId, organizationId: orgId },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Deletes a resume from storage and removes the DB record.
 */
export async function deleteResume(orgId: string, resumeId: string): Promise<void> {
  const prisma = getPrismaClient();

  const resume = await prisma.resume.findUnique({ where: { id: resumeId } });
  if (!resume || resume.organizationId !== orgId) {
    throw AppError.notFound('Resume not found');
  }

  // Delete from disk
  await deleteFile(resume.storageKey);

  // Delete DB record
  await prisma.resume.delete({ where: { id: resumeId } });
}
