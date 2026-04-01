import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

type Json = Record<string, unknown> | null;

const API_ROOT = process.env.API_BASE_URL || 'http://localhost:3000/api/v1';
const ADMIN_AUTH_API_BASE = `${API_ROOT}/admin/auth`;
const ADMIN_API_BASE = `${API_ROOT}/admin`;
const INVESTOR_API_BASE = `${API_ROOT}/investor/auth`;
const ADMIN_SECRET = process.env.ADMIN_REGISTRATION_SECRET || 'fallback-secret-123';
const timestamp = Date.now();

const adminEmail = `admin_e2e_${timestamp}@example.com`;
const adminPassword = 'AdminPassword123!';
const adminNewPassword = 'AdminPassword456!';

const investorEmail = `investor_e2e_${timestamp}@example.com`;
const investorPassword = 'InvestorPass123!';

const managedInvestorEmail = `managed_user_${timestamp}@example.com`;
const managedInvestorPassword = 'ManagedPass123!';

const prisma = new PrismaClient();

const state = {
  adminToken: '',
  adminRefreshToken: '',
  investorToken: '',
  managedInvestorId: '',
  failures: 0,
};

const parseJsonSafe = async (response: Response): Promise<Json> => {
  return response.json().catch(() => null);
};

const runCase = async (
  name: string,
  request: () => Promise<Response>,
  expectedStatus: number,
  validate?: (json: Json) => void,
) => {
  process.stdout.write(`\n- ${name} ... `);
  try {
    const response = await request();
    const json = await parseJsonSafe(response);

    if (response.status !== expectedStatus) {
      state.failures += 1;
      console.log(`FAIL (expected ${expectedStatus}, got ${response.status})`);
      if (json) {
        console.log('  Response:', json);
      }
      return;
    }

    if (validate) {
      validate(json);
    }

    console.log(`PASS (${response.status})`);
  } catch (error) {
    state.failures += 1;
    console.log('FAIL (request error)');
    console.error(error);
  }
};

const postJson = (url: string, body: Record<string, unknown>, token?: string) => {
  return fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
};

const patchJson = (url: string, body: Record<string, unknown>, token?: string) => {
  return fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
};

const getWithToken = (url: string, token?: string) => {
  return fetch(url, {
    method: 'GET',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
};

const deleteWithToken = (url: string, token?: string) => {
  return fetch(url, {
    method: 'DELETE',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
};

const assertSuccessEnvelope = (json: Json) => {
  if (!json || json.success !== true) {
    throw new Error(`Expected success envelope, got: ${JSON.stringify(json)}`);
  }
};

const assertErrorEnvelope = (json: Json) => {
  if (!json || json.success !== false) {
    throw new Error(`Expected error envelope, got: ${JSON.stringify(json)}`);
  }
};

async function seedInvestorToken() {
  await postJson(`${INVESTOR_API_BASE}/register`, {
    email: investorEmail,
    fullName: 'Investor Role Probe',
    password: investorPassword,
    confirmPassword: investorPassword,
  });

  const loginResponse = await postJson(`${INVESTOR_API_BASE}/login`, {
    email: investorEmail,
    password: investorPassword,
  });

  if (loginResponse.status !== 200) {
    const json = await parseJsonSafe(loginResponse);
    throw new Error(`Could not get investor token: ${JSON.stringify(json)}`);
  }

  const loginJson = await parseJsonSafe(loginResponse);
  state.investorToken = String((loginJson as any)?.data?.tokens?.accessToken || '');
  if (!state.investorToken) {
    throw new Error('Investor token missing in login response');
  }
}

async function run() {
  console.log('=== ADMIN ROUTE FULL CASE TEST (LIVE SERVER) ===');
  console.log(`Auth Base URL: ${ADMIN_AUTH_API_BASE}`);
  console.log(`Admin Base URL: ${ADMIN_API_BASE}`);

  try {
    await prisma.adminUser.deleteMany({ where: { email: adminEmail } });
    await prisma.investorAuthUser.deleteMany({
      where: {
        email: {
          in: [investorEmail, managedInvestorEmail],
        },
      },
    });

    await seedInvestorToken();

    await runCase(
      'Register admin with wrong secret',
      () =>
        postJson(`${ADMIN_AUTH_API_BASE}/register`, {
          email: `wrong_${adminEmail}`,
          fullName: 'Wrong Secret Admin',
          password: adminPassword,
          adminRegistrationSecret: 'wrong-secret',
        }),
      403,
      assertErrorEnvelope,
    );

    await runCase(
      'Register admin with invalid payload',
      () => postJson(`${ADMIN_AUTH_API_BASE}/register`, { email: 'bad-email' }),
      400,
      assertErrorEnvelope,
    );

    await runCase(
      'Register admin success',
      () =>
        postJson(`${ADMIN_AUTH_API_BASE}/register`, {
          email: adminEmail,
          fullName: 'Admin Route Tester',
          password: adminPassword,
          adminRegistrationSecret: ADMIN_SECRET,
        }),
      201,
      (json) => {
        assertSuccessEnvelope(json);
        state.adminToken = String((json as any)?.data?.tokens?.accessToken || '');
        state.adminRefreshToken = String((json as any)?.data?.tokens?.refreshToken || '');
        if (!state.adminToken || !state.adminRefreshToken) {
          throw new Error('Missing admin tokens in register response');
        }
      },
    );

    await runCase(
      'Register duplicate admin',
      () =>
        postJson(`${ADMIN_AUTH_API_BASE}/register`, {
          email: adminEmail,
          fullName: 'Admin Route Tester',
          password: adminPassword,
          adminRegistrationSecret: ADMIN_SECRET,
        }),
      409,
      assertErrorEnvelope,
    );

    await runCase(
      'Login with wrong password',
      () =>
        postJson(`${ADMIN_AUTH_API_BASE}/login`, {
          email: adminEmail,
          password: 'WrongPassword123!',
        }),
      401,
      assertErrorEnvelope,
    );

    await runCase(
      'Login success',
      () =>
        postJson(`${ADMIN_AUTH_API_BASE}/login`, {
          email: adminEmail,
          password: adminPassword,
        }),
      200,
      (json) => {
        assertSuccessEnvelope(json);
        state.adminToken = String((json as any)?.data?.tokens?.accessToken || '');
        if (!state.adminToken) {
          throw new Error('Missing admin access token on login response');
        }
      },
    );

    await runCase('GET /auth/me without token', () => getWithToken(`${ADMIN_AUTH_API_BASE}/me`), 401, assertErrorEnvelope);

    await runCase(
      'GET /auth/me with non-admin token',
      () => getWithToken(`${ADMIN_AUTH_API_BASE}/me`, state.investorToken),
      403,
      assertErrorEnvelope,
    );

    await runCase(
      'GET /auth/me with admin token',
      () => getWithToken(`${ADMIN_AUTH_API_BASE}/me`, state.adminToken),
      200,
      assertSuccessEnvelope,
    );

    await runCase('GET /users without token', () => getWithToken(`${ADMIN_API_BASE}/users`), 401, assertErrorEnvelope);

    await runCase(
      'GET /users with non-admin token',
      () => getWithToken(`${ADMIN_API_BASE}/users`, state.investorToken),
      403,
      assertErrorEnvelope,
    );

    await runCase(
      'GET /users with admin token',
      () => getWithToken(`${ADMIN_API_BASE}/users?search=route&kycStatus=PENDING`, state.adminToken),
      200,
      assertSuccessEnvelope,
    );

    await runCase(
      'GET /users/:id with unknown id',
      () => getWithToken(`${ADMIN_API_BASE}/users/00000000-0000-0000-0000-000000000000`, state.adminToken),
      404,
      assertErrorEnvelope,
    );

    await runCase(
      'POST /users/create invalid payload',
      () => postJson(`${ADMIN_API_BASE}/users/create`, { email: 'bad-email' }, state.adminToken),
      400,
      assertErrorEnvelope,
    );

    await runCase(
      'POST /users/create success',
      () =>
        postJson(
          `${ADMIN_API_BASE}/users/create`,
          {
            email: managedInvestorEmail,
            fullName: 'Managed Investor',
            password: managedInvestorPassword,
          },
          state.adminToken,
        ),
      201,
      (json) => {
        assertSuccessEnvelope(json);
        state.managedInvestorId = String((json as any)?.data?.user?.id || '');
        if (!state.managedInvestorId) {
          throw new Error('Managed investor id missing from create response');
        }
      },
    );

    await runCase(
      'POST /users/create duplicate investor',
      () =>
        postJson(
          `${ADMIN_API_BASE}/users/create`,
          {
            email: managedInvestorEmail,
            fullName: 'Managed Investor',
            password: managedInvestorPassword,
          },
          state.adminToken,
        ),
      409,
      assertErrorEnvelope,
    );

    await runCase(
      'GET /users/:id success',
      () => getWithToken(`${ADMIN_API_BASE}/users/${state.managedInvestorId}`, state.adminToken),
      200,
      assertSuccessEnvelope,
    );

    await runCase(
      'PATCH /users/:id/edit invalid payload',
      () => patchJson(`${ADMIN_API_BASE}/users/${state.managedInvestorId}/edit`, {} as any, state.adminToken),
      400,
      assertErrorEnvelope,
    );

    await runCase(
      'PATCH /users/:id/edit deactivate user',
      () => patchJson(`${ADMIN_API_BASE}/users/${state.managedInvestorId}/edit`, { isActive: false }, state.adminToken),
      200,
      assertSuccessEnvelope,
    );

    await runCase(
      'PATCH /users/:id/edit activate user',
      () => patchJson(`${ADMIN_API_BASE}/users/${state.managedInvestorId}/edit`, { isActive: true }, state.adminToken),
      200,
      assertSuccessEnvelope,
    );

    await runCase(
      'POST /forgot-password invalid payload',
      () => postJson(`${ADMIN_AUTH_API_BASE}/forgot-password`, { email: 'invalid' }),
      400,
      assertErrorEnvelope,
    );

    await runCase(
      'POST /forgot-password unknown admin',
      () => postJson(`${ADMIN_AUTH_API_BASE}/forgot-password`, { email: `unknown_${timestamp}@example.com` }),
      404,
      assertErrorEnvelope,
    );

    await runCase(
      'POST /forgot-password existing admin',
      () => postJson(`${ADMIN_AUTH_API_BASE}/forgot-password`, { email: adminEmail }),
      200,
      assertSuccessEnvelope,
    );

    const adminDb = await prisma.adminUser.findUnique({ where: { email: adminEmail } });
    const resetCode = adminDb?.forgotPasswordCode;
    if (!resetCode) {
      throw new Error('Could not read forgotPasswordCode for admin from database');
    }

    await runCase(
      'POST /reset-password invalid payload',
      () =>
        postJson(`${ADMIN_AUTH_API_BASE}/reset-password`, {
          email: adminEmail,
          code: '123456',
          newPassword: adminNewPassword,
          confirmPassword: 'Mismatch123!',
        }),
      400,
      assertErrorEnvelope,
    );

    await runCase(
      'POST /reset-password wrong code',
      () =>
        postJson(`${ADMIN_AUTH_API_BASE}/reset-password`, {
          email: adminEmail,
          code: '111111',
          newPassword: adminNewPassword,
          confirmPassword: adminNewPassword,
        }),
      400,
      assertErrorEnvelope,
    );

    await runCase(
      'POST /reset-password success',
      () =>
        postJson(`${ADMIN_AUTH_API_BASE}/reset-password`, {
          email: adminEmail,
          code: resetCode,
          newPassword: adminNewPassword,
          confirmPassword: adminNewPassword,
        }),
      200,
      assertSuccessEnvelope,
    );

    await runCase(
      'Login with old password after reset',
      () =>
        postJson(`${ADMIN_AUTH_API_BASE}/login`, {
          email: adminEmail,
          password: adminPassword,
        }),
      401,
      assertErrorEnvelope,
    );

    await runCase(
      'Login with new password after reset',
      () =>
        postJson(`${ADMIN_AUTH_API_BASE}/login`, {
          email: adminEmail,
          password: adminNewPassword,
        }),
      200,
      assertSuccessEnvelope,
    );

    await runCase(
      'DELETE /users/:id success',
      () => deleteWithToken(`${ADMIN_API_BASE}/users/${state.managedInvestorId}`, state.adminToken),
      200,
      assertSuccessEnvelope,
    );

    await runCase(
      'GET /users/:id after delete',
      () => getWithToken(`${ADMIN_API_BASE}/users/${state.managedInvestorId}`, state.adminToken),
      404,
      assertErrorEnvelope,
    );

    await runCase(
      'DELETE /users/:id missing user',
      () => deleteWithToken(`${ADMIN_API_BASE}/users/${state.managedInvestorId}`, state.adminToken),
      404,
      assertErrorEnvelope,
    );
  } finally {
    await prisma.adminUser.deleteMany({ where: { email: adminEmail } });
    await prisma.investorAuthUser.deleteMany({
      where: {
        email: {
          in: [investorEmail, managedInvestorEmail],
        },
      },
    });
    await prisma.$disconnect();
  }

  console.log('\n=== ADMIN ROUTE TEST SUMMARY ===');
  if (state.failures > 0) {
    console.log(`Result: ${state.failures} case(s) failed.`);
    process.exitCode = 1;
  } else {
    console.log('Result: All admin route cases passed.');
  }
}

run().catch((error) => {
  console.error('\nFatal test script error:', error);
  process.exit(1);
});
