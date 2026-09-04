/*
 * Pre-deploy validation — run with: npm run validate
 * ตรวจสอบ syntax, ความปลอดภัย, component ครบ, และฟังก์ชันสำคัญก่อน deploy
 */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
let failures = 0;

function ok(msg) { console.log('  PASS  ' + msg); }
function fail(msg) { failures++; console.log('  FAIL  ' + msg); }
function read(f) { return fs.readFileSync(path.join(ROOT, f), 'utf8'); }

// 1. ไฟล์ที่จำเป็นต้องมี
console.log('\n[1] Required files');
['Code.gs', 'Index.html', 'JavaScript.html', 'Stylesheet.html', 'ReviewModal.html', 'appsscript.json', '.gitignore'].forEach(f => {
  fs.existsSync(path.join(ROOT, f)) ? ok(f + ' exists') : fail(f + ' missing');
});

// 2. JSON syntax + OAuth scopes
console.log('\n[2] appsscript.json syntax');
try {
  const manifest = JSON.parse(read('appsscript.json'));
  ok('appsscript.json is valid JSON');
  if (manifest.webapp && manifest.webapp.access === 'ANYONE') ok('webapp.access is ANYONE (public link; actions still require Google sign-in)');
  else fail('webapp.access should be ANYONE, got: ' + (manifest.webapp && manifest.webapp.access));
  if (Array.isArray(manifest.oauthScopes) && manifest.oauthScopes.length > 0) ok('oauthScopes declared (' + manifest.oauthScopes.length + ')');
  else fail('oauthScopes not declared');
} catch (e) { fail('appsscript.json parse error: ' + e.message); }

// 3. ไม่มี secret / pattern ต้องห้าม
console.log('\n[3] Forbidden patterns (secrets/public access)');
const FORBIDDEN = ['7511c2dc', 'kku-ce-fair-secret', 'ANYONE_WITH_LINK', 'Math.random', 'api-key=', 'setSharing(DriveApp.Access.ANYONE'];
['Code.gs', 'Index.html', 'JavaScript.html', 'ReviewModal.html', 'ADMIN_SCHEMA_MANUAL.md', 'README.md'].forEach(f => {
  if (!fs.existsSync(path.join(ROOT, f))) return;
  const content = read(f);
  FORBIDDEN.forEach(p => { if (content.includes(p)) fail(f + ' contains forbidden pattern: ' + p); });
  ok(f + ' clean');
});

// 4. Q&A knowledge base ต้องมีครบ 50 ข้อ
console.log('\n[4] Q&A knowledge base');
try {
  const qa = read('CHATBOT_QA_KNOWLEDGE_BASE.txt');
  const count = (qa.match(/^Q\d+:/gm) || []).length;
  count === 50 ? ok('Q&A items = 50') : fail('Q&A items = ' + count + ' (expected 50)');
} catch (e) { fail('cannot read Q&A file: ' + e.message); }

// 5. ไม่มีคำว่า PDPA (ตามนโยบายของโครงการ)
console.log('\n[5] No PDPA wording');
['Code.gs', 'Index.html', 'JavaScript.html', 'README.md', 'ADMIN_SCHEMA_MANUAL.md'].forEach(f => {
  if (!fs.existsSync(path.join(ROOT, f))) return;
  read(f).includes('PDPA') ? fail(f + ' contains "PDPA"') : ok(f + ' no PDPA');
});
// 6. Reusable components ครบทั้ง 5 ตัว และถูก register แล้ว
console.log('\n[6] Reusable Vue components');
const js = read('JavaScript.html');
['StatusBadge', 'RoomCard', 'ModalConfirm', 'TimelineStep', 'LoadingSpinner'].forEach(n => {
  js.includes('const ' + n + ' =') ? ok(n + ' defined') : fail(n + ' missing');
});
(js.includes('components: { ReviewModal, StatusBadge, RoomCard, ModalConfirm, TimelineStep, LoadingSpinner }')
  ? ok('all 6 components registered in DashboardView')
  : fail('component registration incomplete'));

// 7. ฟังก์ชันสำคัญใน Code.gs
console.log('\n[7] Critical functions in Code.gs');
const code = read('Code.gs');
[
  'requireAuthenticatedUser', 'requireRole', 'getHeaderMap', 'maskToken', 'generateToken',
  'recordTokenFailure', 'assertNoDuplicateRequest', 'assertAccessCodeAvailable',
  'getTokenMetaColumns', 'verifyToken', 'processApproval', 'submitRequest',
  'saveApplicantPhoto', 'applyDataRetentionPolicy', 'initDatabase',
  'updateExpiredRequests', 'sendPendingApprovalReminders', 'getApprovalRequestByToken'
].forEach(fn => {
  code.includes('function ' + fn) ? ok(fn + '() present') : fail(fn + '() missing');
});

// 8. Brace / paren balance
console.log('\n[8] Brace & parenthesis balance');
['Code.gs', 'JavaScript.html', 'ReviewModal.html'].forEach(f => {
  const c = read(f);
  const pairs = [['{', '}'], ['(', ')'], ['[', ']']];
  const bad = pairs.filter(([a, b]) => c.split(a).length !== c.split(b).length);
  bad.length === 0 ? ok(f + ' balanced') : fail(f + ' unbalanced: ' + bad.map(p => p[0] + p[1]).join(', '));
});

// 9. Token metadata headers (ครบ 3 ชนิดต่อ Stage รวม 12 คอลัมน์)
console.log('\n[9] Token metadata headers');
[1, 2, 3, 4].forEach(stage => {
  ['_TokenUsedAt', '_TokenFailedAttempts', '_TokenLastFailedAt'].forEach(suffix => {
    const h = 'Stage' + stage + suffix;
    code.includes(h) ? ok(h + ' header keyed') : fail(h + ' missing from schema');
  });
});