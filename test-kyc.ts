import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

type Json = Record<string, unknown> | null;

const API_ROOT = process.env.API_BASE_URL || 'http://localhost:3000/api/v1';
const ADMIN_AUTH = `${API_ROOT}/admin/auth`;
const ADMIN_KYC = `${API_ROOT}/admin/kyc`;
const ADMIN_USERS = `${API_ROOT}/admin/users`;
const INVESTOR_AUTH = `${API_ROOT}/investor/auth`;
const INVESTOR_KYC = `${API_ROOT}/investor/kyc`;
const ADMIN_SECRET = process.env.ADMIN_REGISTRATION_SECRET || 'fallback-secret-123';
const timestamp = Date.now();

const adminEmail = `kyc_admin_${timestamp}@example.com`;
const adminPassword = 'AdminKyc123!';
const investorEmail = `kyc_investor_${timestamp}@example.com`;
const investorPassword = 'InvestorKyc123!';

const prisma = new PrismaClient();

const state = {
  adminToken: '',
  investorToken: '',
  investorId: 0,
  kycId: 0,
  failures: 0,
  passed: 0,
};

// ─── Helpers ───────────────────────────────────────────

const parseJsonSafe = async (response: Response): Promise<Json> => {
  return response.json().catch(() => null);
};

const runCase = async (
  name: string,
  request: () => Promise<Response>,
  expectedStatus: number,
  validate?: (json: Json) => void,
) => {
  process.stdout.write(`  ${name} ... `);
  try {
    const response = await request();
    const json = await parseJsonSafe(response);

    if (response.status !== expectedStatus) {
      state.failures++;
      console.log(`❌ FAIL (expected ${expectedStatus}, got ${response.status})`);
      if (json) console.log('    Response:', JSON.stringify(json, null, 2).slice(0, 300));
      return;
    }

    if (validate) validate(json);

    state.passed++;
    console.log(`✅ PASS`);
  } catch (error: any) {
    state.failures++;
    console.log(`❌ FAIL (${error.message})`);
  }
};

const postJson = (url: string, body: Record<string, unknown>, token?: string) =>
  fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

const patchJson = (url: string, body: Record<string, unknown>, token?: string) =>
  fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

const getWithToken = (url: string, token?: string) =>
  fetch(url, {
    method: 'GET',
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });

const assertSuccess = (json: Json) => {
  if (!json || json.success !== true) throw new Error(`Expected success=true, got: ${JSON.stringify(json)?.slice(0, 200)}`);
};

const assertError = (json: Json) => {
  if (!json || json.success !== false) throw new Error(`Expected success=false, got: ${JSON.stringify(json)?.slice(0, 200)}`);
};

// Create a tiny 1x1 PNG buffer for test uploads
const createTestPng = (): Buffer => {
  return Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
    'base64',
  );
};

const postMultipart = async (
  url: string,
  fields: Record<string, string>,
  files: { name: string; buffer: Buffer; filename: string }[],
  token?: string,
) => {
  const boundary = `----FormBoundary${Date.now()}`;
  const parts: Buffer[] = [];

  for (const [key, value] of Object.entries(fields)) {
    parts.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`,
      ),
    );
  }

  for (const file of files) {
    parts.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${file.name}"; filename="${file.filename}"\r\nContent-Type: image/png\r\n\r\n`,
      ),
    );
    parts.push(file.buffer);
    parts.push(Buffer.from('\r\n'));
  }

  parts.push(Buffer.from(`--${boundary}--\r\n`));
  const body = Buffer.concat(parts);

  return fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body,
  });
};

// ─── Shared KYC form fields ───────────────────────────

const kycFields = {
  fullLegalName: 'KYC Test Investor',
  dateOfBirth: '15-06-1995',
  nationality: 'Indian',
  countryOfResidence: 'India',
  city: 'Mumbai',
  stateProvince: 'Maharashtra',
  phoneNumber: '+919876543210',
  streetAddress: '123 Test Street, Andheri West',
  aadhaarNumber: '123456789012',
  panNumber: 'ABCDE1234F',
  termsAgreed: 'true',
};

// ─── Test Suites ───────────────────────────────────────

async function setupAccounts() {
  console.log('\n📋 Setting up test accounts...');

  const adminRes = await postJson(`${ADMIN_AUTH}/register`, {
    email: adminEmail,
    fullName: 'KYC Test Admin',
    password: adminPassword,
    adminRegistrationSecret: ADMIN_SECRET,
  });
  const adminJson = (await parseJsonSafe(adminRes)) as any;
  state.adminToken = adminJson?.data?.tokens?.accessToken;
  if (!state.adminToken) throw new Error('Failed to register admin');
  console.log('  ✅ Admin registered');

  const investorRes = await postJson(`${INVESTOR_AUTH}/register`, {
    email: investorEmail,
    fullName: 'KYC Test Investor',
    password: investorPassword,
    confirmPassword: investorPassword,
  });
  const investorJson = (await parseJsonSafe(investorRes)) as any;
  state.investorToken = investorJson?.data?.tokens?.accessToken;
  state.investorId = investorJson?.data?.user?.id;
  if (!state.investorToken) throw new Error('Failed to register investor');
  console.log('  ✅ Investor registered (ID: ' + state.investorId + ')');
}

async function testInvestorKycRoutes() {
  console.log('\n🔐 INVESTOR KYC ROUTES');
  console.log('─'.repeat(50));

  const testPng = createTestPng();

  await runCase(
    'GET /investor/kyc/status → NOT_SUBMITTED',
    () => getWithToken(`${INVESTOR_KYC}/status`, state.investorToken),
    200,
    (json) => {
      assertSuccess(json);
      const status = (json as any)?.data?.status;
      if (status !== 'NOT_SUBMITTED') throw new Error(`Expected NOT_SUBMITTED, got ${status}`);
    },
  );

  await runCase(
    'GET /investor/kyc → 404 when no KYC',
    () => getWithToken(INVESTOR_KYC, state.investorToken),
    404,
    assertError,
  );

  await runCase(
    'POST /investor/kyc → 401 without auth',
    () => postMultipart(INVESTOR_KYC, {}, []),
    401,
    assertError,
  );

  await runCase(
    'POST /investor/kyc → 400 missing fields',
    () => postMultipart(INVESTOR_KYC, { fullLegalName: 'Test' }, [], state.investorToken),
    400,
    assertError,
  );

  // ── Invalid Aadhaar number ──
  await runCase(
    'POST /investor/kyc → 400 invalid aadhaar number',
    () =>
      postMultipart(
        INVESTOR_KYC,
        { ...kycFields, aadhaarNumber: '12345' },
        [
          { name: 'aadhaarFront', buffer: testPng, filename: 'a-front.png' },
          { name: 'aadhaarBack', buffer: testPng, filename: 'a-back.png' },
          { name: 'panFront', buffer: testPng, filename: 'pan.png' },
        ],
        state.investorToken,
      ),
    400,
    assertError,
  );

  // ── Invalid PAN number ──
  await runCase(
    'POST /investor/kyc → 400 invalid PAN number',
    () =>
      postMultipart(
        INVESTOR_KYC,
        { ...kycFields, panNumber: 'invalid' },
        [
          { name: 'aadhaarFront', buffer: testPng, filename: 'a-front.png' },
          { name: 'aadhaarBack', buffer: testPng, filename: 'a-back.png' },
          { name: 'panFront', buffer: testPng, filename: 'pan.png' },
        ],
        state.investorToken,
      ),
    400,
    assertError,
  );

  // ── Success: submit with both Aadhaar + PAN ──
  await runCase(
    'POST /investor/kyc → 201 submit KYC (Aadhaar + PAN)',
    () =>
      postMultipart(
        INVESTOR_KYC,
        { ...kycFields, supportingDocName: 'Utility Bill' },
        [
          { name: 'aadhaarFront', buffer: testPng, filename: 'aadhaar-front.png' },
          { name: 'aadhaarBack', buffer: testPng, filename: 'aadhaar-back.png' },
          { name: 'panFront', buffer: testPng, filename: 'pan-front.png' },
          { name: 'supportingDoc', buffer: testPng, filename: 'utility-bill.png' },
        ],
        state.investorToken,
      ),
    201,
    (json) => {
      assertSuccess(json);
      state.kycId = (json as any)?.data?.id;
      if (!state.kycId) throw new Error('KYC ID missing');
    },
  );

  // ── Duplicate blocked ──
  await runCase(
    'POST /investor/kyc → 400 duplicate submission',
    () =>
      postMultipart(
        INVESTOR_KYC,
        kycFields,
        [
          { name: 'aadhaarFront', buffer: testPng, filename: 'a-front.png' },
          { name: 'aadhaarBack', buffer: testPng, filename: 'a-back.png' },
          { name: 'panFront', buffer: testPng, filename: 'pan.png' },
        ],
        state.investorToken,
      ),
    400,
    assertError,
  );

  await runCase(
    'GET /investor/kyc/status → PENDING after submit',
    () => getWithToken(`${INVESTOR_KYC}/status`, state.investorToken),
    200,
    (json) => {
      assertSuccess(json);
      if ((json as any)?.data?.status !== 'PENDING') throw new Error('Expected PENDING');
    },
  );

  await runCase(
    'GET /investor/kyc → 200 returns full KYC + user data',
    () => getWithToken(INVESTOR_KYC, state.investorToken),
    200,
    (json) => {
      assertSuccess(json);
      const d = (json as any)?.data;
      if (!d?.kyc) throw new Error('Missing kyc');
      if (!d?.user) throw new Error('Missing user');
      if (d.kyc.aadhaarNumber !== '123456789012') throw new Error('Wrong aadhaar number');
      if (d.kyc.panNumber !== 'ABCDE1234F') throw new Error('Wrong PAN number');
      if (!d.kyc.termsAgreedAt) throw new Error('Missing termsAgreedAt');
      if (d.user.email !== investorEmail) throw new Error('Wrong email');
    },
  );
}

async function testAdminKycRoutes() {
  console.log('\n👑 ADMIN KYC ROUTES');
  console.log('─'.repeat(50));

  const testPng = createTestPng();

  await runCase('GET /admin/kyc → 401 no auth', () => getWithToken(ADMIN_KYC), 401, assertError);
  await runCase('GET /admin/kyc → 403 investor token', () => getWithToken(ADMIN_KYC, state.investorToken), 403, assertError);

  await runCase(
    'GET /admin/kyc → 200 list submissions',
    () => getWithToken(ADMIN_KYC, state.adminToken),
    200,
    (json) => {
      assertSuccess(json);
      const s = (json as any)?.data?.submissions;
      if (!Array.isArray(s) || s.length === 0) throw new Error('Expected submissions');
      if (!s[0].aadhaarNumber) throw new Error('Missing aadhaarNumber in list');
      if (!s[0].panNumber) throw new Error('Missing panNumber in list');
    },
  );

  await runCase('GET /admin/kyc?status=PENDING', () => getWithToken(`${ADMIN_KYC}?status=PENDING`, state.adminToken), 200, assertSuccess);
  await runCase('GET /admin/kyc?search=KYC Test', () => getWithToken(`${ADMIN_KYC}?search=KYC+Test`, state.adminToken), 200, assertSuccess);

  await runCase(
    'GET /admin/kyc/:id → 200 detail',
    () => getWithToken(`${ADMIN_KYC}/${state.kycId}`, state.adminToken),
    200,
    (json) => {
      assertSuccess(json);
      const d = (json as any)?.data;
      if (!d?.kyc?.termsAgreedAt) throw new Error('Missing termsAgreedAt');
    },
  );

  await runCase('GET /admin/kyc/abc → 400', () => getWithToken(`${ADMIN_KYC}/abc`, state.adminToken), 400);
  await runCase('GET /admin/kyc/999999 → 404', () => getWithToken(`${ADMIN_KYC}/999999`, state.adminToken), 404, assertError);
  await runCase('PATCH reject → 400 no reason', () => patchJson(`${ADMIN_KYC}/${state.kycId}/reject`, {}, state.adminToken), 400, assertError);

  await runCase(
    'PATCH reject → 200 with reason',
    () => patchJson(`${ADMIN_KYC}/${state.kycId}/reject`, { reason: 'Aadhaar photo is blurry' }, state.adminToken),
    200,
    (json) => {
      assertSuccess(json);
      if ((json as any)?.data?.status !== 'REJECTED') throw new Error('Expected REJECTED');
    },
  );

  await runCase(
    'GET /investor/kyc/status → REJECTED',
    () => getWithToken(`${INVESTOR_KYC}/status`, state.investorToken),
    200,
    (json) => {
      assertSuccess(json);
      if ((json as any)?.data?.status !== 'REJECTED') throw new Error('Expected REJECTED');
    },
  );

  // Resubmit after rejection
  await runCase(
    'POST /investor/kyc → 201 resubmit after rejection',
    () =>
      postMultipart(
        INVESTOR_KYC,
        { ...kycFields, city: 'Delhi', stateProvince: 'Delhi', streetAddress: '456 New Address, CP' },
        [
          { name: 'aadhaarFront', buffer: testPng, filename: 'a-front.png' },
          { name: 'aadhaarBack', buffer: testPng, filename: 'a-back.png' },
          { name: 'panFront', buffer: testPng, filename: 'pan.png' },
        ],
        state.investorToken,
      ),
    201,
    (json) => {
      assertSuccess(json);
      state.kycId = (json as any)?.data?.id;
    },
  );

  await runCase(
    'PATCH approve → 200',
    () => patchJson(`${ADMIN_KYC}/${state.kycId}/approve`, {}, state.adminToken),
    200,
    (json) => {
      assertSuccess(json);
      if ((json as any)?.data?.status !== 'APPROVED') throw new Error('Expected APPROVED');
    },
  );

  await runCase(
    'GET /investor/kyc/status → APPROVED',
    () => getWithToken(`${INVESTOR_KYC}/status`, state.investorToken),
    200,
    (json) => {
      assertSuccess(json);
      if ((json as any)?.data?.status !== 'APPROVED') throw new Error('Expected APPROVED');
    },
  );

  await runCase('PATCH approve again → 400', () => patchJson(`${ADMIN_KYC}/${state.kycId}/approve`, {}, state.adminToken), 400, assertError);
  await runCase('PATCH reject approved → 400', () => patchJson(`${ADMIN_KYC}/${state.kycId}/reject`, { reason: 'test' }, state.adminToken), 400, assertError);

  await runCase(
    'POST /investor/kyc → 400 cannot resubmit approved',
    () =>
      postMultipart(
        INVESTOR_KYC,
        kycFields,
        [
          { name: 'aadhaarFront', buffer: testPng, filename: 'a.png' },
          { name: 'aadhaarBack', buffer: testPng, filename: 'b.png' },
          { name: 'panFront', buffer: testPng, filename: 'c.png' },
        ],
        state.investorToken,
      ),
    400,
    assertError,
  );
}

async function testAdminUserRoutes() {
  console.log('\n👤 ADMIN USER ROUTES');
  console.log('─'.repeat(50));

  const managedEmail = `managed_${timestamp}@example.com`;
  let managedId = 0;

  await runCase(
    'POST /admin/users → 201',
    () => postJson(ADMIN_USERS, { email: managedEmail, fullName: 'Managed User', password: 'ManagedPass123!' }, state.adminToken),
    201,
    (json) => {
      assertSuccess(json);
      managedId = (json as any)?.data?.user?.id;
      if (!managedId) throw new Error('Missing ID');
    },
  );

  await runCase('GET /admin/users/:id → 200', () => getWithToken(`${ADMIN_USERS}/${managedId}`, state.adminToken), 200, assertSuccess);
  await runCase('PATCH /admin/users/:id → 200', () => patchJson(`${ADMIN_USERS}/${managedId}`, { fullName: 'Updated' }, state.adminToken), 200, assertSuccess);
  await runCase('GET /admin/users → 200', () => getWithToken(ADMIN_USERS, state.adminToken), 200, assertSuccess);
  await runCase(
    'DELETE /admin/users/:id → 200',
    () => fetch(`${ADMIN_USERS}/${managedId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${state.adminToken}` } }),
    200,
    assertSuccess,
  );

  await prisma.investorAuthUser.deleteMany({ where: { email: managedEmail } }).catch(() => {});
}

// ─── Main ──────────────────────────────────────────────

async function run() {
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║        KYC & ADMIN ROUTE TEST SUITE             ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log(`API Root: ${API_ROOT}`);

  try {
    await prisma.investorKyc.deleteMany({ where: { user: { email: investorEmail } } }).catch(() => {});
    await prisma.investorAuthUser.deleteMany({ where: { email: { in: [investorEmail, `managed_${timestamp}@example.com`] } } }).catch(() => {});
    await prisma.adminUser.deleteMany({ where: { email: adminEmail } }).catch(() => {});

    await setupAccounts();
    await testInvestorKycRoutes();
    await testAdminKycRoutes();
    await testAdminUserRoutes();
  } finally {
    console.log('\n🧹 Cleaning up...');
    await prisma.investorKyc.deleteMany({ where: { user: { email: investorEmail } } }).catch(() => {});
    await prisma.investorAuthUser.deleteMany({ where: { email: { in: [investorEmail, `managed_${timestamp}@example.com`] } } }).catch(() => {});
    await prisma.adminUser.deleteMany({ where: { email: adminEmail } }).catch(() => {});
    await prisma.$disconnect();
  }

  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log(`║  Results: ${state.passed} passed, ${state.failures} failed`);
  console.log('╚══════════════════════════════════════════════════╝');

  if (state.failures > 0) process.exitCode = 1;
}

run().catch((e) => {
  console.error('\n💥 Fatal:', e);
  process.exit(1);
});
