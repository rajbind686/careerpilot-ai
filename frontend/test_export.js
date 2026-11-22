/**
 * Automated Unit Tests for Milestone 5 Export Service
 * ----------------------------------------------------
 * Runs in Node.js.
 * Verifies:
 *   1. Date-based safe filename formatting (careerpilot-resume-edited-YYYY-MM-DD.txt).
 *   2. Rejection of empty or whitespace-only text with specific error message.
 *   3. Correct MIME type (text/plain;charset=utf-8).
 *   4. Content integrity: exact match without added metadata, watermarks, or altered text.
 *   5. Safe execution with dependency-injected mock downloader (no real browser required).
 */

import assert from 'node:assert';
import {
  formatExportFilename,
  createResumeTextBlob,
  exportResumeTextAsFile,
} from './src/services/exportService.js';

console.log('--- Starting Milestone 5 Export Service Tests ---');

// Test 1: Filename Format Verification
{
  const filenamePattern = /^careerpilot-resume-edited-\d{4}-\d{2}-\d{2}\.txt$/;
  const currentFilename = formatExportFilename();
  assert.match(
    currentFilename,
    filenamePattern,
    `Filename "${currentFilename}" does not match expected pattern.`
  );

  // Test deterministic date
  const fixedDate = new Date(2026, 10, 21); // Month is 0-indexed: 10 = November
  const expectedName = 'careerpilot-resume-edited-2026-11-21.txt';
  assert.strictEqual(
    formatExportFilename(fixedDate),
    expectedName,
    'Filename did not format specific date accurately.'
  );

  // Safe filename character set check: only lowercase letters, numbers, hyphens, and .txt
  assert.match(
    currentFilename,
    /^[a-z0-9\-]+\.txt$/,
    'Filename contains unexpected characters.'
  );
  console.log('✓ Test 1 Passed: Predictable, safe filename format verified.');
}

// Test 2: Rejection of Empty or Whitespace-Only Text
{
  const emptyCases = ['', '   ', '\n\t  \n', null, undefined];

  for (const emptyInput of emptyCases) {
    assert.throws(
      () => createResumeTextBlob(emptyInput),
      (err) => err instanceof Error && err.message === 'Cannot export empty resume text.',
      `createResumeTextBlob should throw for empty input: "${emptyInput}"`
    );

    assert.throws(
      () => exportResumeTextAsFile(emptyInput),
      (err) => err instanceof Error && err.message === 'Cannot export empty resume text.',
      `exportResumeTextAsFile should throw for empty input: "${emptyInput}"`
    );
  }
  console.log('✓ Test 2 Passed: Empty and whitespace-only text rejected with exact error message.');
}

// Test 3: MIME Type Verification
{
  const sampleText = 'Jane Doe\nSoftware Engineer\nPython, FastAPI, SQL';
  const blob = createResumeTextBlob(sampleText);
  assert.strictEqual(blob.type, 'text/plain;charset=utf-8', 'Blob MIME type must be text/plain;charset=utf-8');
  console.log('✓ Test 3 Passed: Blob MIME type verified as text/plain;charset=utf-8.');
}

// Test 4: Content Integrity (Exact text match without metadata or alterations)
{
  const rawResumeText =
    'Jane Doe\n' +
    'Email: jane@example.com\n\n' +
    'Experience:\n' +
    '- Maintained Python backend services.\n' +
    '- Designed RESTful APIs using FastAPI.\n\n' +
    'Skills: Python, FastAPI, Docker, SQL, Git.';

  let capturedBlob = null;
  let capturedFilename = null;

  const mockDownloader = (blob, filename) => {
    capturedBlob = blob;
    capturedFilename = filename;
  };

  const fixedDate = new Date(2026, 10, 21);
  const result = exportResumeTextAsFile(rawResumeText, {
    date: fixedDate,
    customDownloader: mockDownloader,
  });

  assert.strictEqual(result.success, true);
  assert.strictEqual(result.filename, 'careerpilot-resume-edited-2026-11-21.txt');
  assert.strictEqual(capturedFilename, 'careerpilot-resume-edited-2026-11-21.txt');
  assert.ok(capturedBlob, 'Downloader should receive the Blob instance.');

  // Extract text from Blob and verify exact match
  const extractedText = await capturedBlob.text();
  assert.strictEqual(
    extractedText,
    rawResumeText,
    'Exported text must be an exact character-for-character match with the input text.'
  );

  // Assert no unauthorized metadata, watermarks, or skill injections exist
  assert.doesNotMatch(extractedText, /CareerPilot AI/i, 'Export must NOT contain injected branding or watermarks.');
  assert.doesNotMatch(extractedText, /Metadata/i, 'Export must NOT contain injected metadata.');
  console.log('✓ Test 4 Passed: Content integrity verified. Exact match with zero injected metadata.');
}

console.log('--- All Milestone 5 Export Tests Passed! ---');
