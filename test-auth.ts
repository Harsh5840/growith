import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const API_BASE = 'http://localhost:3000/api/v1/investor/auth';
const TEST_EMAIL = 'gautamharsh584@gmail.com';

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
        password: 'Password123!',
        confirmPassword: 'Password123!',
      }),
    });
    const registerData = await registerRes.json();
    if (registerRes.status !== 201) throw new Error(JSON.stringify(registerData));
    console.log('    ✓ Registration successful');
    accessToken = registerData.data.tokens.accessToken;

    // 2. Login
    console.log('\n[2] Testing Login...');
    const loginRes = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: TEST_EMAIL,
        password: 'Password123!',
      }),
    });
    const loginData = await loginRes.json();
    if (loginRes.status !== 200) throw new Error(JSON.stringify(loginData));
    console.log('    ✓ Login successful');

    // 3. Send Email Verification (optional step in flow, but good to test)
    console.log('\n[3] Testing Send Email Verification...');
    const sendVerifyRes = await fetch(`${API_BASE}/send-email-verification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: TEST_EMAIL }),
    });
    const sendVerifyData = await sendVerifyRes.json();
    if (sendVerifyRes.status !== 200) throw new Error(JSON.stringify(sendVerifyData));
    console.log('    ✓ Email verification code sent (Check your inbox!)');

    // 4. Forgot Password
    console.log('\n[4] Testing Forgot Password...');
    const forgotRes = await fetch(`${API_BASE}/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: TEST_EMAIL }),
    });
    const forgotData = await forgotRes.json();
    if (forgotRes.status !== 200) throw new Error(JSON.stringify(forgotData));
    console.log('    ✓ Forgot password email sent (Check your inbox!)');

    // 5. Read Code from DB manually for automation
    console.log('\n[5] Fetching codes from Database for automation...');
    const user = await prisma.investorAuthUser.findUnique({ where: { email: TEST_EMAIL } });
    const fpCode = user?.forgotPasswordCode;
    console.log(`    ✓ Retrieved Forgot Password Code: ${fpCode}`);

    if (!fpCode) throw new Error('Got empty code from DB');

    // 6. Verify Forgot Password Code
    console.log('\n[6] Testing Verify Forgot Password Code...');
    const verifyFpRes = await fetch(`${API_BASE}/verify-forgot-password-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: TEST_EMAIL,
        code: fpCode,
      }),
    });
    const verifyFpData = await verifyFpRes.json();
    if (verifyFpRes.status !== 200) throw new Error(JSON.stringify(verifyFpData));
    console.log('    ✓ Code successfully verified');

    // 7. Reset Password
    console.log('\n[7] Testing Reset Password...');
    const resetRes = await fetch(`${API_BASE}/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: TEST_EMAIL,
        code: fpCode,
        newPassword: 'NewPassword123!',
        confirmPassword: 'NewPassword123!',
      }),
    });
    const resetData = await resetRes.json();
    if (resetRes.status !== 200) throw new Error(JSON.stringify(resetData));
    console.log('    ✓ Password successfully reset');

    // 8. Test Login with new password
    console.log('\n[8] Testing Login with NEW Password...');
    const loginNewRes = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: TEST_EMAIL,
        password: 'NewPassword123!',
      }),
    });
    const loginNewData = await loginNewRes.json();
    if (loginNewRes.status !== 200) throw new Error(JSON.stringify(loginNewData));
    console.log('    ✓ Login with new password successful');
    accessToken = loginNewData.data.tokens.accessToken;

    // 9. Get "Me" Profile (requires Auth token)
    console.log('\n[9] Testing /me protected route...');
    const meRes = await fetch(`${API_BASE}/me`, {
      method: 'GET',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
    });
    const meData = await meRes.json();
    if (meRes.status !== 200) throw new Error(JSON.stringify(meData));
    console.log('    ✓ User profile retrieved successfully');

    console.log('\n--- ALL TESTS PASSED! ---');

  } catch (err: any) {
    console.error('\n❌ TEST FAILED:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

testAuthProcess();
