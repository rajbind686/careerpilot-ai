/**
 * Automated Unit Tests for Milestone 4 History Storage
 * ----------------------------------------------------
 * Runs in Node.js using an in-memory localStorage mock.
 * Verifies:
 *   1. Successful save using crypto.randomUUID().
 *   2. Privacy guarantee: NO resume text or job description text in storage.
 *   3. Empty job title validation.
 *   4. Retrieval and persistence.
 *   5. Single-item deletion.
 *   6. Corrupt JSON detection without silent overwrite.
 *   7. Safe recovery via clearHistory().
 */

import assert from 'node:assert';
import {
  getHistory,
  saveComparison,
  deleteComparison,
  clearHistory,
} from './src/services/historyStorage.js';

// Simple in-memory Storage mock
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

// Sample comparison result (simulating /api/compare response)
const sampleResult = {
  status: 'success',
  dictionary_size: 40,
  summary: {
    supported_terms_found_count: 3,
    supported_terms_missing_count: 1,
    total_supported_job_terms: 4,
    overlap_percentage: 75,
  },
  matched_terms: [
    { term: 'Python', occurrences_in_resume: 2, occurrences_in_job: 1 },
    { term: 'FastAPI', occurrences_in_resume: 1, occurrences_in_job: 1 },
    { term: 'Docker', occurrences_in_resume: 1, occurrences_in_job: 1 },
  ],
  missing_terms: [
    { term: 'Kubernetes', occurrences_in_job: 1, guidance: 'Consider adding if experienced.' },
  ],
};

console.log('--- Starting Milestone 4 History Storage Tests ---');

// Test 1: Save comparison & UUID format
{
  mockStorage.clear();
  const res = saveComparison({
    jobTitle: 'Backend Engineer',
    companyName: 'Acme Corp',
    comparisonResult: sampleResult,
    customStorage: mockStorage,
  });

  assert.strictEqual(res.success, true, 'Save should succeed');
  assert.ok(res.record, 'Should return saved record');
  assert.strictEqual(res.record.job_title, 'Backend Engineer');
  assert.strictEqual(res.record.company_name, 'Acme Corp');

  // Verify crypto.randomUUID() format (36 chars: 8-4-4-4-12)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  assert.match(res.record.id, uuidRegex, 'Record ID should be a valid UUID');
  console.log('✓ Test 1 Passed: Successfully saved with crypto.randomUUID().');
}

// Test 2: Privacy Guarantee - Confirm NO resume text or job description text in storage
{
  const rawSaved = mockStorage.getItem('careerpilot_comparison_history');
  assert.doesNotMatch(rawSaved, /resume_text/i, 'Storage must NOT contain resume_text');
  assert.doesNotMatch(rawSaved, /job_description/i, 'Storage must NOT contain job_description');
  console.log('✓ Test 2 Passed: Privacy verified. No resume text or job description text saved.');
}

// Test 3: Validation - Empty Job Title rejected
{
  const res = saveComparison({
    jobTitle: '   ',
    companyName: 'Acme',
    comparisonResult: sampleResult,
    customStorage: mockStorage,
  });

  assert.strictEqual(res.success, false);
  assert.strictEqual(res.error, 'VALIDATION_ERROR');
  console.log('✓ Test 3 Passed: Empty Job Title rejected with clear validation error.');
}

// Test 4: Retrieve History
{
  const res = getHistory(mockStorage);
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.data.length, 1);
  assert.strictEqual(res.data[0].summary.overlap_percentage, 75);
  console.log('✓ Test 4 Passed: History retrieved accurately.');
}

// Test 5: Delete single item by ID
{
  const listBefore = getHistory(mockStorage).data;
  const idToDelete = listBefore[0].id;

  const delRes = deleteComparison(idToDelete, mockStorage);
  assert.strictEqual(delRes.success, true);

  const listAfter = getHistory(mockStorage).data;
  assert.strictEqual(listAfter.length, 0, 'History should now be empty');
  console.log('✓ Test 5 Passed: Single record deleted successfully.');
}

// Test 6: Corrupted JSON handling without silent overwrite
{
  mockStorage.setItem('careerpilot_comparison_history', 'NOT_VALID_JSON{malformed');

  // getHistory should report CORRUPTED_DATA rather than crashing or returning []
  const getRes = getHistory(mockStorage);
  assert.strictEqual(getRes.success, false);
  assert.strictEqual(getRes.error, 'CORRUPTED_DATA');

  // saveComparison should refuse to overwrite corrupt data
  const saveRes = saveComparison({
    jobTitle: 'DevOps Engineer',
    comparisonResult: sampleResult,
    customStorage: mockStorage,
  });
  assert.strictEqual(saveRes.success, false);
  assert.strictEqual(saveRes.error, 'CORRUPTED_DATA');
  console.log('✓ Test 6 Passed: Corrupted JSON detected safely without silent overwrite.');
}

// Test 7: Safe recovery via clearHistory()
{
  const clearRes = clearHistory(mockStorage);
  assert.strictEqual(clearRes.success, true);

  const getRes = getHistory(mockStorage);
  assert.strictEqual(getRes.success, true);
  assert.strictEqual(getRes.data.length, 0);
  console.log('✓ Test 7 Passed: Safe recovery via clearHistory() resets storage.');
}

console.log('--- All Milestone 4 Storage Tests Passed! ---');
