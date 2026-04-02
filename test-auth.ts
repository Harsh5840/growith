import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const API_BASE = process.env.TEST_API_BASE || 'http://localhost:3000/api/v1/investor/auth';
const TEST_EMAIL = 'gautamharsh584@gmail.com';
const INITIAL_PASSWORD = 'Password123!';
const NEW_PASSWORD = 'NewPassword123!';

async function parseJson(res: Response): Promise<any> {
  try {
    return await res.json();
  } catch {
    return { raw: await res.text() };
  }
}

async function expectStatus(step: string, res: Response, expected: number): Promise<any> {
  const body = await parseJson(res);
  if (res.status !== expected) {
    throw new Error(`${step} expected ${expected}, got ${res.status}: ${JSON.stringify(body)}`);
  }
  return body;
}

async function getUser() {
  return prisma.investorAuthUser.findUnique({ where: { email: TEST_EMAIL } });
}

async function expireEmailVerificationCode() {
  await prisma.investorAuthUser.update({
    where: { email: TEST_EMAIL },
    data: { emailVerificationExpires: new Date(Date.now() - 60_000) },
  });
}

async function expireForgotPasswordCode() {
  await prisma.investorAuthUser.update({
    where: { email: TEST_EMAIL },
    data: { forgotPasswordExpires: new Date(Date.now() - 60_000) },
  });
}

async function testAuthProcess() {
  console.log('--- STARTING END-TO-END AUTH TEST ---');
  let accessToken = '';

  try {
    // 0. Clean up existing test user
    console.log('\n[0] Cleaning up database...');
    await prisma.investorAuthUser.deleteMany({
      where: { email: TEST_EMAIL },
    });
    console.log('    ✓ Database ready');

    // 1. Register
    console.log('\n[1] Testing Registration...');
    const registerRes = await fetch(`${API_BASE}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: TEST_EMAIL,
        fullName: 'Test Investor',
        password: INITIAL_PASSWORD,
        confirmPassword: INITIAL_PASSWORD,
      }),
    });
    const registerData = await expectStatus('register', registerRes, 201);
    console.log('    ✓ Registration successful');
    accessToken = registerData.data.tokens.accessToken;

    // 2. Login
    console.log('\n[2] Testing Login...');
    const loginRes = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: TEST_EMAIL,
        password: INITIAL_PASSWORD,
      }),
    });
    await expectStatus('login initial', loginRes, 200);
    console.log('    ✓ Login successful');

    // 3. Send Email Verification and assert duplicate requests do not issue new code
    console.log('\n[3] Testing Send Email Verification + duplicate guard...');
    const sendVerifyRes = await fetch(`${API_BASE}/send-email-verification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: TEST_EMAIL }),
    });
    await expectStatus('send email verification #1', sendVerifyRes, 200);
    const userAfterFirstSend = await getUser();
    const firstEmailCode = userAfterFirstSend?.emailVerificationCode;
    if (!firstEmailCode) throw new Error('Expected emailVerificationCode after first send-email-verification');

    const sendVerifyRes2 = await fetch(`${API_BASE}/send-email-verification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: TEST_EMAIL }),
    });
    await expectStatus('send email verification #2', sendVerifyRes2, 200);
    const userAfterSecondSend = await getUser();
    const secondEmailCode = userAfterSecondSend?.emailVerificationCode;
    if (secondEmailCode !== firstEmailCode) {
      throw new Error(`Expected duplicate email verification request to keep same code. First=${firstEmailCode} Second=${secondEmailCode}`);
    }
    console.log('    ✓ Email verification duplicate guard works');

    console.log('    ↳ Validating concurrent duplicate send-email-verification requests...');
    await Promise.all([
      fetch(`${API_BASE}/send-email-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: TEST_EMAIL }),
      }),
      fetch(`${API_BASE}/send-email-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: TEST_EMAIL }),
      }),
    ]);
    const userAfterConcurrentVerify = await getUser();
    if (userAfterConcurrentVerify?.emailVerificationCode !== firstEmailCode) {
      throw new Error('Concurrent send-email-verification requests rotated code unexpectedly');
    }
    console.log('    ✓ Concurrent verification requests collapsed correctly');

    // 4. Verify Email - invalid code
    console.log('\n[4] Testing Verify Email with INVALID code...');
    const verifyEmailInvalidRes = await fetch(`${API_BASE}/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: TEST_EMAIL, code: '000000' }),
    });
    await expectStatus('verify email invalid code', verifyEmailInvalidRes, 400);
    console.log('    ✓ Invalid email verification code rejected');

    // 5. Verify Email - expired code
    console.log('\n[5] Testing Verify Email with EXPIRED code...');
    await expireEmailVerificationCode();
    const verifyEmailExpiredRes = await fetch(`${API_BASE}/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: TEST_EMAIL, code: firstEmailCode }),
    });
    await expectStatus('verify email expired code', verifyEmailExpiredRes, 400);
    console.log('    ✓ Expired email verification code rejected');

    // 6. Re-send after expiry should issue a new code, then verify successfully
    console.log('\n[6] Testing Verify Email with VALID code...');
    const sendVerifyRes3 = await fetch(`${API_BASE}/send-email-verification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: TEST_EMAIL }),
    });
    await expectStatus('send email verification #3', sendVerifyRes3, 200);
    const userAfterThirdSend = await getUser();
    const validEmailCode = userAfterThirdSend?.emailVerificationCode;
    if (!validEmailCode) throw new Error('Expected valid email verification code after re-send');
    if (validEmailCode === firstEmailCode) {
      throw new Error('Expected new email verification code after expiry');
    }

    const verifyEmailValidRes = await fetch(`${API_BASE}/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: TEST_EMAIL, code: validEmailCode }),
    });
    await expectStatus('verify email valid code', verifyEmailValidRes, 200);
    console.log('    ✓ Valid email verification code accepted');

    // 7. Verify Email after already verified
    console.log('\n[7] Testing Verify Email after already verified...');
    const verifyEmailAlreadyRes = await fetch(`${API_BASE}/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: TEST_EMAIL, code: validEmailCode }),
    });
    const verifyEmailAlreadyBody = await expectStatus('verify email already verified', verifyEmailAlreadyRes, 200);
    if (!String(verifyEmailAlreadyBody?.message || '').toLowerCase().includes('already verified')) {
      throw new Error(`Expected already verified message, got: ${JSON.stringify(verifyEmailAlreadyBody)}`);
    }
    console.log('    ✓ Already-verified email handling works');

    // 8. Forgot Password + duplicate guard
    console.log('\n[8] Testing Forgot Password + duplicate guard...');
    const forgotRes = await fetch(`${API_BASE}/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: TEST_EMAIL }),
    });
    await expectStatus('forgot password #1', forgotRes, 200);
    const userAfterForgot1 = await getUser();
    const firstForgotCode = userAfterForgot1?.forgotPasswordCode;
    if (!firstForgotCode) throw new Error('Expected forgotPasswordCode after first forgot-password');

    const forgotRes2 = await fetch(`${API_BASE}/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: TEST_EMAIL }),
    });
    await expectStatus('forgot password #2', forgotRes2, 200);
    const userAfterForgot2 = await getUser();
    if (userAfterForgot2?.forgotPasswordCode !== firstForgotCode) {
      throw new Error(`Expected duplicate forgot-password request to keep same code. First=${firstForgotCode} Second=${userAfterForgot2?.forgotPasswordCode}`);
    }
    console.log('    ✓ Forgot-password duplicate guard works');

    console.log('    ↳ Validating concurrent duplicate forgot-password requests...');
    await Promise.all([
      fetch(`${API_BASE}/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: TEST_EMAIL }),
      }),
      fetch(`${API_BASE}/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: TEST_EMAIL }),
      }),
    ]);
    const userAfterConcurrentForgot = await getUser();
    if (userAfterConcurrentForgot?.forgotPasswordCode !== firstForgotCode) {
      throw new Error('Concurrent forgot-password requests rotated code unexpectedly');
    }
    console.log('    ✓ Concurrent forgot-password requests collapsed correctly');

    // 9. Verify forgot code invalid
    console.log('\n[9] Testing Verify Forgot Password Code with INVALID code...');
    const verifyFpInvalidRes = await fetch(`${API_BASE}/verify-forgot-password-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: TEST_EMAIL, code: '000000' }),
    });
    await expectStatus('verify forgot invalid code', verifyFpInvalidRes, 400);
    console.log('    ✓ Invalid forgot-password code rejected');

    // 10. Verify forgot code expired
    console.log('\n[10] Testing Verify Forgot Password Code with EXPIRED code...');
    await expireForgotPasswordCode();
    const verifyFpExpiredRes = await fetch(`${API_BASE}/verify-forgot-password-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: TEST_EMAIL, code: firstForgotCode }),
    });
    await expectStatus('verify forgot expired code', verifyFpExpiredRes, 400);
    console.log('    ✓ Expired forgot-password code rejected');

    // 11. Re-send forgot password after expiry and verify valid code
    console.log('\n[11] Testing Verify Forgot Password Code with VALID code...');
    const forgotRes3 = await fetch(`${API_BASE}/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: TEST_EMAIL }),
    });
    await expectStatus('forgot password #3', forgotRes3, 200);
    const userAfterForgot3 = await getUser();
    const validForgotCode = userAfterForgot3?.forgotPasswordCode;
    if (!validForgotCode) throw new Error('Expected forgotPasswordCode after re-send');
    if (validForgotCode === firstForgotCode) {
      throw new Error('Expected new forgot-password code after expiry');
    }

    const verifyFpValidRes = await fetch(`${API_BASE}/verify-forgot-password-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: TEST_EMAIL, code: validForgotCode }),
    });
    await expectStatus('verify forgot valid code', verifyFpValidRes, 200);
    console.log('    ✓ Valid forgot-password code accepted');

    // 12. Reset Password mismatch
    console.log('\n[12] Testing Reset Password with mismatched passwords...');
    const resetMismatchRes = await fetch(`${API_BASE}/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: TEST_EMAIL,
        code: validForgotCode,
        newPassword: NEW_PASSWORD,
        confirmPassword: `${NEW_PASSWORD}x`,
      }),
    });
    await expectStatus('reset password mismatch', resetMismatchRes, 400);
    console.log('    ✓ Mismatched reset passwords rejected');

    // 13. Reset Password invalid code
    console.log('\n[13] Testing Reset Password with invalid code...');
    const resetInvalidCodeRes = await fetch(`${API_BASE}/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: TEST_EMAIL,
        code: '000000',
        newPassword: NEW_PASSWORD,
        confirmPassword: NEW_PASSWORD,
      }),
    });
    await expectStatus('reset password invalid code', resetInvalidCodeRes, 400);
    console.log('    ✓ Invalid reset code rejected');

    // 14. Reset Password valid
    console.log('\n[14] Testing Reset Password with valid code...');
    const resetRes = await fetch(`${API_BASE}/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: TEST_EMAIL,
        code: validForgotCode,
        newPassword: NEW_PASSWORD,
        confirmPassword: NEW_PASSWORD,
      }),
    });
    await expectStatus('reset password valid', resetRes, 200);
    console.log('    ✓ Password successfully reset');

    // 15. Verify forgot code after reset should fail (code cleared)
    console.log('\n[15] Testing Verify Forgot Password Code after reset...');
    const verifyFpAfterResetRes = await fetch(`${API_BASE}/verify-forgot-password-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: TEST_EMAIL, code: validForgotCode }),
    });
    await expectStatus('verify forgot code after reset', verifyFpAfterResetRes, 400);
    console.log('    ✓ Forgot-password code is invalid after reset');

    // 16. Test Login with new password
    console.log('\n[16] Testing Login with NEW Password...');
    const loginNewRes = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: TEST_EMAIL,
        password: NEW_PASSWORD,
      }),
    });
    const loginNewData = await expectStatus('login new password', loginNewRes, 200);
    console.log('    ✓ Login with new password successful');
    accessToken = loginNewData.data.tokens.accessToken;

    // 17. Get "Me" Profile (requires Auth token)
    console.log('\n[17] Testing /me protected route...');
    const meRes = await fetch(`${API_BASE}/me`, {
      method: 'GET',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
    });
    await expectStatus('me', meRes, 200);
    console.log('    ✓ User profile retrieved successfully');

    console.log('\n--- ALL TESTS PASSED! ---');

  } catch (err: any) {
    console.error('\n❌ TEST FAILED:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

testAuthProcess();
