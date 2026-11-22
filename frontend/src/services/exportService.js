/**
 * Resume Text & Document Export Service (Milestone 5 & 6)
 * --------------------------------------------------------
 * Exports the current edited working copy as either:
 *   1. An unformatted UTF-8 plain-text (.txt) file.
 *   2. A polished, standard single-column Word document (.docx).
 *
 * Content Integrity & Transformation Guarantees:
 * - Sourced strictly from workingResumeText (no added, inferred, or rewritten content).
 * - Plain-text bullet markers (- , * , • , ◦ , ▪ , ▫ , ☐ , □ , – , — ) are converted to native Word bullets.
 * - Repeated blank lines are collapsed into standard paragraph spacing.
 * - 100% Client-Side: Runs entirely in the browser using Blob and 'docx'. Zero network requests.
 * - Safe Filenames: Predictable `careerpilot-resume-edited-YYYY-MM-DD.[txt|docx]`.
 * - Conservative Hierarchy Rules:
 *   * Candidate Name: 18pt Bold when line 1 satisfies name syntax AND is followed by a recognized headline or contact/profile line.
 *   * Professional Headline: 11pt Bold when line contains role keywords combined with pipe delimiters.
 *   * Location & Profile Line: 9.5pt Muted when line contains location, contact, or profile links/placeholders.
 *   * Technical Skills: Bolds category label before colon only; preserves colon and all following text exactly.
 *   * Section Headings: Explicit standard resume section list only.
 */

import {
  Document,
  Paragraph,
  TextRun,
  Packer,
  BorderStyle,
  convertInchesToTwip,
} from 'docx';

// Explicit list of recognized standard resume section titles
const STANDARD_HEADINGS = new Set([
  'summary',
  'professional summary',
  'executive summary',
  'career summary',
  'profile',
  'professional profile',
  'objective',
  'career objective',
  'experience',
  'work experience',
  'professional experience',
  'employment history',
  'work history',
  'relevant experience',
  'career highlights',
  'highlights',
  'key achievements',
  'education',
  'academic background',
  'skills',
  'technical skills',
  'core competencies',
  'key skills',
  'projects',
  'key projects',
  'personal projects',
  'academic projects',
  'selected projects',
  'certifications',
  'licenses',
  'certifications & licenses',
  'certifications and licenses',
  'awards',
  'honors',
  'publications',
  'languages',
  'volunteer experience',
  'affiliations',
]);

const SKILLS_SECTIONS = new Set([
  'skills',
  'technical skills',
  'core competencies',
  'key skills',
]);

const PROJECTS_SECTIONS = new Set([
  'projects',
  'key projects',
  'personal projects',
  'academic projects',
  'selected projects',
]);

const TECH_STACK_PREFIX_REGEX =
  /^(tech(\s+stack|\s+used)?|technologies(\s+used)?|tools(\s+used)?|environment|stack|built\s+with)\s*:/i;

/**
 * Checks if a line is a project tech-stack or tools specification.
 */
export function isProjectTechLine(line) {
  if (!line || !line.trim()) return false;
  const trimmed = line.trim();
  if (trimmed.length > 200) return false;
  if (TECH_STACK_PREFIX_REGEX.test(trimmed)) return true;
  if (trimmed.includes('|') && /\b(tech|technologies|tools|stack)\b/i.test(trimmed)) return true;
  return false;
}

// General role keywords for headline detection
const HEADLINE_ROLE_REGEX =
  /\b(DevOps|Cloud|Engineer|Developer|Operations|Architect|Administrator|Consultant|Specialist|Manager|Lead|Analyst|Scientist|Programmer|Associate)\b/i;

// Contact, location, and profile token indicators
const PROFILE_LOCATION_REGEX =
  /\b(github|linkedin|portfolio|email|phone)\b|\[(github|linkedin|portfolio|contact)[^\]]*\]|\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b|(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}|\b(India|USA|United States|UK|Canada|Germany|[A-Z][a-z]+,\s*[A-Z][a-z]+)\b/i;

/**
 * Checks if a line matches a professional headline format.
 */
export function isHeadlineLine(line) {
  if (!line || !line.trim()) return false;
  const trimmed = line.trim();
  if (trimmed.length > 140) return false;
  return trimmed.includes('|') && HEADLINE_ROLE_REGEX.test(trimmed);
}

/**
 * Checks if a line contains location, contact details, or profile labels/placeholders.
 */
export function isProfileOrLocationLine(line) {
  if (!line || !line.trim()) return false;
  const trimmed = line.trim();
  if (trimmed.length > 140) return false;
  return PROFILE_LOCATION_REGEX.test(trimmed);
}

export const isContactLine = isProfileOrLocationLine;

/**
 * Formats a safe filename for plain-text export:
 * careerpilot-resume-edited-YYYY-MM-DD.txt
 */
export function formatExportFilename(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `careerpilot-resume-edited-${year}-${month}-${day}.txt`;
}

/**
 * Formats a safe filename for Word DOCX export:
 * careerpilot-resume-edited-YYYY-MM-DD.docx
 */
export function formatExportDocxFilename(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `careerpilot-resume-edited-${year}-${month}-${day}.docx`;
}

/**
 * Creates an in-memory plain-text Blob from text.
 */
export function createResumeTextBlob(text) {
  if (!text || !text.trim()) {
    throw new Error('Cannot export empty resume text.');
  }
  return new Blob([text], { type: 'text/plain;charset=utf-8' });
}

/**
 * Parses raw working text into structured docx Paragraph objects.
 * Applies conservative, non-guessing formatting rules.
 *
 * @param {string} text - Raw text from editor.
 * @returns {Paragraph[]}
 */
export function convertTextToDocxParagraphs(text) {
  if (!text || !text.trim()) {
    throw new Error('Cannot export empty resume text.');
  }

  const lines = text.split(/\r?\n/);
  const paragraphs = [];
  const bulletRegex = /^\s*([-*•◦▪▫☐□–—])\s+(.*)$/;
  const categoryRegex = /^([^:\n]{2,50}:)(\s+)(.*)$/;

  // Find the header block (lines before the first standard section heading)
  let firstHeadingIndex = lines.length;
  for (let i = 0; i < lines.length; i++) {
    const candidate = lines[i].trim().toLowerCase().replace(/:\s*$/, '');
    if (STANDARD_HEADINGS.has(candidate)) {
      firstHeadingIndex = i;
      break;
    }
  }

  // Pre-scan non-empty lines in the header block
  const headerNonEmpty = [];
  for (let i = 0; i < firstHeadingIndex; i++) {
    if (lines[i].trim()) {
      headerNonEmpty.push({ index: i, text: lines[i].trim() });
    }
  }

  let nameLineIndex = -1;
  let headlineLineIndex = -1;
  let profileLineIndex = -1;

  if (headerNonEmpty.length >= 1) {
    const first = headerNonEmpty[0];
    const isNameSyntax =
      /^[A-Za-z.]+([ '.-][A-Za-z.]+)*$/.test(first.text) &&
      first.text.length >= 2 &&
      first.text.length <= 35 &&
      first.text.split(/\s+/).length <= 4 &&
      !STANDARD_HEADINGS.has(first.text.toLowerCase().replace(/:\s*$/, ''));

    // Look for headline and profile/contact in remaining header lines
    for (let k = 1; k < headerNonEmpty.length; k++) {
      const item = headerNonEmpty[k];
      if (headlineLineIndex === -1 && isHeadlineLine(item.text)) {
        headlineLineIndex = item.index;
      } else if (profileLineIndex === -1 && isProfileOrLocationLine(item.text)) {
        profileLineIndex = item.index;
      }
    }

    // Name style applies only if line 1 matches name syntax AND is followed by a recognized headline or profile/contact line
    if (isNameSyntax && (headlineLineIndex !== -1 || profileLineIndex !== -1)) {
      nameLineIndex = first.index;
    }
  }

  // Main conversion loop
  let previousLineWasEmpty = false;
  let currentSectionName = '';
  let inProjectSection = false;
  let expectingProjectHeading = false;
  let projectTechLineIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // Blank line collapsing: consecutive blank lines collapse to a single subtle spacing gap
    if (!trimmed) {
      if (inProjectSection) {
        expectingProjectHeading = true;
      }
      if (!previousLineWasEmpty && paragraphs.length > 0) {
        paragraphs.push(
          new Paragraph({
            children: [new TextRun({ text: '', size: 2 })],
            spacing: { before: 0, after: 20, line: 40 },
          })
        );
        previousLineWasEmpty = true;
      }
      continue;
    }

    previousLineWasEmpty = false;

    // Check Case A: Candidate Name
    if (i === nameLineIndex) {
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: rawLine,
              font: 'Calibri',
              size: 36, // 18pt
              bold: true,
              color: '111827',
            }),
          ],
          spacing: {
            before: 0,
            after: 40,
          },
        })
      );
      continue;
    }

    // Check Case B: Professional Headline
    if (i === headlineLineIndex) {
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: rawLine,
              font: 'Calibri',
              size: 22, // 11pt
              bold: true,
              color: '1F2937',
            }),
          ],
          spacing: {
            after: 40,
            line: 260,
          },
        })
      );
      continue;
    }

    // Check Case C: Location / Profile / Contact Line
    if (i === profileLineIndex) {
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: rawLine,
              font: 'Calibri',
              size: 19, // 9.5pt
              color: '4B5563',
            }),
          ],
          spacing: {
            after: 140, // ~7pt before first section
            line: 240,
          },
        })
      );
      continue;
    }

    // Check Case D: Standard Section Heading (explicit list only)
    const normalizedHeading = trimmed.toLowerCase().replace(/:\s*$/, '');
    if (STANDARD_HEADINGS.has(normalizedHeading)) {
      currentSectionName = normalizedHeading;
      inProjectSection = PROJECTS_SECTIONS.has(normalizedHeading);
      expectingProjectHeading = inProjectSection;
      projectTechLineIndex = -1;

      paragraphs.push(
        new Paragraph({
          keepNext: true,
          keepLines: true,
          border: {
            bottom: {
              style: BorderStyle.SINGLE,
              size: 6,
              color: 'D1D5DB',
              space: 4,
            },
          },
          children: [
            new TextRun({
              text: rawLine,
              font: 'Calibri',
              size: 26, // 13pt
              bold: true,
              color: '1F2937',
            }),
          ],
          spacing: {
            before: 180, // ~9pt
            after: 60,   // ~3pt
          },
        })
      );
      continue;
    }

    // Check Case E: Explicit Bullet Marker
    const bulletMatch = rawLine.match(bulletRegex);
    if (bulletMatch) {
      if (inProjectSection) {
        expectingProjectHeading = false;
      }
      const bulletContent = bulletMatch[2];
      paragraphs.push(
        new Paragraph({
          bullet: {
            level: 0,
          },
          children: [
            new TextRun({
              text: bulletContent,
              font: 'Calibri',
              size: 22, // 11pt
            }),
          ],
          spacing: {
            before: 10,
            after: 25, // Tight list spacing
            line: 260, // 1.15 line spacing
          },
        })
      );
      continue;
    }

    // Check Case F: Technical Skills Category Bolding (e.g. "Cloud (AWS): EC2, S3...")
    if (SKILLS_SECTIONS.has(currentSectionName)) {
      const catMatch = rawLine.match(categoryRegex);
      if (catMatch) {
        const labelWithColon = catMatch[1];
        const whitespace = catMatch[2];
        const restOfText = catMatch[3];

        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: labelWithColon,
                font: 'Calibri',
                size: 22,
                bold: true,
                color: '1F2937',
              }),
              new TextRun({
                text: whitespace + restOfText,
                font: 'Calibri',
                size: 22,
                color: '374151',
              }),
            ],
            spacing: {
              after: 40,
              line: 260,
            },
          })
        );
        continue;
      }
    }

    // Check Case P1: Project Heading (within Projects section)
    if (inProjectSection && expectingProjectHeading) {
      expectingProjectHeading = false;

      // Lookahead to check if the next non-empty line is a tech-stack line
      let nextNonEmptyIdx = -1;
      for (let j = i + 1; j < lines.length; j++) {
        if (lines[j].trim()) {
          nextNonEmptyIdx = j;
          break;
        }
      }
      if (nextNonEmptyIdx !== -1 && isProjectTechLine(lines[nextNonEmptyIdx])) {
        projectTechLineIndex = nextNonEmptyIdx;
      }

      paragraphs.push(
        new Paragraph({
          keepNext: true,
          keepLines: true,
          children: [
            new TextRun({
              text: rawLine,
              font: 'Calibri',
              size: 22,
              color: '1F2937',
            }),
          ],
          spacing: {
            before: 60,
            after: 30,
            line: 260,
          },
        })
      );
      continue;
    }

    // Check Case P2: Project Tech-Stack Line (within Projects section)
    if (inProjectSection && i === projectTechLineIndex) {
      projectTechLineIndex = -1;

      // Lookahead in case of a second consecutive tech specification line
      let nextNextNonEmpty = -1;
      for (let j = i + 1; j < lines.length; j++) {
        if (lines[j].trim()) {
          nextNextNonEmpty = j;
          break;
        }
      }
      if (nextNextNonEmpty !== -1 && isProjectTechLine(lines[nextNextNonEmpty])) {
        projectTechLineIndex = nextNextNonEmpty;
      }

      paragraphs.push(
        new Paragraph({
          keepNext: true,
          keepLines: true,
          children: [
            new TextRun({
              text: rawLine,
              font: 'Calibri',
              size: 22,
              color: '374151',
            }),
          ],
          spacing: {
            before: 0,
            after: 30,
            line: 260,
          },
        })
      );
      continue;
    }

    // Check Case G: Standard Body Paragraph (Conservative fallback, e.g. Career Highlights, Summary, Descriptions)
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: rawLine,
            font: 'Calibri',
            size: 22, // 11pt
            color: '374151',
          }),
        ],
        spacing: {
          before: 0,
          after: 35,
          line: 260,
        },
      })
    );
  }

  return paragraphs;
}

/**
 * Creates a docx Document instance from resume text with unchanged 0.75" margins.
 */
export function createResumeDocxDocument(text) {
  const paragraphs = convertTextToDocxParagraphs(text);

  return new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(0.75),
              right: convertInchesToTwip(0.75),
              bottom: convertInchesToTwip(0.75),
              left: convertInchesToTwip(0.75),
            },
          },
        },
        children: paragraphs,
      },
    ],
  });
}

/**
 * Asynchronously generates an in-memory DOCX Blob from resume text.
 */
export async function createResumeDocxBlob(text) {
  const doc = createResumeDocxDocument(text);
  return await Packer.toBlob(doc);
}

/**
 * Triggers a browser download of the working resume text as a plain-text (.txt) file.
 */
export function exportResumeTextAsFile(text, options = {}) {
  if (!text || !text.trim()) {
    throw new Error('Cannot export empty resume text.');
  }

  const filename = options.filename || formatExportFilename(options.date || new Date());
  const blob = createResumeTextBlob(text);

  if (options.customDownloader) {
    options.customDownloader(blob, filename);
    return { success: true, filename };
  }

  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error('Browser environment is required to trigger file download.');
  }

  const url = window.URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } finally {
    setTimeout(() => {
      try {
        window.URL.revokeObjectURL(url);
      } catch {
        // Ignore if already revoked
      }
    }, 10000);
  }

  return { success: true, filename };
}

/**
 * Triggers a browser download of the working resume text as a Word (.docx) file.
 */
export async function exportResumeTextAsDocx(text, options = {}) {
  if (!text || !text.trim()) {
    throw new Error('Cannot export empty resume text.');
  }

  const filename = options.filename || formatExportDocxFilename(options.date || new Date());
  const blob = await createResumeDocxBlob(text);

  if (options.customDownloader) {
    options.customDownloader(blob, filename);
    return { success: true, filename };
  }

  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error('Browser environment is required to trigger file download.');
  }

  const url = window.URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } finally {
    setTimeout(() => {
      try {
        window.URL.revokeObjectURL(url);
      } catch {
        // Ignore if already revoked
      }
    }, 10000);
  }

  return { success: true, filename };
}
