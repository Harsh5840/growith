import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

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
  // Minimal valid PNG: 1x1 pixel, red
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

  // Add text fields
  for (const [key, value] of Object.entries(fields)) {
    parts.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`,
      ),
    );
  }

  // Add file fields
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

// ─── Test Suites ───────────────────────────────────────

async function setupAccounts() {
  console.log('\n📋 Setting up test accounts...');

  // Register admin
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

  // Register investor
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

  // ── GET /investor/kyc/status (before submission) ──
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

  // ── GET /investor/kyc (before submission) ──
  await runCase(
    'GET /investor/kyc → 404 when no KYC',
    () => getWithToken(INVESTOR_KYC, state.investorToken),
    404,
    assertError,
  );

  // ── POST /investor/kyc without auth → 401 ──
  await runCase(
    'POST /investor/kyc → 401 without auth',
    () => postMultipart(INVESTOR_KYC, {}, []),
    401,
    assertError,
  );

  // ── POST /investor/kyc with missing fields → 400 ──
  await runCase(
    'POST /investor/kyc → 400 missing fields',
    () =>
      postMultipart(
        INVESTOR_KYC,
        { fullLegalName: 'Test' },
        [],
        state.investorToken,
      ),
    400,
    assertError,
  );

  // ── POST /investor/kyc success (AADHAAR) ──
  const testPng = createTestPng();
  await runCase(
    'POST /investor/kyc → 201 submit AADHAAR KYC',
    () =>
      postMultipart(
        INVESTOR_KYC,
        {
          fullLegalName: 'KYC Test Investor',
          dateOfBirth: '15-06-1995',
          nationality: 'Indian',
          countryOfResidence: 'India',
          city: 'Mumbai',
          stateProvince: 'Maharashtra',
          phoneNumber: '+919876543210',
          streetAddress: '123 Test Street, Andheri West',
          primaryDocumentType: 'AADHAAR',
          supportingDocName: 'Utility Bill',
        },
        [
          { name: 'primaryDocFront', buffer: testPng, filename: 'aadhaar-front.png' },
          { name: 'primaryDocBack', buffer: testPng, filename: 'aadhaar-back.png' },
          { name: 'supportingDoc', buffer: testPng, filename: 'utility-bill.png' },
        ],
        state.investorToken,
      ),
    201,
    (json) => {
      assertSuccess(json);
      state.kycId = (json as any)?.data?.id;
      if (!state.kycId) throw new Error('KYC ID missing from submit response');
    },
  );

  // ── POST /investor/kyc duplicate → 400 ──
  await runCase(
    'POST /investor/kyc → 400 duplicate submission',
    () =>
      postMultipart(
        INVESTOR_KYC,
        {
          fullLegalName: 'KYC Test Investor',
          dateOfBirth: '15-06-1995',
          nationality: 'Indian',
          countryOfResidence: 'India',
          city: 'Mumbai',
          stateProvince: 'Maharashtra',
          phoneNumber: '+919876543210',
          streetAddress: '123 Test Street, Andheri West',
          primaryDocumentType: 'AADHAAR',
        },
        [
          { name: 'primaryDocFront', buffer: testPng, filename: 'aadhaar-front.png' },
          { name: 'primaryDocBack', buffer: testPng, filename: 'aadhaar-back.png' },
        ],
        state.investorToken,
      ),
    400,
    assertError,
  );

  // ── GET /investor/kyc/status → PENDING ──
  await runCase(
    'GET /investor/kyc/status → PENDING after submit',
    () => getWithToken(`${INVESTOR_KYC}/status`, state.investorToken),
    200,
    (json) => {
      assertSuccess(json);
      const status = (json as any)?.data?.status;
      if (status !== 'PENDING') throw new Error(`Expected PENDING, got ${status}`);
    },
  );

  // ── GET /investor/kyc → full data ──
  await runCase(
    'GET /investor/kyc → 200 returns KYC + user data',
    () => getWithToken(INVESTOR_KYC, state.investorToken),
    200,
    (json) => {
      assertSuccess(json);
      const data = (json as any)?.data;
      if (!data?.kyc) throw new Error('Missing kyc object');
      if (!data?.user) throw new Error('Missing user object');
      if (data.kyc.fullLegalName !== 'KYC Test Investor') throw new Error('Wrong fullLegalName');
      if (data.kyc.primaryDocumentType !== 'AADHAAR') throw new Error('Wrong document type');
      if (data.user.email !== investorEmail) throw new Error('Wrong user email');
    },
  );
}

async function testAdminKycRoutes() {
  console.log('\n👑 ADMIN KYC ROUTES');
  console.log('─'.repeat(50));

  // ── GET /admin/kyc without auth → 401 ──
  await runCase(
    'GET /admin/kyc → 401 without auth',
    () => getWithToken(ADMIN_KYC),
    401,
    assertError,
  );

  // ── GET /admin/kyc with investor token → 403 ──
  await runCase(
    'GET /admin/kyc → 403 with investor token',
    () => getWithToken(ADMIN_KYC, state.investorToken),
    403,
    assertError,
  );

  // ── GET /admin/kyc → list all submissions ──
  await runCase(
    'GET /admin/kyc → 200 list submissions',
    () => getWithToken(ADMIN_KYC, state.adminToken),
    200,
    (json) => {
      assertSuccess(json);
      const submissions = (json as any)?.data?.submissions;
      if (!Array.isArray(submissions)) throw new Error('Expected submissions array');
      if (submissions.length === 0) throw new Error('Expected at least 1 submission');
    },
  );

  // ── GET /admin/kyc?status=PENDING ──
  await runCase(
    'GET /admin/kyc?status=PENDING → filtered list',
    () => getWithToken(`${ADMIN_KYC}?status=PENDING`, state.adminToken),
    200,
    (json) => {
      assertSuccess(json);
      const submissions = (json as any)?.data?.submissions;
      if (!Array.isArray(submissions)) throw new Error('Expected submissions array');
      for (const s of submissions) {
        if (s.status !== 'PENDING') throw new Error(`Expected PENDING, got ${s.status}`);
      }
    },
  );

  // ── GET /admin/kyc?search=KYC Test ──
  await runCase(
    'GET /admin/kyc?search=KYC Test → search results',
    () => getWithToken(`${ADMIN_KYC}?search=KYC+Test`, state.adminToken),
    200,
    assertSuccess,
  );

  // ── GET /admin/kyc/:id ──
  await runCase(
    'GET /admin/kyc/:id → 200 KYC detail',
    () => getWithToken(`${ADMIN_KYC}/${state.kycId}`, state.adminToken),
    200,
    (json) => {
      assertSuccess(json);
      const data = (json as any)?.data;
      if (!data?.kyc) throw new Error('Missing kyc object');
      if (!data?.user) throw new Error('Missing user object');
      if (data.kyc.id !== state.kycId) throw new Error('Wrong KYC ID');
    },
  );

  // ── GET /admin/kyc/:id with invalid ID ──
  await runCase(
    'GET /admin/kyc/abc → 400 invalid ID',
    () => getWithToken(`${ADMIN_KYC}/abc`, state.adminToken),
    400,
  );

  // ── GET /admin/kyc/:id not found ──
  await runCase(
    'GET /admin/kyc/999999 → 404 not found',
    () => getWithToken(`${ADMIN_KYC}/999999`, state.adminToken),
    404,
    assertError,
  );

  // ── PATCH /admin/kyc/:id/reject without reason → 400 ──
  await runCase(
    'PATCH /admin/kyc/:id/reject → 400 missing reason',
    () => patchJson(`${ADMIN_KYC}/${state.kycId}/reject`, {}, state.adminToken),
    400,
    assertError,
  );

  // ── PATCH /admin/kyc/:id/reject → success ──
  await runCase(
    'PATCH /admin/kyc/:id/reject → 200 reject with reason',
    () =>
      patchJson(
        `${ADMIN_KYC}/${state.kycId}/reject`,
        { reason: 'Aadhaar card photo is blurry, please resubmit with a clear image.' },
        state.adminToken,
      ),
    200,
    (json) => {
      assertSuccess(json);
      const data = (json as any)?.data;
      if (data.status !== 'REJECTED') throw new Error(`Expected REJECTED, got ${data.status}`);
      if (!data.rejectionReason) throw new Error('Missing rejectionReason');
    },
  );

  // ── Verify investor sees REJECTED status ──
  await runCase(
    'GET /investor/kyc/status → REJECTED after admin reject',
    () => getWithToken(`${INVESTOR_KYC}/status`, state.investorToken),
    200,
    (json) => {
      assertSuccess(json);
      const status = (json as any)?.data?.status;
      if (status !== 'REJECTED') throw new Error(`Expected REJECTED, got ${status}`);
    },
  );

  // ── Resubmit after rejection ──
  const testPng = createTestPng();
  await runCase(
    'POST /investor/kyc → 201 resubmit after rejection',
    () =>
      postMultipart(
        INVESTOR_KYC,
        {
          fullLegalName: 'KYC Test Investor Updated',
          dateOfBirth: '15-06-1995',
          nationality: 'Indian',
          countryOfResidence: 'India',
          city: 'Delhi',
          stateProvince: 'Delhi',
          phoneNumber: '+919876543210',
          streetAddress: '456 New Address, Connaught Place',
          primaryDocumentType: 'PAN',
        },
        [{ name: 'primaryDocFront', buffer: testPng, filename: 'pan-front.png' }],
        state.investorToken,
      ),
    201,
    (json) => {
      assertSuccess(json);
      state.kycId = (json as any)?.data?.id;
    },
  );

  // ── PATCH /admin/kyc/:id/approve → success ──
  await runCase(
    'PATCH /admin/kyc/:id/approve → 200 approve KYC',
    () => patchJson(`${ADMIN_KYC}/${state.kycId}/approve`, {}, state.adminToken),
    200,
    (json) => {
      assertSuccess(json);
      const data = (json as any)?.data;
      if (data.status !== 'APPROVED') throw new Error(`Expected APPROVED, got ${data.status}`);
    },
  );

  // ── Verify investor sees APPROVED status ──
  await runCase(
    'GET /investor/kyc/status → APPROVED after admin approve',
    () => getWithToken(`${INVESTOR_KYC}/status`, state.investorToken),
    200,
    (json) => {
      assertSuccess(json);
      const status = (json as any)?.data?.status;
      if (status !== 'APPROVED') throw new Error(`Expected APPROVED, got ${status}`);
    },
  );

  // ── Cannot approve already approved ──
  await runCase(
    'PATCH /admin/kyc/:id/approve → 400 already approved',
    () => patchJson(`${ADMIN_KYC}/${state.kycId}/approve`, {}, state.adminToken),
    400,
    assertError,
  );

  // ── Cannot reject already approved ──
  await runCase(
    'PATCH /admin/kyc/:id/reject → 400 cannot reject approved',
    () =>
      patchJson(
        `${ADMIN_KYC}/${state.kycId}/reject`,
        { reason: 'Trying to reject after approval' },
        state.adminToken,
      ),
    400,
    assertError,
  );

  // ── Cannot resubmit when approved ──
  await runCase(
    'POST /investor/kyc → 400 cannot resubmit when approved',
    () =>
      postMultipart(
        INVESTOR_KYC,
        {
          fullLegalName: 'KYC Test Investor',
          dateOfBirth: '15-06-1995',
          nationality: 'Indian',
          countryOfResidence: 'India',
          city: 'Mumbai',
          stateProvince: 'Maharashtra',
          phoneNumber: '+919876543210',
          streetAddress: '123 Test Street',
          primaryDocumentType: 'AADHAAR',
        },
        [
          { name: 'primaryDocFront', buffer: testPng, filename: 'aadhaar-front.png' },
          { name: 'primaryDocBack', buffer: testPng, filename: 'aadhaar-back.png' },
        ],
        state.investorToken,
      ),
    400,
    assertError,
  );
}

async function testAdminUserRoutes() {
  console.log('\n👤 ADMIN USER ROUTES (updated naming)');
  console.log('─'.repeat(50));

  const managedEmail = `managed_${timestamp}@example.com`;

  // ── POST /admin/users (RESTful create) ──
  let managedId = 0;
  await runCase(
    'POST /admin/users → 201 create investor',
    () =>
      postJson(
        `${ADMIN_USERS}`,
        { email: managedEmail, fullName: 'Managed User', password: 'ManagedPass123!' },
        state.adminToken,
      ),
    201,
    (json) => {
      assertSuccess(json);
      managedId = (json as any)?.data?.user?.id;
      if (!managedId) throw new Error('Managed user ID missing');
    },
  );

  // ── GET /admin/users/:id ──
  await runCase(
    'GET /admin/users/:id → 200 get user',
    () => getWithToken(`${ADMIN_USERS}/${managedId}`, state.adminToken),
    200,
    assertSuccess,
  );

  // ── PATCH /admin/users/:id (RESTful edit) ──
  await runCase(
    'PATCH /admin/users/:id → 200 edit user',
    () => patchJson(`${ADMIN_USERS}/${managedId}`, { fullName: 'Updated Name' }, state.adminToken),
    200,
    assertSuccess,
  );

  // ── GET /admin/users (list) ──
  await runCase(
    'GET /admin/users → 200 list users',
    () => getWithToken(ADMIN_USERS, state.adminToken),
    200,
    assertSuccess,
  );

  // ── DELETE /admin/users/:id ──
  await runCase(
    'DELETE /admin/users/:id → 200 delete user',
    () => fetch(`${ADMIN_USERS}/${managedId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${state.adminToken}` },
    }),
    200,
    assertSuccess,
  );

  // Clean up
  await prisma.investorAuthUser.deleteMany({ where: { email: managedEmail } }).catch(() => {});
}

// ─── Main ──────────────────────────────────────────────

async function run() {
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║        KYC & ADMIN ROUTE TEST SUITE             ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log(`API Root: ${API_ROOT}`);
  console.log(`Timestamp: ${timestamp}\n`);

  try {
    // Clean up any previous test data
    await prisma.investorKyc.deleteMany({
      where: { user: { email: investorEmail } },
    }).catch(() => {});
    await prisma.investorAuthUser.deleteMany({
      where: { email: { in: [investorEmail, `managed_${timestamp}@example.com`] } },
    }).catch(() => {});
    await prisma.adminUser.deleteMany({ where: { email: adminEmail } }).catch(() => {});

    await setupAccounts();
    await testInvestorKycRoutes();
    await testAdminKycRoutes();
    await testAdminUserRoutes();
  } finally {
    // Clean up test data
    console.log('\n🧹 Cleaning up test data...');
    await prisma.investorKyc.deleteMany({
      where: { user: { email: investorEmail } },
    }).catch(() => {});
    await prisma.investorAuthUser.deleteMany({
      where: { email: { in: [investorEmail, `managed_${timestamp}@example.com`] } },
    }).catch(() => {});
    await prisma.adminUser.deleteMany({ where: { email: adminEmail } }).catch(() => {});
    await prisma.$disconnect();
  }

  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log(`║  Results: ${state.passed} passed, ${state.failures} failed`);
  console.log('╚══════════════════════════════════════════════════╝');

  if (state.failures > 0) {
    process.exitCode = 1;
  }
}

run().catch((error) => {
  console.error('\n💥 Fatal test script error:', error);
  process.exit(1);
});
