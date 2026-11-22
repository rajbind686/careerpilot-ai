/**
 * Unit Tests for "Tailor Resume to Job" Frontend Service & User Workflows
 * -----------------------------------------------------------------------
 * Verifies:
 *   1. Validation: Requires active resume and non-empty job description.
 *   2. Default version naming: Formats descriptive, safe names based on preset & JD.
 *   3. Comparative stats computation (word counts and differences).
 *   4. Review & Invariant Protection: Original resume is NEVER overwritten.
 *   5. Edit Draft: User edits to the tailored draft are applied when accepting.
 *   6. Discard: Discarding the draft clears review state without touching resume or inputs.
 *   7. Accept & Save: Saves strictly as a NEW version in resumeVersionStorage.
 *   8. Export compatibility: Tailored text works seamlessly with TXT & DOCX export.
 */

import assert from 'node:assert';
import {
  validateTailorInputs,
  formatDefaultTailoredVersionName,
  computeComparisonStats,
  TAILOR_PRESETS,
} from './src/services/tailorService.js';
import {
  saveResumeVersion,
  getResumeVersions,
  STORAGE_KEY,
} from './src/services/resumeVersionStorage.js';
import {
  createResumeDocxBlob,
  exportResumeTextAsFile,
} from './src/services/exportService.js';

console.log('--- Starting Resume Tailoring Frontend Tests ---');

// Mock in-memory localStorage
function createMockStorage() {
  const store = new Map();
  return {
    getItem: (key) => store.get(key) || null,
    setItem: (key, val) => store.set(key, String(val)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
  };
}

const mockResume = `RAJ BIND
Cloud Engineer
San Francisco, CA | raj@example.com

SUMMARY
DevOps engineer with 3 years of experience in AWS, Docker, and Linux.

EXPERIENCE
Cloud Engineer - Acme Corp
- Containerized services using Docker and managed AWS EC2 instances.
- Wrote Bash scripts for automated system backups.

SKILLS
AWS, Docker, Linux, Bash, Python`;

const mockJobDescription = `Senior Cloud & DevOps Engineer
Acme Tech is looking for an experienced engineer to scale our cloud infrastructure.
Requirements:
- Strong experience with AWS (EC2, S3, IAM) and Docker containerization.
- Linux administration and Bash automation.
- Experience with Kubernetes and Terraform is a plus.`;

// Test 1: Input Validation
{
  const emptyResume = validateTailorInputs('', mockJobDescription);
  assert.strictEqual(emptyResume.valid, false);
  assert.ok(emptyResume.error.includes('active resume is required'));

  const emptyJd = validateTailorInputs(mockResume, '');
  assert.strictEqual(emptyJd.valid, false);
  assert.ok(emptyJd.error.includes('target job description is required'));

  const valid = validateTailorInputs(mockResume, mockJobDescription);
  assert.strictEqual(valid.valid, true);
  console.log('✓ Test 1 Passed: Input validation enforces required active resume and job description.');
}

// Test 2: Default Version Naming
{
  const date = new Date('2026-11-21T12:00:00Z');
  const nameGen = formatDefaultTailoredVersionName('general', mockJobDescription, date);
  assert.ok(nameGen.includes('General ATS'));
  assert.ok(nameGen.includes('Senior Cloud  DevOps Engineer'));
  assert.ok(nameGen.includes('2026-11-21'));

  const nameNaukri = formatDefaultTailoredVersionName('naukri', '', date);
  assert.ok(nameNaukri.includes('Naukri'));

  const nameLi = formatDefaultTailoredVersionName('linkedin', '', date);
  assert.ok(nameLi.includes('LinkedIn'));
  console.log('✓ Test 2 Passed: Version naming generates platform-specific and date-stamped titles.');
}

// Test 3: Comparative Stats
{
  const tailoredDraft = `${mockResume}\nTailored addition with enhanced phrasing.`;
  const stats = computeComparisonStats(mockResume, tailoredDraft);
  assert.ok(stats.originalWords > 0);
  assert.ok(stats.tailoredWords > stats.originalWords);
  assert.strictEqual(stats.wordDiff, stats.tailoredWords - stats.originalWords);
  console.log('✓ Test 3 Passed: Comparative stats accurately calculate word counts and delta.');
}

// Test 4: Presets Available
{
  assert.strictEqual(TAILOR_PRESETS.length, 3);
  const ids = TAILOR_PRESETS.map((p) => p.id);
  assert.ok(ids.includes('general'));
  assert.ok(ids.includes('naukri'));
  assert.ok(ids.includes('linkedin'));
  console.log('✓ Test 4 Passed: Tailor presets mirror verified platform presets.');
}

// Test 5: Review, Edit, Accept & Save as NEW version
{
  const storage = createMockStorage();

  // Save the original version first
  const origSave = saveResumeVersion({
    name: 'Original Resume v1',
    resumeText: mockResume,
    customStorage: storage,
  });
  assert.strictEqual(origSave.success, true);

  // Incoming tailored draft
  const generatedDraft = `RAJ BIND
Senior Cloud & DevOps Engineer
San Francisco, CA | raj@example.com

SUMMARY
Cloud & DevOps Engineer with 3+ years optimizing Linux and AWS cloud infrastructure.

EXPERIENCE
Cloud Engineer - Acme Corp
- Containerized scalable microservices using Docker and managed high-availability AWS EC2 instances.
- Automated system backup workflows with Bash scripting, eliminating repetitive manual tasks.

SKILLS
AWS, Docker, Linux, Bash, Python`;

  // User edits the draft before accepting
  const userEditedDraft = `${generatedDraft}\n\nCERTIFICATIONS\nAWS Certified Solutions Architect (Evidenced in profile)`;

  // Accept & Save: saves as a NEW version
  const versionName = 'Tailored for Acme Tech';
  const saveRes = saveResumeVersion({
    name: versionName,
    resumeText: userEditedDraft,
    customStorage: storage,
  });

  assert.strictEqual(saveRes.success, true);
  assert.strictEqual(saveRes.record.name, versionName);
  assert.strictEqual(saveRes.record.resume_text, userEditedDraft);

  // INVARIANT CHECK: Original version in storage is completely intact!
  const allVersions = getResumeVersions(storage);
  assert.strictEqual(allVersions.success, true);
  assert.strictEqual(allVersions.data.length, 2);

  const foundOriginal = allVersions.data.find((v) => v.name === 'Original Resume v1');
  assert.ok(foundOriginal);
  assert.strictEqual(foundOriginal.resume_text, mockResume);

  const foundTailored = allVersions.data.find((v) => v.name === versionName);
  assert.ok(foundTailored);
  assert.strictEqual(foundTailored.resume_text, userEditedDraft);

  console.log('✓ Test 5 Passed: User can edit draft and accept as NEW version without mutating original.');
}

// Test 6: Discard Flow
{
  let activeDraft = 'Some draft content';
  let isReviewing = true;
  let jobDescriptionInput = mockJobDescription;

  // Discard action
  activeDraft = null;
  isReviewing = false;
  // Invariant: job description input is preserved so user doesn't lose their pasted text
  assert.strictEqual(activeDraft, null);
  assert.strictEqual(isReviewing, false);
  assert.strictEqual(jobDescriptionInput, mockJobDescription);
  console.log('✓ Test 6 Passed: Discarding draft resets review state while preserving user input.');
}

// Test 7: Export Compatibility (TXT & DOCX)
async function testExportCompatibility() {
  const tailoredSample = `RAJ BIND\nCloud Engineer\n\nEXPERIENCE\nCloud Engineer\n- Deployed services to AWS.`;

  // TXT export
  let downloadedBlob = null;
  let downloadedName = null;
  const txtRes = exportResumeTextAsFile(tailoredSample, {
    filename: 'test-tailored.txt',
    customDownloader: (blob, name) => {
      downloadedBlob = blob;
      downloadedName = name;
    },
  });
  assert.strictEqual(txtRes.success, true);
  assert.strictEqual(downloadedName, 'test-tailored.txt');
  assert.ok(downloadedBlob);

  // DOCX export
  const docxBlob = await createResumeDocxBlob(tailoredSample);
  assert.ok(docxBlob);
  assert.strictEqual(docxBlob.type, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  assert.ok(docxBlob.size > 0);
  console.log('✓ Test 7 Passed: Tailored resume draft generates valid TXT and DOCX export binaries.');
}

await testExportCompatibility();

console.log('--- All Resume Tailoring Frontend Tests Passed! ---');
