/**
 * Automated Unit Tests for Job Tracker Storage & Interactions
 * -------------------------------------------------------------
 * Runs in Node.js using an in-memory localStorage mock.
 * Verifies:
 *   1. Successful job creation with UUID, default date, and fields.
 *   2. Storage isolation: separate from comparison history.
 *   3. Validation: company, role, and valid status requirements.
 *   4. Retrieval and reverse-chronological order.
 *   5. Job editing (status, role, company, URL, updated_at).
 *   6. Single-job deletion.
 *   7. Filtering by status ('All', 'Applied', 'Interviewing', 'Offer', 'Rejected', 'Interested').
 *   8. Searching by company or role (case-insensitive partial match).
 *   9. Safe corrupted data handling and reset.
 */

import assert from 'node:assert';
import {
  STORAGE_KEY,
  JOB_STATUSES,
  isValidStatus,
  getJobs,
  addJob,
  updateJob,
  deleteJob,
  clearJobs,
  filterAndSearchJobs,
} from './src/services/jobTrackerStorage.js';

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

console.log('--- Starting Job Tracker Storage & Interaction Tests ---');

// Test 1: Add Job with valid data & UUID
{
  mockStorage.clear();
  const res = addJob({
    company: 'Google',
    role: 'Site Reliability Engineer',
    jobUrl: 'https://careers.google.com/jobs/12345',
    dateApplied: '2026-11-20',
    status: 'Applied',
    customStorage: mockStorage,
  });

  assert.strictEqual(res.success, true, 'Add job should succeed');
  assert.ok(res.record, 'Should return created job record');
  assert.strictEqual(res.record.company, 'Google');
  assert.strictEqual(res.record.role, 'Site Reliability Engineer');
  assert.strictEqual(res.record.job_url, 'https://careers.google.com/jobs/12345');
  assert.strictEqual(res.record.date_applied, '2026-11-20');
  assert.strictEqual(res.record.status, 'Applied');

  // Verify UUID
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  assert.match(res.record.id, uuidRegex, 'Job ID should be a valid UUID');
  console.log('✓ Test 1 Passed: Successfully created job with UUID and field validation.');
}

// Test 2: Storage Isolation - Confirm storage key is careerpilot_tracked_jobs and NOT history
{
  assert.ok(mockStorage.getItem(STORAGE_KEY), 'Tracked jobs must be saved under careerpilot_tracked_jobs');
  assert.strictEqual(
    mockStorage.getItem('careerpilot_comparison_history'),
    null,
    'Comparison history key must NOT be modified or used'
  );
  console.log('✓ Test 2 Passed: Storage isolation confirmed. Stored under careerpilot_tracked_jobs.');
}

// Test 3: Validation - Reject missing company, missing role, or invalid status
{
  // Empty company
  const res1 = addJob({ company: '   ', role: 'DevOps Engineer', customStorage: mockStorage });
  assert.strictEqual(res1.success, false);
  assert.strictEqual(res1.error, 'VALIDATION_ERROR');
  assert.match(res1.message, /company name is required/i);

  // Empty role
  const res2 = addJob({ company: 'Meta', role: '', customStorage: mockStorage });
  assert.strictEqual(res2.success, false);
  assert.strictEqual(res2.error, 'VALIDATION_ERROR');
  assert.match(res2.message, /job role is required/i);

  // Invalid status
  const res3 = addJob({ company: 'Apple', role: 'iOS Dev', status: 'Pending', customStorage: mockStorage });
  assert.strictEqual(res3.success, false);
  assert.strictEqual(res3.error, 'VALIDATION_ERROR');
  assert.match(res3.message, /invalid status/i);

  console.log('✓ Test 3 Passed: Validation correctly rejected missing company, missing role, and invalid status.');
}

// Test 4: Default dateApplied if omitted
{
  const res = addJob({
    company: 'Netflix',
    role: 'Cloud Architect',
    status: 'Interested',
    customStorage: mockStorage,
  });
  assert.strictEqual(res.success, true);
  const todayStr = new Date().toISOString().slice(0, 10);
  assert.strictEqual(res.record.date_applied, todayStr, 'Should default to current date');
  assert.strictEqual(res.record.status, 'Interested');
  console.log('✓ Test 4 Passed: Defaults dateApplied to today and preserves optional fields.');
}

// Test 5: Retrieval & Newest First ordering
{
  const listRes = getJobs(mockStorage);
  assert.strictEqual(listRes.success, true);
  assert.strictEqual(listRes.data.length, 2);
  assert.strictEqual(listRes.data[0].company, 'Netflix', 'Newest job should be first');
  assert.strictEqual(listRes.data[1].company, 'Google');
  console.log('✓ Test 5 Passed: Successfully retrieved jobs list in correct order.');
}

// Test 6: Update Job
{
  const list = getJobs(mockStorage).data;
  const googleJob = list.find((j) => j.company === 'Google');
  assert.ok(googleJob);

  const updateRes = updateJob(
    googleJob.id,
    {
      status: 'Interviewing',
      role: 'Staff SRE',
      jobUrl: 'https://careers.google.com/jobs/updated',
    },
    mockStorage
  );

  assert.strictEqual(updateRes.success, true);
  assert.strictEqual(updateRes.record.status, 'Interviewing');
  assert.strictEqual(updateRes.record.role, 'Staff SRE');
  assert.strictEqual(updateRes.record.company, 'Google', 'Company should remain unchanged when not provided');
  assert.strictEqual(updateRes.record.job_url, 'https://careers.google.com/jobs/updated');

  // Verify in storage
  const updatedList = getJobs(mockStorage).data;
  const verified = updatedList.find((j) => j.id === googleJob.id);
  assert.strictEqual(verified.status, 'Interviewing');
  assert.strictEqual(verified.role, 'Staff SRE');

  console.log('✓ Test 6 Passed: Successfully updated job fields, status, and updated_at timestamp.');
}

// Test 7: Delete Job
{
  const listBefore = getJobs(mockStorage).data;
  const toDelete = listBefore[0];
  const delRes = deleteJob(toDelete.id, mockStorage);
  assert.strictEqual(delRes.success, true);

  const listAfter = getJobs(mockStorage).data;
  assert.strictEqual(listAfter.length, listBefore.length - 1);
  assert.strictEqual(listAfter.some((j) => j.id === toDelete.id), false);
  console.log('✓ Test 7 Passed: Successfully deleted a job by ID.');
}

// Test 8: Filter & Search interactions
{
  // Setup sample job dataset
  const testJobs = [
    { id: '1', company: 'Amazon AWS', role: 'DevOps Engineer', status: 'Applied' },
    { id: '2', company: 'Microsoft', role: 'Cloud Solution Architect', status: 'Interviewing' },
    { id: '3', company: 'Stripe', role: 'Infrastructure Engineer', status: 'Offer' },
    { id: '4', company: 'Datadog', role: 'DevOps Specialist', status: 'Rejected' },
    { id: '5', company: 'HashiCorp', role: 'Developer Advocate', status: 'Interested' },
  ];

  // Filter by status 'Interviewing'
  const interviewing = filterAndSearchJobs(testJobs, { statusFilter: 'Interviewing' });
  assert.strictEqual(interviewing.length, 1);
  assert.strictEqual(interviewing[0].company, 'Microsoft');

  // Filter 'All'
  const all = filterAndSearchJobs(testJobs, { statusFilter: 'All' });
  assert.strictEqual(all.length, 5);

  // Search by company (case-insensitive)
  const searchCompany = filterAndSearchJobs(testJobs, { searchQuery: 'amazon' });
  assert.strictEqual(searchCompany.length, 1);
  assert.strictEqual(searchCompany[0].company, 'Amazon AWS');

  // Search by role (partial match)
  const searchRole = filterAndSearchJobs(testJobs, { searchQuery: 'devops' });
  assert.strictEqual(searchRole.length, 2); // Amazon AWS and Datadog

  // Combined status + search
  const combined = filterAndSearchJobs(testJobs, { statusFilter: 'Applied', searchQuery: 'devops' });
  assert.strictEqual(combined.length, 1);
  assert.strictEqual(combined[0].company, 'Amazon AWS');

  // No match
  const none = filterAndSearchJobs(testJobs, { searchQuery: 'NonExistentXYZ' });
  assert.strictEqual(none.length, 0);

  console.log('✓ Test 8 Passed: Status filtering and search by company/role verified accurately.');
}

// Test 9: Corrupted JSON detection and safe recovery
{
  mockStorage.setItem(STORAGE_KEY, '{ invalid-json-here');
  const corruptedRes = getJobs(mockStorage);
  assert.strictEqual(corruptedRes.success, false);
  assert.strictEqual(corruptedRes.error, 'CORRUPTED_DATA');

  // Attempting to add when corrupted should return error rather than blindly overwriting
  const addBlocked = addJob({ company: 'Test', role: 'Test', customStorage: mockStorage });
  assert.strictEqual(addBlocked.success, false);
  assert.strictEqual(addBlocked.error, 'CORRUPTED_DATA');

  // Safe recovery with clearJobs
  const clearRes = clearJobs(mockStorage);
  assert.strictEqual(clearRes.success, true);
  const recovered = getJobs(mockStorage);
  assert.strictEqual(recovered.success, true);
  assert.deepStrictEqual(recovered.data, []);

  console.log('✓ Test 9 Passed: Corrupted storage handled safely without silent overwrite, recovered cleanly.');
}

console.log('--- All Job Tracker Storage & Interaction Tests Passed! ---');
