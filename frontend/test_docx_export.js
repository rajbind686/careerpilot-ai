/**
 * Automated Unit Tests for Milestone 6 DOCX Export Service
 * ---------------------------------------------------------
 * Runs in Node.js.
 * Verifies:
 *   1. Safe date-based filename formatting (careerpilot-resume-edited-YYYY-MM-DD.docx).
 *   2. Empty or whitespace-only text rejection.
 *   3A. Sample Resume Header Detection: Name (18pt bold) + Headline (11pt bold) +
 *       Location/Profile (9.5pt muted) for the sample structure.
 *   3B. Different Valid Resume Header: Tests reusable header patterns on a different
 *       candidate and title (Alex Smith, Senior Software Engineer, contact line).
 *   3C. Standard 2-Line Header: Tests Name followed directly by contact info without headline.
 *   4. Ambiguous First Line: Headline like "Cloud Support Engineer" without paired
 *      contact line remains standard body text (size 22, regular weight).
 *   5. Pipe Delimiter & Contact Validation:
 *      - Pipe alone without role keywords or contact tokens is NOT a headline or contact line.
 *      - Generic placeholder "[Project Link]" is NOT treated as a verified URL/profile.
 *      - Real profile token "[GitHub URL]" or email/phone qualifies.
 *   6. Uppercase Non-Heading: Short uppercase lines (e.g. "SENIOR DEVELOPER") do NOT
 *      become section divider headings. Only explicit standard headings qualify.
 *   7. Standard Section Heading: Known heading like "Work Experience" receives 13pt bold + border + keepNext.
 *   8. Explicit Bullet Marker Conversion: Markers (- , * , • , ◦ , ▪ , ▫ , ☐ , □ , – , — )
 *      stripped and converted to native Word bullets. Plain text without markers is NOT bulleted.
 *   9. Technical Skills Category Bolding: Bolds category label before colon only;
 *      preserves colon, whitespace, and rest of text.
 *  10. Repeated Blank Line Collapsing: Consecutive blank lines collapsed to single subtle spacing gap.
 *  11. Project Page-Break Behavior (with Tech-Stack Line):
 *      - Project heading has keepNext: true, keepLines: true.
 *      - Tech-stack line has keepNext: true, keepLines: true.
 *      - First description paragraph has keepNext: false (normal page break).
 *  12. Project Page-Break Behavior (without Tech-Stack Line):
 *      - Project heading has keepNext: true, keepLines: true.
 *      - First description paragraph has keepNext: false.
 *  13. Compact Paragraph Spacing:
 *      - Consecutive ordinary paragraphs (e.g. Career Highlights) have compact spacing (after: 35).
 *      - Collapsed blank lines produce compact spacing gap (after: 20).
 *      - Clear prominent spacing before section headings is preserved (before: 180).
 *  14. DOCX Binary generation: Generates valid ZIP binary and writes temporary file for Python round-trip test.
 */

import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Packer } from 'docx';
import {
  formatExportDocxFilename,
  createResumeDocxDocument,
  convertTextToDocxParagraphs,
  isHeadlineLine,
  isProfileOrLocationLine,
  isContactLine,
  isProjectTechLine,
} from './src/services/exportService.js';

// Helpers to inspect internal docx paragraph properties in unit tests
function getParagraphText(paragraph) {
  const textRuns = paragraph.root.filter((item) => item.rootKey === 'w:r');
  return textRuns
    .map((run) => {
      const textElem = run.root.find((item) => item.rootKey === 'w:t');
      return textElem ? textElem.root[1] : '';
    })
    .join('');
}

function checkBoldElement(bElem) {
  if (!bElem) return false;
  const val = bElem.root && bElem.root[0] && bElem.root[0].root ? bElem.root[0].root.val : undefined;
  if (val === false || val === 0 || val === '0' || val === 'false') return false;
  return true;
}

function getParagraphRuns(paragraph) {
  const textRuns = paragraph.root.filter((item) => item.rootKey === 'w:r');
  return textRuns.map((run) => {
    const textElem = run.root.find((item) => item.rootKey === 'w:t');
    const text = textElem ? textElem.root[1] : '';
    const runProps = run.root.find((item) => item.rootKey === 'w:rPr');
    const sz = runProps ? runProps.root.find((item) => item.rootKey === 'w:sz') : null;
    const fontSize = sz && sz.root && sz.root[0] && sz.root[0].root ? sz.root[0].root.val : null;
    const isBold = runProps ? checkBoldElement(runProps.root.find((item) => item.rootKey === 'w:b')) : false;
    return { text, fontSize, isBold };
  });
}

function getParagraphFontSize(paragraph) {
  const textRun = paragraph.root.find((item) => item.rootKey === 'w:r');
  if (!textRun) return null;
  const runProps = textRun.root.find((item) => item.rootKey === 'w:rPr');
  if (!runProps) return null;
  const sz = runProps.root.find((item) => item.rootKey === 'w:sz');
  return sz ? sz.root[0].root.val : null;
}

function isParagraphBold(paragraph) {
  const textRun = paragraph.root.find((item) => item.rootKey === 'w:r');
  if (!textRun) return false;
  const runProps = textRun.root.find((item) => item.rootKey === 'w:rPr');
  if (!runProps) return false;
  return checkBoldElement(runProps.root.find((item) => item.rootKey === 'w:b'));
}

function hasParagraphBottomBorder(paragraph) {
  const pPr = paragraph.root.find((item) => item.rootKey === 'w:pPr');
  if (!pPr) return false;
  return !!pPr.root.find((item) => item.rootKey === 'w:pBdr');
}

function isParagraphBullet(paragraph) {
  const pPr = paragraph.root.find((item) => item.rootKey === 'w:pPr');
  if (!pPr) return false;
  return !!pPr.root.find((item) => item.rootKey === 'w:numPr');
}

function hasParagraphKeepNext(paragraph) {
  if (paragraph.options && paragraph.options.keepNext !== undefined) {
    return paragraph.options.keepNext;
  }
  const pPr = paragraph.root.find((item) => item.rootKey === 'w:pPr');
  if (!pPr) return false;
  return !!pPr.root.find((item) => item.rootKey === 'w:keepNext');
}

function hasParagraphKeepLines(paragraph) {
  if (paragraph.options && paragraph.options.keepLines !== undefined) {
    return paragraph.options.keepLines;
  }
  const pPr = paragraph.root.find((item) => item.rootKey === 'w:pPr');
  if (!pPr) return false;
  return !!pPr.root.find((item) => item.rootKey === 'w:keepLines');
}

function getParagraphSpacing(paragraph) {
  if (paragraph.options && paragraph.options.spacing) {
    return paragraph.options.spacing;
  }
  const pPr = paragraph.root.find((item) => item.rootKey === 'w:pPr');
  if (!pPr) return {};
  const spacingElem = pPr.root.find((item) => item.rootKey === 'w:spacing');
  if (!spacingElem || !spacingElem.root || !spacingElem.root[0]) return {};
  const rootObj = spacingElem.root[0].root || {};
  return {
    before: rootObj.before ? rootObj.before.value : undefined,
    after: rootObj.after ? rootObj.after.value : undefined,
  };
}

console.log('--- Starting Milestone 6 DOCX Export Service Tests ---');

// Test 1: DOCX Filename Format Verification
{
  const filenamePattern = /^careerpilot-resume-edited-\d{4}-\d{2}-\d{2}\.docx$/;
  const currentFilename = formatExportDocxFilename();
  assert.match(
    currentFilename,
    filenamePattern,
    `Filename "${currentFilename}" does not match expected pattern.`
  );

  const fixedDate = new Date(2026, 10, 21); // Month 10 = November
  assert.strictEqual(
    formatExportDocxFilename(fixedDate),
    'careerpilot-resume-edited-2026-11-21.docx',
    'DOCX filename did not format specific date accurately.'
  );
  console.log('✓ Test 1 Passed: Predictable, safe DOCX filename format verified.');
}

// Test 2: Empty or Whitespace-Only Text Rejection
{
  const emptyCases = ['', '   ', '\n\t  \n', null, undefined];

  for (const emptyInput of emptyCases) {
    assert.throws(
      () => convertTextToDocxParagraphs(emptyInput),
      (err) => err instanceof Error && err.message === 'Cannot export empty resume text.',
      `convertTextToDocxParagraphs should throw for empty input: "${emptyInput}"`
    );

    assert.throws(
      () => createResumeDocxDocument(emptyInput),
      (err) => err instanceof Error && err.message === 'Cannot export empty resume text.',
      `createResumeDocxDocument should throw for empty input: "${emptyInput}"`
    );
  }
  console.log('✓ Test 2 Passed: Empty and whitespace-only text rejected with exact error message.');
}

// Test 3A: Sample Resume Header Detection (User 3-Line Format)
{
  const sampleHeaderResume =
    'RAJ BIND\n' +
    'DevOps & Cloud Operations | AWS | Linux | Docker | Kubernetes | CI/CD\n' +
    'Mumbai, Maharashtra, India | [GitHub URL]\n\n' +
    'PROFESSIONAL SUMMARY\n' +
    'Experienced engineer.';

  const paragraphs = convertTextToDocxParagraphs(sampleHeaderResume);

  // Line 1: Candidate Name (18pt / size 36, bold, #111827)
  assert.strictEqual(getParagraphText(paragraphs[0]), 'RAJ BIND');
  assert.strictEqual(getParagraphFontSize(paragraphs[0]), 36, 'Name must have size 36 (18pt)');
  assert.strictEqual(isParagraphBold(paragraphs[0]), true, 'Name must be bold');

  // Line 2: Professional Headline (11pt / size 22, bold, #1F2937)
  assert.strictEqual(
    getParagraphText(paragraphs[1]),
    'DevOps & Cloud Operations | AWS | Linux | Docker | Kubernetes | CI/CD'
  );
  assert.strictEqual(getParagraphFontSize(paragraphs[1]), 22, 'Headline must have size 22 (11pt)');
  assert.strictEqual(isParagraphBold(paragraphs[1]), true, 'Headline must be bold');

  // Line 3: Location & Profile line (9.5pt / size 19, muted #4B5563)
  assert.strictEqual(
    getParagraphText(paragraphs[2]),
    'Mumbai, Maharashtra, India | [GitHub URL]'
  );
  assert.strictEqual(getParagraphFontSize(paragraphs[2]), 19, 'Location line must have size 19 (9.5pt)');
  assert.strictEqual(isParagraphBold(paragraphs[2]), false, 'Location line must not be bold');

  console.log('✓ Test 3A Passed: Sample resume 3-tier header recognized and styled correctly.');
}

// Test 3B: Different Valid Resume Header (General Software Engineer Pattern)
{
  const generalResume =
    'Alex Smith\n' +
    'Senior Software Engineer | Python | Cloud | Architecture\n' +
    'alex.smith@example.com | (555) 019-2834 | New York, NY | linkedin.com/in/alexsmith\n\n' +
    'EXPERIENCE\n' +
    'API development.';

  const paragraphs = convertTextToDocxParagraphs(generalResume);

  // Candidate Name
  assert.strictEqual(getParagraphText(paragraphs[0]), 'Alex Smith');
  assert.strictEqual(getParagraphFontSize(paragraphs[0]), 36);
  assert.strictEqual(isParagraphBold(paragraphs[0]), true);

  // Headline
  assert.strictEqual(
    getParagraphText(paragraphs[1]),
    'Senior Software Engineer | Python | Cloud | Architecture'
  );
  assert.strictEqual(getParagraphFontSize(paragraphs[1]), 22);
  assert.strictEqual(isParagraphBold(paragraphs[1]), true);

  // Contact line
  assert.strictEqual(
    getParagraphText(paragraphs[2]),
    'alex.smith@example.com | (555) 019-2834 | New York, NY | linkedin.com/in/alexsmith'
  );
  assert.strictEqual(getParagraphFontSize(paragraphs[2]), 19);
  assert.strictEqual(isParagraphBold(paragraphs[2]), false);

  console.log('✓ Test 3B Passed: Different valid resume header recognized and styled accurately.');
}

// Test 3C: Standard 2-Line Header (Name + Contact line without headline)
{
  const twoLineResume =
    'Jane Doe\n' +
    'jane.doe@example.com | (555) 123-4567 | github.com/janedoe\n\n' +
    'SUMMARY\n' +
    'Full stack engineer.';

  const paragraphs = convertTextToDocxParagraphs(twoLineResume);

  // Candidate Name (18pt bold)
  assert.strictEqual(getParagraphText(paragraphs[0]), 'Jane Doe');
  assert.strictEqual(getParagraphFontSize(paragraphs[0]), 36);
  assert.strictEqual(isParagraphBold(paragraphs[0]), true);

  // Contact line (9.5pt)
  assert.strictEqual(
    getParagraphText(paragraphs[1]),
    'jane.doe@example.com | (555) 123-4567 | github.com/janedoe'
  );
  assert.strictEqual(getParagraphFontSize(paragraphs[1]), 19);

  console.log('✓ Test 3C Passed: Standard 2-line header (Name + Contact) recognized and styled accurately.');
}

// Test 4: Ambiguous First Line (Headline without paired contact line remains normal body text)
{
  const headlineInput =
    'Cloud Support Engineer\n' +
    'Summary\n' +
    'Experienced IT professional seeking new opportunities.';

  const paragraphs = convertTextToDocxParagraphs(headlineInput);

  // First line should NOT have size 36 (remains standard size 22 / 11pt, regular weight)
  assert.strictEqual(getParagraphText(paragraphs[0]), 'Cloud Support Engineer');
  assert.strictEqual(
    getParagraphFontSize(paragraphs[0]),
    22,
    'Ambiguous headline must NOT be styled as large Name'
  );
  assert.strictEqual(isParagraphBold(paragraphs[0]), false, 'Ambiguous headline must NOT be bold');
  console.log('✓ Test 4 Passed: Ambiguous first line without contact info preserved as standard text.');
}

// Test 5: Pipe Delimiter Tests & Negative Contact Cases
{
  // Pipe alone without role keywords or contact tokens is neither headline nor contact line
  assert.strictEqual(isHeadlineLine('Apple | Banana | Orange'), false, 'Arbitrary pipe line is not a headline');
  assert.strictEqual(isProfileOrLocationLine('Apple | Banana | Orange'), false, 'Arbitrary pipe line is not a profile line');

  // Generic placeholder "[Project Link]" is NOT treated as a verified URL or contact info
  assert.strictEqual(isProfileOrLocationLine('[Project Link]'), false, 'Generic bracketed text is not contact info');
  assert.strictEqual(isProfileOrLocationLine('[Notes]'), false, 'Generic note bracket is not contact info');

  // Recognized profile token "[GitHub URL]" or contact tokens
  assert.strictEqual(isProfileOrLocationLine('Mumbai, Maharashtra, India | [GitHub URL]'), true);
  assert.strictEqual(isProfileOrLocationLine('jane.doe@example.com'), true);
  assert.strictEqual(isProfileOrLocationLine('(555) 123-4567'), true);
  assert.strictEqual(isContactLine('github.com/janedoe'), true);

  // Headline with role keyword and pipe
  assert.strictEqual(isHeadlineLine('DevOps & Cloud Operations | AWS | Linux'), true);
  assert.strictEqual(isHeadlineLine('Software Engineer | Python | Go'), true);

  // Tech stack line helper checks
  assert.strictEqual(isProjectTechLine('Tech Stack: AWS, Docker, Kubernetes'), true);
  assert.strictEqual(isProjectTechLine('Technologies: Python, React'), true);
  assert.strictEqual(isProjectTechLine('Tools: Git, Jenkins'), true);
  assert.strictEqual(isProjectTechLine('Built an automated CI/CD pipeline'), false);

  console.log('✓ Test 5 Passed: Pipe alone and generic placeholders correctly rejected.');
}

// Test 6: Uppercase Non-Heading vs Standard Heading
{
  const testInput =
    'SENIOR BACKEND DEVELOPER | FULL TIME\n' +
    'Work Experience:\n' +
    '- Developed APIs.';

  const paragraphs = convertTextToDocxParagraphs(testInput);

  // Paragraph 0: SENIOR BACKEND DEVELOPER -> standard body text (size 22, no border)
  assert.strictEqual(getParagraphText(paragraphs[0]), 'SENIOR BACKEND DEVELOPER | FULL TIME');
  assert.strictEqual(getParagraphFontSize(paragraphs[0]), 22);
  assert.strictEqual(hasParagraphBottomBorder(paragraphs[0]), false, 'Non-heading must have no bottom border');

  // Paragraph 1: Work Experience: -> recognized heading (size 26 / 13pt bold, with bottom border + keepNext)
  assert.strictEqual(getParagraphText(paragraphs[1]), 'Work Experience:');
  assert.strictEqual(getParagraphFontSize(paragraphs[1]), 26);
  assert.strictEqual(isParagraphBold(paragraphs[1]), true);
  assert.strictEqual(hasParagraphBottomBorder(paragraphs[1]), true, 'Heading must have bottom border');
  assert.strictEqual(hasParagraphKeepNext(paragraphs[1]), true, 'Heading must have keepNext: true');
  assert.strictEqual(hasParagraphKeepLines(paragraphs[1]), true, 'Heading must have keepLines: true');
  console.log('✓ Test 6 Passed: Uppercase non-headings preserved as body text; explicit standard headings recognized.');
}

// Test 7: Explicit Bullet Markers Conversion (and non-bullet lines preserved)
{
  const bulletInput =
    'Experience:\n' +
    '- Dash marker bullet\n' +
    '* Asterisk marker bullet\n' +
    '• Bullet symbol\n' +
    '◦ Hollow round bullet\n' +
    '▪ Filled square bullet\n' +
    '▫ Hollow square bullet\n' +
    '☐ Ballot box bullet\n' +
    '□ White square bullet\n' +
    '– En dash bullet\n' +
    '— Em dash bullet\n' +
    'Standard paragraph line without any marker.';

  const paragraphs = convertTextToDocxParagraphs(bulletInput);

  // Verify all 10 explicit markers converted to Word bullets (marker stripped)
  const expectedBullets = [
    'Dash marker bullet',
    'Asterisk marker bullet',
    'Bullet symbol',
    'Hollow round bullet',
    'Filled square bullet',
    'Hollow square bullet',
    'Ballot box bullet',
    'White square bullet',
    'En dash bullet',
    'Em dash bullet',
  ];

  for (let b = 0; b < expectedBullets.length; b++) {
    const p = paragraphs[b + 1]; // +1 for heading
    assert.strictEqual(getParagraphText(p), expectedBullets[b]);
    assert.strictEqual(isParagraphBullet(p), true, `Bullet ${b + 1} must have Word bullet property`);
  }

  // Verify the plain paragraph line without marker is NOT converted to a bullet
  const plainP = paragraphs[11];
  assert.strictEqual(getParagraphText(plainP), 'Standard paragraph line without any marker.');
  assert.strictEqual(isParagraphBullet(plainP), false, 'Line without marker must NOT become a bullet');

  console.log('✓ Test 7 Passed: All 10 explicit bullet markers converted; unbulleted lines preserved.');
}

// Test 8: Technical Skills Category Bolding
{
  const skillsInput =
    'TECHNICAL SKILLS\n' +
    'Cloud (AWS): EC2, IAM, VPC, Security Groups, S3, CloudWatch, CloudTrail\n' +
    'Containers & Orchestration: Docker, Docker Compose, Dockerfile, Kubernetes\n' +
    '- Linux administration and Bash scripting';

  const paragraphs = convertTextToDocxParagraphs(skillsInput);

  // Heading
  assert.strictEqual(getParagraphText(paragraphs[0]), 'TECHNICAL SKILLS');

  // Line 1: Cloud (AWS): ...
  const runs1 = getParagraphRuns(paragraphs[1]);
  assert.strictEqual(runs1.length, 2, 'Must split into bold category and normal rest');
  assert.strictEqual(runs1[0].text, 'Cloud (AWS):');
  assert.strictEqual(runs1[0].isBold, true, 'Category label before colon must be bold');
  assert.strictEqual(runs1[1].text, ' EC2, IAM, VPC, Security Groups, S3, CloudWatch, CloudTrail');
  assert.strictEqual(runs1[1].isBold, false, 'Rest of text after category colon must NOT be bold');

  // Line 2: Containers & Orchestration: ...
  const runs2 = getParagraphRuns(paragraphs[2]);
  assert.strictEqual(runs2.length, 2);
  assert.strictEqual(runs2[0].text, 'Containers & Orchestration:');
  assert.strictEqual(runs2[0].isBold, true);
  assert.strictEqual(runs2[1].text, ' Docker, Docker Compose, Dockerfile, Kubernetes');
  assert.strictEqual(runs2[1].isBold, false);

  // Line 3: Bullet line under skills (marker '-' converted, not treated as category)
  assert.strictEqual(isParagraphBullet(paragraphs[3]), true);
  assert.strictEqual(getParagraphText(paragraphs[3]), 'Linux administration and Bash scripting');

  console.log('✓ Test 8 Passed: Technical skills category bolding before colons verified.');
}

// Test 9: Repeated Blank Line Collapsing
{
  const blankInput =
    'Header\n\n\n\n\n' +
    'Content line after 5 blank lines.';

  const paragraphs = convertTextToDocxParagraphs(blankInput);
  // 1 header line + 1 collapsed spacing paragraph + 1 content line = 3 paragraphs total
  assert.strictEqual(paragraphs.length, 3, 'Consecutive blank lines must collapse to 1 spacing gap');
  console.log('✓ Test 9 Passed: Consecutive blank lines collapsed into a single spacing gap.');
}

// Test 10: Project Page-Break Behavior (with Tech-Stack Line)
{
  const projectInput =
    'PROJECTS\n\n' +
    'End-to-End DevOps CI/CD Pipeline\n' +
    'Tech Stack: AWS, Docker, Kubernetes, Jenkins, GitHub Actions\n' +
    'Built an automated CI/CD pipeline and deployed containerized application.\n' +
    '- Implemented automated test stages.';

  const paragraphs = convertTextToDocxParagraphs(projectInput);

  // p0: PROJECTS (Heading) -> keepNext: true, keepLines: true
  assert.strictEqual(getParagraphText(paragraphs[0]), 'PROJECTS');
  assert.strictEqual(hasParagraphKeepNext(paragraphs[0]), true, 'PROJECTS heading must have keepNext');
  assert.strictEqual(hasParagraphKeepLines(paragraphs[0]), true, 'PROJECTS heading must have keepLines');

  // p1: Spacer paragraph from blank line
  // p2: Project Heading -> keepNext: true, keepLines: true
  assert.strictEqual(getParagraphText(paragraphs[2]), 'End-to-End DevOps CI/CD Pipeline');
  assert.strictEqual(hasParagraphKeepNext(paragraphs[2]), true, 'Project Heading must have keepNext: true');
  assert.strictEqual(hasParagraphKeepLines(paragraphs[2]), true, 'Project Heading must have keepLines: true');

  // p3: Tech Stack Line -> keepNext: true, keepLines: true
  assert.strictEqual(
    getParagraphText(paragraphs[3]),
    'Tech Stack: AWS, Docker, Kubernetes, Jenkins, GitHub Actions'
  );
  assert.strictEqual(hasParagraphKeepNext(paragraphs[3]), true, 'Tech Stack line must have keepNext: true');
  assert.strictEqual(hasParagraphKeepLines(paragraphs[3]), true, 'Tech Stack line must have keepLines: true');

  // p4: First Description Line -> keepNext: false (normal page break flow)
  assert.strictEqual(
    getParagraphText(paragraphs[4]),
    'Built an automated CI/CD pipeline and deployed containerized application.'
  );
  assert.strictEqual(hasParagraphKeepNext(paragraphs[4]), false, 'First description paragraph must have normal page flow');

  // p5: Bullet Item -> keepNext: false
  assert.strictEqual(getParagraphText(paragraphs[5]), 'Implemented automated test stages.');
  assert.strictEqual(hasParagraphKeepNext(paragraphs[5]), false);

  console.log('✓ Test 10 Passed: Project heading and tech-stack line chained with keepNext to stay with first description.');
}

// Test 11: Project Page-Break Behavior (without separate Tech-Stack Line)
{
  const simpleProjectInput =
    'PROJECTS\n' +
    'Cloud Log Aggregator\n' +
    'Built an end-to-end log aggregation system using Elasticsearch and Fluentd.\n' +
    '- Processed 10M events daily.';

  const paragraphs = convertTextToDocxParagraphs(simpleProjectInput);

  // p0: PROJECTS heading -> keepNext: true
  assert.strictEqual(hasParagraphKeepNext(paragraphs[0]), true);

  // p1: Project Heading -> keepNext: true
  assert.strictEqual(getParagraphText(paragraphs[1]), 'Cloud Log Aggregator');
  assert.strictEqual(hasParagraphKeepNext(paragraphs[1]), true, 'Project heading without tech line must have keepNext: true');

  // p2: First Description Line -> keepNext: false
  assert.strictEqual(
    getParagraphText(paragraphs[2]),
    'Built an end-to-end log aggregation system using Elasticsearch and Fluentd.'
  );
  assert.strictEqual(hasParagraphKeepNext(paragraphs[2]), false);

  console.log('✓ Test 11 Passed: Project heading without tech line kept with first description.');
}

// Test 12: Reduced Paragraph Spacing & Career Highlights Spacing
{
  const highlightsInput =
    'CAREER HIGHLIGHTS\n\n' +
    'Built an end-to-end CI/CD pipeline and deployed containerized application.\n\n' +
    'Automated recurring Linux server maintenance with Bash and cron.';

  const paragraphs = convertTextToDocxParagraphs(highlightsInput);

  // p0: Section Heading -> spacing.before: 180 (clear prominent gap before section)
  assert.strictEqual(getParagraphText(paragraphs[0]), 'CAREER HIGHLIGHTS');
  const hSpacing = getParagraphSpacing(paragraphs[0]);
  assert.strictEqual(hSpacing.before, 180, 'Section heading must retain clear spacing before (180 twips)');

  // p1: Spacer paragraph -> compact after spacing (20 twips)
  const sSpacing = getParagraphSpacing(paragraphs[1]);
  assert.strictEqual(sSpacing.after, 20, 'Blank spacer must have compact after spacing (20 twips)');

  // p2: Highlight Paragraph 1 -> compact after spacing (35 twips)
  assert.strictEqual(
    getParagraphText(paragraphs[2]),
    'Built an end-to-end CI/CD pipeline and deployed containerized application.'
  );
  const p2Spacing = getParagraphSpacing(paragraphs[2]);
  assert.strictEqual(p2Spacing.after, 35, 'Highlight paragraph must have compact after spacing (35 twips)');

  // p3: Spacer paragraph
  const s2Spacing = getParagraphSpacing(paragraphs[3]);
  assert.strictEqual(s2Spacing.after, 20);

  // p4: Highlight Paragraph 2 -> compact after spacing (35 twips)
  assert.strictEqual(
    getParagraphText(paragraphs[4]),
    'Automated recurring Linux server maintenance with Bash and cron.'
  );
  const p4Spacing = getParagraphSpacing(paragraphs[4]);
  assert.strictEqual(p4Spacing.after, 35);

  console.log('✓ Test 12 Passed: Reduced paragraph spacing and clear section heading separation verified.');
}

// Test 13: Realistic DOCX Binary Generation & Temporary File for Python Round-Trip Test
{
  const realisticResumeText =
    'RAJ BIND\n' +
    'DevOps & Cloud Operations | AWS | Linux | Docker | Kubernetes | CI/CD\n' +
    'Mumbai, Maharashtra, India | [GitHub URL]\n\n' +
    'PROFESSIONAL SUMMARY\n' +
    'DevOps and cloud infrastructure professional with hands-on experience in AWS environments.\n\n' +
    'CAREER HIGHLIGHTS\n' +
    'Built an end-to-end CI/CD pipeline and deployed containerized application.\n\n' +
    'Automated recurring Linux server maintenance with Bash.\n\n' +
    'TECHNICAL SKILLS\n' +
    'Cloud (AWS): EC2, IAM, VPC, Security Groups, S3, CloudWatch, CloudTrail\n' +
    'Containers & Orchestration: Docker, Docker Compose, Dockerfile, Kubernetes\n\n' +
    'PROJECTS\n' +
    'Cloud Infrastructure Automation Pipeline\n' +
    'Tech Stack: AWS, Terraform, GitHub Actions, Docker\n' +
    'Architected an automated multi-region cloud deployment framework.\n' +
    '- Automated VPC provisioning and IAM policy enforcement.\n\n' +
    'WORK EXPERIENCE\n' +
    '- Designed and deployed containerized microservices on AWS EKS.\n' +
    '- Maintained PostgreSQL databases and Redis caching layers.\n' +
    '- Automated deployment verification using Python test suites.\n\n' +
    'EDUCATION\n' +
    'Bachelor of Science in Information Technology';

  const doc = createResumeDocxDocument(realisticResumeText);
  const buffer = await Packer.toBuffer(doc);

  // Assert ZIP magic bytes PK\x03\x04
  assert.strictEqual(buffer[0], 0x50);
  assert.strictEqual(buffer[1], 0x4b);
  assert.strictEqual(buffer[2], 0x03);
  assert.strictEqual(buffer[3], 0x04);

  const tempDocxPath = path.join(os.tmpdir(), 'careerpilot_test_generated.docx');
  fs.writeFileSync(tempDocxPath, buffer);
  console.log(`✓ Test 13 Passed: Valid DOCX binary generated for Python round-trip test (${tempDocxPath}).`);
}

console.log('--- All Milestone 6 JavaScript Tests Passed! ---');
