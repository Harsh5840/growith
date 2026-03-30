import readline from 'readline';

const BASE_URL = 'http://localhost:3000/api/v1/investor/auth';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const ask = (question) => new Promise((resolve) => rl.question(question, resolve));

async function runTests() {
  const timestamp = Date.now();
  const testEmail = `verify_test_${timestamp}@example.com`;
  const password = 'Password@123';
  const newPassword = 'NewPassword@321';

  console.log('--- Prerequisites ---');
  console.log('1. Make sure your local Express server is running (e.g. npm run dev).');
  console.log('2. Make sure you have run your database migration.');
  console.log('3. Keep your SERVER terminal visible, as you will need the mock codes logged there.');
  console.log('---------------------\n');

  console.log('Step 1: Registering a dummy user to test with...');
  const regResp = await fetch(`${BASE_URL}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: testEmail,
      fullName: 'Verification Tester',
      password: password,
      confirmPassword: password
    })
  });
  
  if (!regResp.ok) {
     const text = await regResp.text();
     console.error('Registration failed! Aborting... MSG:', text);
     process.exit(1);
  }
  console.log('✅ Registered successfully.\n');

  console.log('=== TEST 1: EMAIL VERIFICATION FLOW ===');
  console.log(`Triggering send-email-verification for ${testEmail}...`);
  const sendEvalResp = await fetch(`${BASE_URL}/send-email-verification`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testEmail })
  });
  console.log('Status:', sendEvalResp.status);

  console.log('\n💬 CHECK YOUR SERVER TERMINAL!');
  const emailCode = await ask('Enter the 6-digit email verification code shown in your server log: ');

  console.log(`\nVerifying email with code ${emailCode}...`);
  const evalResp = await fetch(`${BASE_URL}/verify-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testEmail, code: emailCode.trim() })
  });
  const evalBody = await evalResp.json();
  if (evalResp.ok) {
     console.log('✅ Email verified successfully! Response:', evalBody.message);
  } else {
     console.error('❌ Email verification failed:', evalBody);
  }

  console.log('\n=== TEST 2: FORGOT & RESET PASSWORD FLOW ===');
  console.log(`Triggering forgot-password for ${testEmail}...`);
  const sendForgotResp = await fetch(`${BASE_URL}/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testEmail })
  });
  console.log('Status:', sendForgotResp.status);

  console.log('\n💬 CHECK YOUR SERVER TERMINAL AGAIN!');
  const forgotCode = await ask('Enter the 6-digit password reset code shown in your server log: ');

  console.log(`\n(Optional) Explicitly verifying the 6-digit code without resetting password yet...`);
  const verifyForgotResp = await fetch(`${BASE_URL}/verify-forgot-password-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testEmail, code: forgotCode.trim() })
  });
  if (verifyForgotResp.ok) {
     console.log('✅ Code verified as perfectly valid!');
  } else {
     console.error('❌ Could not verify code:', await verifyForgotResp.json());
  }

  console.log(`\nResetting password to: ${newPassword}...`);
  const resetResp = await fetch(`${BASE_URL}/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: testEmail,
      code: forgotCode.trim(),
      newPassword: newPassword,
      confirmPassword: newPassword
    })
  });
  
  if (resetResp.ok) {
     console.log('✅ Password reset successfully!');
  } else {
     console.error('❌ Password reset failed:', await resetResp.json());
  }

  console.log('\n=== FINAL LOGIN TEST WITH NEW PASSWORD ===');
  const loginResp = await fetch(`${BASE_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testEmail, password: newPassword })
  });
  
  if (loginResp.ok) {
     console.log('✅ Login with NEW password was successful! Tests Complete!');
  } else {
     console.error('❌ Login with new password failed:', await loginResp.text());
  }

  rl.close();
}

runTests().catch(e => {
  console.error('Test crashed:', e);
  rl.close();
});
