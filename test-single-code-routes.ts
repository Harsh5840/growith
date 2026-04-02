import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const API_BASE = process.env.TEST_API_BASE || 'http://localhost:3000/api/v1/investor/auth';
const TEST_EMAIL = process.env.TEST_EMAIL || 'gautamharsh584@gmail.com';
const PASSWORD = process.env.TEST_PASSWORD || 'Password123!';

async function ensureUserExists(email: string): Promise<void> {
  const existing = await prisma.investorAuthUser.findUnique({ where: { email } });
  if (existing) return;

  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  await prisma.investorAuthUser.create({
    data: {
      email,
      fullName: 'Single Route Code Test User',
      passwordHash,
      emailVerified: false,
      isActive: true,
    },
  });
}

async function resetCodeState(email: string): Promise<void> {
  await prisma.investorAuthUser.update({
    where: { email },
    data: {
      emailVerified: false,
      emailVerificationCode: null,
      emailVerificationExpires: null,
      forgotPasswordCode: null,
      forgotPasswordExpires: null,
    },
  });
}

async function callRoute(path: string, body: Record<string, string>) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const json = await response.json().catch(async () => ({ raw: await response.text() }));
  return { status: response.status, body: json };
}

async function run() {
  const email = TEST_EMAIL.toLowerCase();

  console.log('--- SINGLE-SHOT ROUTE TEST (ONE CALL PER ROUTE) ---');
  console.log('Email:', email);

  await ensureUserExists(email);
  await resetCodeState(email);
  console.log('State reset: cleared existing verification/reset codes.');

  const verifySend = await callRoute('/send-email-verification', { email });
  if (verifySend.status !== 200) {
    throw new Error(`send-email-verification failed: ${verifySend.status} ${JSON.stringify(verifySend.body)}`);
  }

  const userAfterVerify = await prisma.investorAuthUser.findUnique({ where: { email } });
  const emailCode = userAfterVerify?.emailVerificationCode;

  const forgotSend = await callRoute('/forgot-password', { email });
  if (forgotSend.status !== 200) {
    throw new Error(`forgot-password failed: ${forgotSend.status} ${JSON.stringify(forgotSend.body)}`);
  }

  const userAfterForgot = await prisma.investorAuthUser.findUnique({ where: { email } });
  const forgotCode = userAfterForgot?.forgotPasswordCode;

  console.log('send-email-verification status:', verifySend.status);
  console.log('emailVerificationCode:', emailCode ?? '(none)');
  console.log('forgot-password status:', forgotSend.status);
  console.log('forgotPasswordCode:', forgotCode ?? '(none)');
  console.log('--- DONE: each route was called exactly once ---');
}

run()
  .catch((error) => {
    console.error('TEST FAILED:', error.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
