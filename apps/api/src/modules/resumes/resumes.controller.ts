// ---------------------------------------------------------------------------
// Resumes controller
// ---------------------------------------------------------------------------
import type { Response, Request, RequestHandler } from 'express';
import multer from 'multer';
import { asyncHandler } from '../../common/utils/async-handler.js';
import { AppError } from '../../common/errors/app-error.js';
import { uploadResume, listResumes, deleteResume } from './resumes.service.js';

// ---------------------------------------------------------------------------
// Multer configuration — memory storage, 10 MB limit, PDF/DOCX only
// ---------------------------------------------------------------------------
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req: Request, file, cb) => {
    const allowed = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new AppError('Only PDF and DOCX files are allowed', 400, 'BAD_REQUEST'));
    }
  },
});

export const uploadMiddleware: RequestHandler = upload.single('resume');

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

export const uploadHandler = asyncHandler(async (req: Request, res: Response) => {
  const { orgId, candidateId } = req.params;
  if (!orgId || !candidateId) {
    throw AppError.badRequest('Organization ID and Candidate ID are required');
  }

  if (!req.file) {
    throw AppError.badRequest('No resume file provided');
  }

  const resume = await uploadResume(orgId, candidateId, req.file);
  res.status(201).json({ success: true, data: resume });
});

export const list = asyncHandler(async (req: Request, res: Response) => {
  const { orgId, candidateId } = req.params;
  if (!orgId || !candidateId) {
    throw AppError.badRequest('Organization ID and Candidate ID are required');
  }

  const resumes = await listResumes(orgId, candidateId);
  res.status(200).json({ success: true, data: resumes });
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const { orgId, resumeId } = req.params;
  if (!orgId || !resumeId) {
    throw AppError.badRequest('Organization ID and Resume ID are required');
  }

  await deleteResume(orgId, resumeId);
  res.status(200).json({ success: true, data: null });
});
