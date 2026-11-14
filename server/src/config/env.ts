// Central, validated configuration. The ONLY file that reads process.env.
// Validated with Zod at startup: the app refuses to boot with missing/invalid settings.
// Tests set their own env (tests/helpers/env.ts) and never read your real .env.
import dotenv from 'dotenv';
import { z } from 'zod';

if (process.env.NODE_ENV !== 'test') dotenv.config({ quiet: true });

// Empty strings in .env (e.g. `ADMIN_EMAILS=`) behave like "not set".
const emptyToUndefined = (value: unknown) => (value === '' ? undefined : value);
const optionalString = z.preprocess(emptyToUndefined, z.string().optional());
const numberWithDefault = (fallback: number) =>
  z.preprocess(emptyToUndefined, z.coerce.number().int().min(0).default(fallback));
const emailList = z
  .preprocess(emptyToUndefined, z.string().optional())
  .transform((value) => (value ?? '').split(',').map((item) => item.trim().toLowerCase()).filter(Boolean));

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: numberWithDefault(5000),
  MONGO_URI: z.string().min(1, 'is required'),

  JWT_SECRET: z.string().min(32, 'must be at least 32 characters (generate one: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))")'),
  JWT_EXPIRES_IN: z.preprocess(emptyToUndefined, z.string().default('1d')),
  BCRYPT_ROUNDS: numberWithDefault(12),

  // OTP policy (ADR-0005)
  OTP_SECRET: optionalString,
  OTP_TTL_MINUTES: numberWithDefault(10),
  OTP_MAX_ATTEMPTS: numberWithDefault(5),
  OTP_RESEND_COOLDOWN_SECONDS: numberWithDefault(60),

  // Email (ADR-0009)
  // Email (ADR-0009)
  EMAIL_HOST: z.preprocess(
    emptyToUndefined,
    z.string().default('smtp.gmail.com')
  ),
  EMAIL_PORT: numberWithDefault(465),
  EMAIL_USER: z.string().min(1, 'is required'),
  EMAIL_PASS: z.string().min(1, 'is required'),
  EMAIL_FROM: optionalString,
  CONTACT_EMAIL: optionalString,

  EVENT_NAME: z.preprocess(emptyToUndefined, z.string().default('Code-a-Nova Hackathon')),
  CLIENT_URL: z.preprocess(emptyToUndefined, z.string().default('http://localhost:5173')),
  ADMIN_EMAILS: emailList,
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  const problems = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
  throw new Error(`Invalid environment configuration:\n${problems}`);
}
const env = parsed.data;

export const config = {
  nodeEnv: env.NODE_ENV,
  isTest: env.NODE_ENV === 'test',
  port: env.PORT,
  mongoUri: env.MONGO_URI,

  jwtSecret: env.JWT_SECRET,
  jwtExpiresIn: env.JWT_EXPIRES_IN,
  bcryptRounds: env.BCRYPT_ROUNDS,

  otpSecret: env.OTP_SECRET ?? env.JWT_SECRET,
  otpTtlMinutes: env.OTP_TTL_MINUTES,
  otpMaxAttempts: env.OTP_MAX_ATTEMPTS,
  otpResendCooldownSeconds: env.OTP_RESEND_COOLDOWN_SECONDS,

  emailHost: env.EMAIL_HOST,
  emailPort: env.EMAIL_PORT,
  emailUser: env.EMAIL_USER,
  emailPass: env.EMAIL_PASS,
  emailFrom: env.EMAIL_FROM ?? env.EMAIL_USER,
  emailSenderName: 'Code-a-Nova',
  contactEmail: env.CONTACT_EMAIL ?? env.EMAIL_USER,

  eventName: env.EVENT_NAME,
  clientUrls: env.CLIENT_URL.split(',').map((item) => item.trim()).filter(Boolean),
  adminEmails: env.ADMIN_EMAILS,
};
