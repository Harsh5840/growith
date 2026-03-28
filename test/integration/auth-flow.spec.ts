import request from 'supertest';
import { createApp } from '../../src/app';

describe('Auth flow integration', () => {
  let app: ReturnType<typeof createApp>;
  const userEmail = 'auth.flow@example.com';
  const initialPassword = 'Strong@123';
  const newPassword = 'Changed@123';
  let accessToken = '';
  let refreshToken = '';

  beforeAll(() => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
    process.env.JWT_ACCESS_EXPIRY = process.env.JWT_ACCESS_EXPIRY || '1h';
    process.env.JWT_REFRESH_EXPIRY = process.env.JWT_REFRESH_EXPIRY || '7d';
    process.env.GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'test-google-client-id';
    process.env.GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || 'test-google-client-secret';
    process.env.GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/auth/callback';
    app = createApp();
  });

  it('registers a user', async () => {
    const response = await request(app).post('/api/v1/auth/register').send({
      email: userEmail,
      fullName: 'Auth Flow User',
      password: initialPassword,
      confirmPassword: initialPassword,
    });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.user.email).toBe(userEmail);
    accessToken = response.body.data.tokens.accessToken;
    refreshToken = response.body.data.tokens.refreshToken;
  });

  it('validates email for signup/signin and password check', async () => {
    const signupResponse = await request(app).post('/api/v1/auth/validate-email').send({
      email: userEmail,
      mode: 'signup',
    });
    expect(signupResponse.status).toBe(409);

    const signinNoPassword = await request(app).post('/api/v1/auth/validate-email').send({
      email: userEmail,
      mode: 'signin',
    });
    expect(signinNoPassword.status).toBe(200);
    expect(signinNoPassword.body.message).toBe('Email exists, enter password');

    const signinWithPassword = await request(app).post('/api/v1/auth/validate-email').send({
      email: userEmail,
      mode: 'signin',
      password: initialPassword,
    });
    expect(signinWithPassword.status).toBe(200);
    expect(signinWithPassword.body.message).toBe('Login successful');
  });

  it('logs in user', async () => {
    const response = await request(app).post('/api/v1/auth/login').send({
      email: userEmail,
      password: initialPassword,
    });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    accessToken = response.body.data.tokens.accessToken;
    refreshToken = response.body.data.tokens.refreshToken;
  });

  it('gets google auth url and handles invalid google code', async () => {
    const urlResponse = await request(app).get('/api/v1/auth/google/url');
    expect(urlResponse.status).toBe(200);
    expect(typeof urlResponse.body.data.authUrl).toBe('string');

    const invalidCodeResponse = await request(app).post('/api/v1/auth/google').send({ code: 'invalid-code' });
    expect(invalidCodeResponse.status).toBe(400);
  });

  it('refreshes token pair', async () => {
    const response = await request(app).post('/api/v1/auth/refresh-token').send({ refreshToken });
    expect(response.status).toBe(200);
    expect(response.body.data.tokens.accessToken).toBeDefined();
    expect(response.body.data.tokens.refreshToken).toBeDefined();
  });

  it('supports forgot-password and reset-password then login with new password', async () => {
    const forgotResponse = await request(app).post('/api/v1/auth/forgot-password').send({ email: userEmail });
    expect(forgotResponse.status).toBe(200);

    const mismatchReset = await request(app).post('/api/v1/auth/reset-password').send({
      token: accessToken,
      newPassword,
      confirmPassword: 'NoMatch@123',
    });
    expect(mismatchReset.status).toBe(400);

    const resetResponse = await request(app).post('/api/v1/auth/reset-password').send({
      token: accessToken,
      newPassword,
      confirmPassword: newPassword,
    });
    expect(resetResponse.status).toBe(200);

    const relogin = await request(app).post('/api/v1/auth/login').send({
      email: userEmail,
      password: newPassword,
    });
    expect(relogin.status).toBe(200);
    accessToken = relogin.body.data.tokens.accessToken;
  });

  it('returns profile on /me and allows /logout with bearer token', async () => {
    const meResponse = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(meResponse.status).toBe(200);
    expect(meResponse.body.data.user.email).toBe(userEmail);

    const logoutResponse = await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(logoutResponse.status).toBe(200);
    expect(logoutResponse.body.message).toBe('Logout successful');
  });
});
