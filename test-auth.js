const BASE_URL = 'https://growith-two.vercel.app/api/v1/investor/auth';

async function testAuth() {
  const timestamp = Date.now();
  const testUser = {
    email: `testuser_${timestamp}@example.com`,
    fullName: 'Test User',
    password: 'Password@123',
    confirmPassword: 'Password@123'
  };

  let accessToken = '';
  let refreshToken = '';

  console.log('--- Starting Auth Route Tests ---');

  // 1. Validate Email (Signup)
  try {
    console.log('\n1. Testing POST /validate-email (signup mode)...');
    const resp = await fetch(`${BASE_URL}/validate-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testUser.email, mode: 'signup' })
    });
    const data = await resp.json();
    console.log('Response:', data);
    if (resp.ok) console.log('✅ Email validation (signup) successful');
    else throw new Error('Email validation (signup) failed');
  } catch (err) {
    console.error('❌ Error:', err.message);
  }

  // 2. Register
  try {
    console.log('\n2. Testing POST /register...');
    const resp = await fetch(`${BASE_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testUser)
    });
    const data = await resp.json();
    console.log('Response Status:', resp.status);
    console.log('Response body:', JSON.stringify(data).substring(0, 100) + '...');
    if (resp.ok) {
      console.log('✅ Registration successful');
      accessToken = data.data.tokens.accessToken;
      refreshToken = data.data.tokens.refreshToken;
    } else {
      throw new Error(`Registration failed: ${JSON.stringify(data)}`);
    }
  } catch (err) {
    console.error('❌ Error:', err.message);
  }

  // 3. Validate Email (Signin)
  try {
    console.log('\n3. Testing POST /validate-email (signin mode)...');
    const resp = await fetch(`${BASE_URL}/validate-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testUser.email, mode: 'signin' })
    });
    const data = await resp.json();
    console.log('Response:', data);
    if (resp.ok) console.log('✅ Email validation (signin) successful');
    else throw new Error('Email validation (signin) failed');
  } catch (err) {
    console.error('❌ Error:', err.message);
  }

  // 4. Login
  try {
    console.log('\n4. Testing POST /login...');
    const resp = await fetch(`${BASE_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testUser.email, password: testUser.password })
    });
    const data = await resp.json();
    console.log('Response Status:', resp.status);
    if (resp.ok) {
      console.log('✅ Login successful');
      accessToken = data.data.tokens.accessToken;
      refreshToken = data.data.tokens.refreshToken;
    } else {
      throw new Error('Login failed');
    }
  } catch (err) {
    console.error('❌ Error:', err.message);
  }

  // 5. Get Me (Authenticated)
  try {
    console.log('\n5. Testing GET /me (authenticated)...');
    const resp = await fetch(`${BASE_URL}/me`, {
      method: 'GET',
      headers: { 
        'Authorization': `Bearer ${accessToken}`
      }
    });
    const data = await resp.json();
    console.log('Response:', data);
    if (resp.ok) console.log('✅ Get Me successful');
    else throw new Error('Get Me failed');
  } catch (err) {
    console.error('❌ Error:', err.message);
  }

  // 6. Refresh Token
  try {
    console.log('\n6. Testing POST /refresh-token...');
    const resp = await fetch(`${BASE_URL}/refresh-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken })
    });
    const data = await resp.json();
    console.log('Response Status:', resp.status);
    if (resp.ok) {
      console.log('✅ Token refresh successful');
      accessToken = data.data.tokens.accessToken;
      refreshToken = data.data.tokens.refreshToken;
    } else {
      throw new Error('Token refresh failed');
    }
  } catch (err) {
    console.error('❌ Error:', err.message);
  }

  // 7. Logout (Authenticated)
  try {
    console.log('\n7. Testing POST /logout (authenticated)...');
    const resp = await fetch(`${BASE_URL}/logout`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${accessToken}`
      }
    });
    const data = await resp.json();
    console.log('Response:', data);
    if (resp.ok) console.log('✅ Logout successful');
    else throw new Error('Logout failed');
  } catch (err) {
    console.error('❌ Error:', err.message);
  }

  // 8. Error Case: Duplicate Registration
  try {
    console.log('\n8. Testing Duplicate Registration...');
    const resp = await fetch(`${BASE_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testUser)
    });
    const data = await resp.json();
    console.log('Response (expected error):', resp.status, data.message);
    if (resp.status === 409) console.log('✅ Duplicate registration handled correctly (409)');
    else console.log('⚠️ Unexpected status for duplicate registration:', resp.status);
  } catch (err) {
    console.error('❌ Error:', err.message);
  }

  // 9. Error Case: Invalid Login
  try {
    console.log('\n9. Testing Invalid Login...');
    const resp = await fetch(`${BASE_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testUser.email, password: 'wrongpassword' })
    });
    const data = await resp.json();
    console.log('Response (expected error):', resp.status, data.message);
    if (resp.status === 401) console.log('✅ Invalid login handled correctly (401)');
    else console.log('⚠️ Unexpected status for invalid login:', resp.status);
  } catch (err) {
    console.error('❌ Error:', err.message);
  }

  // 10. Google Auth URL
  try {
    console.log('\n10. Testing GET /google/url...');
    const resp = await fetch(`${BASE_URL}/google/url`);
    const data = await resp.json();
    console.log('Response:', data.data.authUrl ? 'URL received' : 'No URL');
    if (resp.ok && data.data.authUrl) console.log('✅ Google Auth URL retrieval successful');
    else throw new Error('Google Auth URL retrieval failed');
  } catch (err) {
    console.error('❌ Error:', err.message);
  }

  console.log('\n--- Auth Route Tests Completed ---');
}

testAuth();
