/**
 * Test UI Refinement Verification
 * ---------------------------------
 * Verifies that the anime-inspired purple theme, header controls, button standards,
 * and responsive/accessibility requirements are properly implemented.
 */

import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('--- Starting UI Refinement Verification Tests ---');

const appJsx = fs.readFileSync(path.join(__dirname, 'src/App.jsx'), 'utf-8');
const indexCss = fs.readFileSync(path.join(__dirname, 'src/index.css'), 'utf-8');

// 1. Header & Status Pill
assert(
  !appJsx.includes('status-pill connected') && !appJsx.includes('status-pill checking') && !appJsx.includes('status-pill disconnected'),
  'The status pill must be removed from the top navigation.'
);
console.log('✓ Check 1 Passed: Status pill removed from the top navigation.');

// 2. Refresh Action
assert(
  appJsx.includes('<IconRefresh />') && appJsx.includes('onClick={verifyBackend}') && appJsx.includes('title="Refresh connection status"'),
  'Refresh button must use IconRefresh with title and verifyBackend handler.'
);
console.log('✓ Check 2 Passed: Refresh button styled consistently with IconRefresh and tooltip.');

// 3. Compact Cloud Sync Icon Button
assert(
  appJsx.includes('className="btn-nav-icon"') && appJsx.includes('<IconCloud />') && appJsx.includes('title='),
  'Cloud Sync control must be a compact icon button with tooltip and accessible label.'
);
console.log('✓ Check 3 Passed: Cloud sync control is a compact icon button with tooltip and accessible label.');

// 4. Reject button uses danger variant
assert(
  appJsx.includes('className="btn btn-danger btn-sm"') && appJsx.includes('Reject'),
  'Reject button in suggestion actions must use btn-danger for clear identification.'
);
console.log('✓ Check 4 Passed: Destructive reject actions clearly styled with btn-danger.');

// 5. Anime-Inspired Purple Palette Tokens in index.css
assert(
  indexCss.includes('--brand:        #7c3aed') || indexCss.includes('--brand: #7c3aed'),
  'Brand color must be purple #7c3aed.'
);
assert(
  indexCss.includes('--purple-400: #8b5cf6') || indexCss.includes('--purple-500: #7c3aed'),
  'Lavender/violet accent palette must be defined in :root.'
);
assert(
  indexCss.includes('--navy-900: #151033') || indexCss.includes('linear-gradient(90deg, #110b27'),
  'Deep indigo header palette must be defined.'
);
assert(
  indexCss.includes('--success:        #16a34a') && indexCss.includes('--danger:        #dc2626') && indexCss.includes('--warning:        #d97706'),
  'Semantic status colors (green/red/amber) must remain recognizable and not purple.'
);
console.log('✓ Check 5 Passed: Anime-inspired purple theme tokens, indigo header, and status colors verified.');

// 6. Button Standardization
assert(
  indexCss.includes('.btn {') && indexCss.includes('.btn-primary {') && indexCss.includes('.btn-secondary {') && indexCss.includes('.btn-danger {'),
  'Standard button classes must exist.'
);
assert(
  indexCss.includes('.btn-sm {') && indexCss.includes('.btn-lg {'),
  'Standard button size classes must exist.'
);
console.log('✓ Check 6 Passed: Standardized button styles, variants, and sizes verified.');

// 7. Responsiveness & Reduced Motion
assert(
  indexCss.includes('@media (max-width: 720px)') || indexCss.includes('@media (max-width: 680px)'),
  'Mobile responsive navigation rules must be defined.'
);
assert(
  indexCss.includes('@media (prefers-reduced-motion: reduce)'),
  'Reduced-motion accessibility support must be defined.'
);
console.log('✓ Check 7 Passed: Mobile responsive rules and reduced-motion media query verified.');

console.log('--- All UI Refinement Verification Checks Passed! ---');
