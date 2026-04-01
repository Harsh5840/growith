const REMOTE_API_BASE = 'https://growith-zwl3.vercel.app/api/v1/investor/auth';
const TEST_EMAIL = 'shuklaharsh5840@gmail.com';

async function testRemoteCodeRoutes() {
  console.log('--- TESTING REMOTE CODE SENDING ROUTES ---');
  console.log(`Target URL: ${REMOTE_API_BASE}\n`);

  try {
    // 1. Register
    console.log(`[1] Testing /register with ${TEST_EMAIL}...`);
    const registerRes = await fetch(`${REMOTE_API_BASE}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: TEST_EMAIL,
        fullName: 'Remote Tester',
        password: 'Password123!',
        confirmPassword: 'Password123!'
      }),
    });
    
    const registerData = await registerRes.json().catch(() => null);
    
    if (registerRes.status === 201 || registerRes.status === 200) {
      console.log('    ✓ SUCCESS: User registered and Verification email triggered!');
    } else if (registerRes.status === 409) {
      console.log('    ℹ️ INFO: User already exists. Verification email was NOT triggered by register step.');
    } else {
      console.error(`    ❌ FAILED: Status ${registerRes.status}`);
      console.error('    Response:', registerData || 'No JSON response');
    }

    // 2. Forgot Password
    console.log('\n[2] Testing /forgot-password...');
    const forgotRes = await fetch(`${REMOTE_API_BASE}/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: TEST_EMAIL }),
    });
    
    const forgotData = await forgotRes.json().catch(() => null);

    if (forgotRes.status === 200) {
      console.log('    ✓ SUCCESS: Forgot password email triggered!');
    } else {
      console.error(`    ❌ FAILED: Status ${forgotRes.status}`);
      console.error('    Response:', forgotData || 'No JSON response');
    }

    console.log('\n--- TESTS COMPLETED ---');

  } catch (err: any) {
    console.error('\n❌ SCRIPT FAILED:', err.message);
  }
}

testRemoteCodeRoutes();
