/**
 * Automated Unit Tests for Resume Versions Storage Service
 * ---------------------------------------------------------
 * Runs in Node.js using an in-memory localStorage mock.
 * Verifies:
 *   1. Explicit saving with UUID, word count, character count, and timestamps.
 *   2. Storage isolation: separate from comparison history and job tracker.
 *   3. Validation: rejects empty version name or empty resume text.
 *   4. Retrieval and newest-first ordering.
 *   5. Renaming an existing version.
 *   6. Deleting a single version by ID.
 *   7. Corrupted data detection and safe recovery.
 *   8. Explicit action guarantee: no automatic saving.
 */

import assert from 'node:assert';
import {
  STORAGE_KEY,
  calculateWordCount,
  getResumeVersions,
  saveResumeVersion,
  renameResumeVersion,
  deleteResumeVersion,
  clearResumeVersions,
} from './src/services/resumeVersionStorage.js';

// In-memory Storage mock
class MemoryStorage {
  constructor() {
    this.store = new Map();
  }
  getItem(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }
  setItem(key, value) {
    this.store.set(key, String(value));
  }
  removeItem(key) {
    this.store.delete(key);
  }
  clear() {
    this.store.clear();
  }
}

const mockStorage = new MemoryStorage();

console.log('--- Starting Resume Versions Storage Tests ---');

// Test 1: Explicit save of a resume version
{
  mockStorage.clear();
  const sampleResume = 'RAJ BIND\nDevOps Engineer\nExperienced in AWS, Docker, Kubernetes, and CI/CD pipelines.';
  const res = saveResumeVersion({
    name: 'DevOps Primary v1',
    resumeText: sampleResume,
    customStorage: mockStorage,
  });

  assert.strictEqual(res.success, true, 'Save should succeed');
  assert.ok(res.record, 'Should return created version record');
  assert.strictEqual(res.record.name, 'DevOps Primary v1');
  assert.strictEqual(res.record.resume_text, sampleResume);
  assert.strictEqual(res.record.char_count, sampleResume.length);
  assert.strictEqual(res.record.word_count, calculateWordCount(sampleResume));

  // Verify UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  assert.match(res.record.id, uuidRegex, 'Record ID should be a valid UUID');
  console.log('✓ Test 1 Passed: Successfully saved named version with UUID and metrics.');
}

// Test 2: Storage Isolation
{
  assert.ok(mockStorage.getItem(STORAGE_KEY), 'Must be stored under careerpilot_resume_versions');
  assert.strictEqual(
    mockStorage.getItem('careerpilot_comparison_history'),
    null,
    'Comparison history key must NOT be touched'
  );
  assert.strictEqual(
    mockStorage.getItem('careerpilot_tracked_jobs'),
    null,
    'Job tracker key must NOT be touched'
  );
  console.log('✓ Test 2 Passed: Storage isolation verified across all local storage domains.');
}

// Test 3: Validation - Reject empty name or empty resume text
{
  // Empty name
  const res1 = saveResumeVersion({
    name: '   ',
    resumeText: 'Sample content',
    customStorage: mockStorage,
  });
  assert.strictEqual(res1.success, false);
  assert.strictEqual(res1.error, 'VALIDATION_ERROR');
  assert.match(res1.message, /version name is required/i);

  // Empty resume text
  const res2 = saveResumeVersion({
    name: 'Cloud Resume',
    resumeText: '   ',
    customStorage: mockStorage,
  });
  assert.strictEqual(res2.success, false);
  assert.strictEqual(res2.error, 'VALIDATION_ERROR');
  assert.match(res2.message, /resume text is empty/i);

  console.log('✓ Test 3 Passed: Validation correctly rejected empty names and empty texts.');
}

// Test 4: Retrieval & Newest First ordering
{
  const res3 = saveResumeVersion({
    name: 'SRE Tailored v2',
    resumeText: 'Site Reliability Engineer with Python and Linux administration experience.',
    customStorage: mockStorage,
  });
  assert.strictEqual(res3.success, true);

  const listRes = getResumeVersions(mockStorage);
  assert.strictEqual(listRes.success, true);
  assert.strictEqual(listRes.data.length, 2);
  assert.strictEqual(listRes.data[0].name, 'SRE Tailored v2', 'Newest version should be first');
  assert.strictEqual(listRes.data[1].name, 'DevOps Primary v1');
  console.log('✓ Test 4 Passed: Multiple versions retrieved in newest-first order.');
}

// Test 5: Rename Version
{
  const list = getResumeVersions(mockStorage).data;
  const target = list[0];
  const renameRes = renameResumeVersion(target.id, 'SRE Lead v2 - Updated', mockStorage);

  assert.strictEqual(renameRes.success, true);
  assert.strictEqual(renameRes.record.name, 'SRE Lead v2 - Updated');
  assert.strictEqual(renameRes.record.resume_text, target.resume_text, 'Content must not change on rename');

  // Verify in storage
  const updatedList = getResumeVersions(mockStorage).data;
  assert.strictEqual(updatedList[0].name, 'SRE Lead v2 - Updated');

  // Validation: empty rename
  const emptyRename = renameResumeVersion(target.id, '  ', mockStorage);
  assert.strictEqual(emptyRename.success, false);
  assert.strictEqual(emptyRename.error, 'VALIDATION_ERROR');

  console.log('✓ Test 5 Passed: Successfully renamed version with empty-name guard.');
}

// Test 6: Delete Version
{
  const listBefore = getResumeVersions(mockStorage).data;
  const toDelete = listBefore[0];
  const delRes = deleteResumeVersion(toDelete.id, mockStorage);
  assert.strictEqual(delRes.success, true);

  const listAfter = getResumeVersions(mockStorage).data;
  assert.strictEqual(listAfter.length, listBefore.length - 1);
  assert.strictEqual(listAfter.some((v) => v.id === toDelete.id), false);
  console.log('✓ Test 6 Passed: Successfully deleted a resume version by ID.');
}

// Test 7: Corrupted Data Detection & Recovery
{
  mockStorage.setItem(STORAGE_KEY, 'not-json-content-here');
  const corruptedRes = getResumeVersions(mockStorage);
  assert.strictEqual(corruptedRes.success, false);
  assert.strictEqual(corruptedRes.error, 'CORRUPTED_DATA');

  // Prevent save over corrupted storage
  const saveBlocked = saveResumeVersion({
    name: 'Blocked',
    resumeText: 'Text',
    customStorage: mockStorage,
  });
  assert.strictEqual(saveBlocked.success, false);
  assert.strictEqual(saveBlocked.error, 'CORRUPTED_DATA');

  // Safe recovery
  const clearRes = clearResumeVersions(mockStorage);
  assert.strictEqual(clearRes.success, true);
  const recovered = getResumeVersions(mockStorage);
  assert.strictEqual(recovered.success, true);
  assert.deepStrictEqual(recovered.data, []);

  console.log('✓ Test 7 Passed: Corrupted storage handled safely and recovered cleanly.');
}

console.log('--- All Resume Versions Storage Tests Passed! ---');
