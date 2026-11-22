/**
 * Regression Test Suite: Tailor Tab Switching & Blank Screen Protection
 * ----------------------------------------------------------------------
 * Verifies:
 *   1. Switching activeTab to 'tailor' with empty resume does NOT throw or render blank.
 *   2. Switching activeTab to 'tailor' with active resume loaded renders resume status
 *      without throwing ReferenceError for undeclared variables (e.g. currentResumeName).
 *   3. Rendering Tailor review mode with generated draft, changed sections, and
 *      unevidenced requirements renders complete HTML without crashing.
 *   4. ErrorBoundary catches component render errors safely and prevents blank screen.
 */

import assert from 'node:assert';
import fs from 'node:fs';
import esbuild from 'esbuild';
import React from 'react';
import { renderToString } from 'react-dom/server';

console.log('--- Starting Tailor Tab Switching & Render Regression Tests ---');

// Compile ErrorBoundary.jsx via esbuild for Node
const ebResult = await esbuild.build({
  entryPoints: ['src/ErrorBoundary.jsx'],
  bundle: false,
  format: 'esm',
  write: false,
});
const ebTemp = 'src/test_eb_eval.js';
fs.writeFileSync(ebTemp, ebResult.outputFiles[0].text);
const ebMod = await import(`./${ebTemp}`);
const ErrorBoundary = ebMod.ErrorBoundary;
fs.unlinkSync(ebTemp);

// Mock browser globals for SSR / node render testing
globalThis.window = {
  localStorage: {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  },
  confirm: () => true,
  alert: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
  location: { reload: () => {} },
};
globalThis.fetch = () =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ configured: false, message: 'Unconfigured test' }),
  });

// Bundle and transpile App.jsx for server-side evaluation
async function getAppModule(sourceTransform = (src) => src) {
  let appSource = fs.readFileSync('src/App.jsx', 'utf-8');
  appSource = sourceTransform(appSource);

  const result = await esbuild.build({
    stdin: {
      contents: appSource,
      resolveDir: 'src',
      loader: 'jsx',
      sourcefile: 'src/App.jsx',
    },
    bundle: true,
    external: ['react', 'react-dom', 'docx'],
    format: 'esm',
    write: false,
  });

  const tempFile = `src/test_app_eval_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.js`;
  fs.writeFileSync(tempFile, result.outputFiles[0].text);
  try {
    const mod = await import(`./${tempFile}`);
    return mod.default;
  } finally {
    if (fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile);
    }
  }
}

// Test 1: Switching to 'tailor' tab with empty resume
{
  const AppTailorEmpty = await getAppModule((src) =>
    src.replace("useState('analyser')", "useState('tailor')")
  );

  let html = '';
  assert.doesNotThrow(() => {
    html = renderToString(React.createElement(AppTailorEmpty));
  }, 'Switching to tailor tab with empty resume must not throw');

  assert.ok(html.length > 500, 'Rendered HTML must not be blank');
  assert.ok(html.includes('Tailor Resume to Job'), 'Must render page header');
  assert.ok(html.includes('Target Platform Preset'), 'Must render preset selector');
  assert.ok(html.includes('Target Job Description'), 'Must render JD textarea');
  assert.ok(html.includes('No resume loaded'), 'Must render missing resume status box');
  assert.ok(!html.includes('currentResumeName'), 'Must not reference undefined currentResumeName');

  console.log('✓ Test 1 Passed: Switching to Tailor tab with empty resume renders clean input view without blank screen.');
}

// Test 2: Switching to 'tailor' tab with active resume loaded
{
  const AppTailorWithResume = await getAppModule((src) => {
    let modified = src.replace("useState('analyser')", "useState('tailor')");
    // Pre-populate workingResumeText
    modified = modified.replace(
      "const [workingResumeText, setWorkingResumeText] = useState('');",
      "const [workingResumeText, setWorkingResumeText] = useState('RAJ BIND\\nCloud Engineer\\nAWS, Linux');"
    );
    return modified;
  });

  let html = '';
  assert.doesNotThrow(() => {
    html = renderToString(React.createElement(AppTailorWithResume));
  }, 'Switching to tailor tab with active resume must not throw ReferenceError');

  assert.ok(html.length > 500, 'Rendered HTML must not be blank');
  assert.ok(html.includes('Active Resume:'), 'Must render active resume box');
  assert.ok(html.includes('words loaded in editor'), 'Must render word count');
  assert.ok(!html.includes('ReferenceError'), 'Must not contain any reference error');

  console.log('✓ Test 2 Passed: Switching to Tailor tab with active resume renders resume status correctly without ReferenceError.');
}

// Test 3: Rendering Tailor tab in Review Mode (generated draft populated)
{
  const AppTailorReview = await getAppModule((src) => {
    let modified = src.replace("useState('analyser')", "useState('tailor')");
    modified = modified.replace(
      "const [tailorDraft, setTailorDraft] = useState(null);",
      `const [tailorDraft, setTailorDraft] = useState({
        preset: 'general',
        headline: 'Senior Cloud Engineer',
        summary_critique: 'Tailored for cloud scale.',
        tailored_resume_text: 'RAJ BIND\\nSenior Cloud Engineer\\n\\nSUMMARY\\nOptimized AWS cloud infrastructure.',
        sections_changed: [
          {
            section: 'summary',
            original_snippet: 'DevOps engineer with AWS.',
            tailored_snippet: 'Optimized AWS cloud infrastructure.',
            explanation: 'Strengthened evidenced accomplishments.'
          }
        ],
        unsupported_requirements: [
          {
            requirement: 'Kubernetes',
            explanation: 'Required by job posting but not evidenced in resume.',
            question_to_confirm: 'Do you have hands-on experience with Kubernetes?'
          }
        ]
      });`
    );
    return modified;
  });

  let html = '';
  assert.doesNotThrow(() => {
    html = renderToString(React.createElement(AppTailorReview));
  }, 'Review mode render must not throw');

  assert.ok(html.includes('Tailored Resume Draft (Review Mode)'), 'Must render review header');
  assert.ok(html.includes('Not Evidenced in Your Resume'), 'Must render unevidenced requirements');
  assert.ok(html.includes('Kubernetes'), 'Must list unevidenced skill');
  assert.ok(html.includes('Section-by-Section Adjustments'), 'Must render section diffs');
  assert.ok(html.includes('Save as New Resume Version'), 'Must render version save card');
  assert.ok(html.includes('Complete Tailored Resume Draft'), 'Must render draft preview');

  console.log('✓ Test 3 Passed: Review Mode renders complete tailored draft, diffs, and unevidenced skills without crashing.');
}

// Test 4: ErrorBoundary states and fallback UI render
{
  const error = new Error('Simulated component render failure');
  const derivedState = ErrorBoundary.getDerivedStateFromError(error);
  assert.strictEqual(derivedState.hasError, true);
  assert.strictEqual(derivedState.error, error);

  const ebInstance = new ErrorBoundary({});
  ebInstance.state = derivedState;
  const fallbackHtml = renderToString(ebInstance.render());
  assert.ok(fallbackHtml.includes('Application Render Error'), 'Must render error title');
  assert.ok(fallbackHtml.includes('Simulated component render failure'), 'Must display error message');
  assert.ok(fallbackHtml.includes('Reload Application'), 'Must provide reload action');

  console.log('✓ Test 4 Passed: ErrorBoundary safely captures errors and renders recovery UI.');
}

console.log('--- All Tailor Tab Switching & Render Regression Tests Passed! ---');
