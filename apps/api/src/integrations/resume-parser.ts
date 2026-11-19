// ---------------------------------------------------------------------------
// Resume parser — text extraction + field parsing
// ---------------------------------------------------------------------------
import { PDFParse } from 'pdf-parse';
import mammoth from 'mammoth';
import { AppError } from '../common/errors/app-error.js';

export interface ParsedResume {
  name?: string;
  email?: string;
  phone?: string;
  skills: string[];
  experienceYears?: number;
  educationSummary?: string;
  rawText: string;
}

/**
 * Extracts plain text from a PDF or DOCX buffer.
 */
export async function extractText(buffer: Buffer, mimeType: string): Promise<string> {
  if (mimeType === 'application/pdf') {
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      return result.text;
    } finally {
      await parser.destroy().catch(() => {});
    }
  }

  if (
    mimeType ===
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  throw AppError.badRequest('Unsupported file type');
}

// Common tech skills keyword list for extraction fallback
const COMMON_SKILLS = [
  'JavaScript', 'TypeScript', 'Python', 'Java', 'C\\+\\+', 'C#', 'Go', 'Rust', 'Ruby',
  'PHP', 'Swift', 'Kotlin', 'Scala', 'HTML', 'CSS', 'SQL', 'NoSQL', 'GraphQL',
  'React', 'Angular', 'Vue', 'Node\\.js', 'Express', 'Django', 'Flask', 'Spring',
  'Next\\.js', 'Nuxt', 'Svelte', 'Redux', 'MobX',
  'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'Elasticsearch', 'DynamoDB', 'SQLite',
  'AWS', 'GCP', 'Azure', 'Docker', 'Kubernetes', 'Terraform', 'Ansible',
  'Git', 'GitHub', 'GitLab', 'CI/CD', 'Jenkins', 'GitHub Actions',
  'REST', 'gRPC', 'WebSockets', 'Microservices', 'Kafka', 'RabbitMQ',
  'Linux', 'Bash', 'PowerShell', 'Agile', 'Scrum', 'Jira', 'Figma',
  'Machine Learning', 'Deep Learning', 'TensorFlow', 'PyTorch', 'scikit-learn',
  'Prisma', 'TypeORM', 'Sequelize', 'Mongoose',
];

/**
 * Parses raw resume text into structured fields using regex heuristics.
 */
export function parseResumeText(text: string): ParsedResume {
  const rawText = text;

  // --- Email ---
  const emailMatch = text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
  const email = emailMatch?.[0];

  // --- Phone ---
  const phoneMatch = text.match(
    /(?:\+?\d{1,3}[\s\-.])?(?:\(?\d{2,4}\)?[\s\-.])\d{3,4}[\s\-.]\d{3,4}/,
  );
  const phone = phoneMatch?.[0]?.trim();

  // --- Name: typically first non-empty line before email (heuristic) ---
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const name = lines.length > 0 ? lines[0] : undefined;

  // --- Skills ---
  let skills: string[] = [];

  // Look for a "Skills:" section first
  const skillsSectionMatch = text.match(
    /(?:Technical\s+)?Skills?\s*[:—\-]\s*([^\n]+(?:\n(?!\n)[^\n]+)*)/i,
  );
  if (skillsSectionMatch) {
    const section = skillsSectionMatch[1];
    skills = section
      .split(/[,|•·\n\/]/)
      .map((s) => s.trim())
      .filter((s) => s.length > 1 && s.length < 60);
  }

  // Also scan for known tech keywords
  const foundKeywords: string[] = [];
  for (const skill of COMMON_SKILLS) {
    const regex = new RegExp(`\\b${skill}\\b`, 'i');
    if (regex.test(text)) {
      // Normalize to the display form
      const displaySkill = skill.replace(/\\/g, '');
      if (!foundKeywords.includes(displaySkill)) {
        foundKeywords.push(displaySkill);
      }
    }
  }

  // Merge: prefer section-parsed skills; supplement with keyword scan
  const merged = [...new Set([...skills, ...foundKeywords])];
  skills = merged.slice(0, 40); // cap at 40

  // --- Experience years ---
  let experienceYears: number | undefined;
  const expMatch = text.match(/(\d+(?:\.\d+)?)\+?\s*(?:years?|yrs?)(?:\s+of)?\s+(?:experience|exp)/i);
  if (expMatch) {
    experienceYears = parseFloat(expMatch[1]);
  }

  // --- Education summary ---
  const educationMatch = text.match(
    /Education\s*[:—\-]?\s*([\s\S]{0,300}?)(?:\n\n|\z)/i,
  );
  const educationSummary = educationMatch
    ? educationMatch[1].replace(/\s+/g, ' ').trim().slice(0, 300)
    : undefined;

  return {
    name,
    email,
    phone,
    skills,
    experienceYears,
    educationSummary,
    rawText,
  };
}
