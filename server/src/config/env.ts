import { createPrivateKey, createPublicKey } from 'node:crypto'
import { seoOrigin } from '../common/seoOrigin.js'
import dotenv from 'dotenv'
import path from 'path'
import { z } from 'zod'

// Load .env file
dotenv.config({ path: path.resolve(process.cwd(), '.env') })

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  PORT: z.coerce.number().default(4000),
  MONGODB_URI: z.string({ required_error: 'MONGODB_URI is required' }).min(1),
  REDIS_HOST: z.string().default('127.0.0.1'),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional().default(''),
  REDIS_TLS: z.enum(['true', 'false']).default('false').transform(value => value === 'true'),
  CRAWLER_SOURCES_JSON: z.string().default('[]'),
  BACKUP_LOCAL_DIR: z.string().default(''),
  BACKUP_KEY_FILE: z.string().default(''),
  BACKUP_MONGO_CONFIG_FILE: z.string().default(''),
  BACKUP_TIMEOUT_MS: z.coerce.number().int().min(1000).max(3600000).default(600000),
  BACKUP_MAX_BYTES: z.coerce.number().int().min(1024).max(10737418240).default(536870912),
  BACKUP_TOTAL_BYTES: z.coerce.number().int().min(1024).max(1099511627776).default(5368709120),
  JWT_PRIVATE_KEY: z.string({ required_error: 'JWT_PRIVATE_KEY is required' }).min(1),
  JWT_PUBLIC_KEY: z.string({ required_error: 'JWT_PUBLIC_KEY is required' }).min(1),
  JWT_REFRESH_PRIVATE_KEY: z.string().optional(),
  JWT_REFRESH_PUBLIC_KEY: z.string().optional(),
  GOOGLE_CALLBACK_URL: z.string().url().optional(),
  TRUST_PROXY: z.string().default(''),
  SSR_SIGNING_SECRET: z.string().refine(value => !value || value.length >= 32, 'SSR_SIGNING_SECRET must be empty or at least 32 characters').default(''),
  CLIENT_URL: z
    .string()
    .transform((val) => (val && val.trim() ? val.trim() : 'http://localhost:5173'))
    .default('http://localhost:5173'),
  COOKIE_DOMAIN: z.string().optional().default('localhost'),
  GOOGLE_CLIENT_ID: z.string().optional().default(''),
  GOOGLE_CLIENT_SECRET: z.string().optional().default(''),
  SMTP_HOST: z.string().optional().default(''),
  SMTP_PORT: z.coerce.number().optional().default(587),
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASS: z.string().optional().default(''),
  SMTP_FROM_EMAIL: z.string().optional().default(''),
  // Phase 8 — SEO
  PUBLIC_SITE_URL: z
    .string()
    .transform((val) => (val && val.trim() ? val.trim().replace(/\/+$/, '') : 'http://localhost:5173'))
    .default('http://localhost:5173'),
  SEO_INDEXABLE: z
    .string()
    .transform((val) => val === 'true')
    .default('false'),
  SEO_SITEMAP_INTERVAL_MS: z.coerce
    .number()
    .min(60_000)
    .max(3_600_000)
    .default(900_000),
})

const parseEnv = () => {
  const result = envSchema.safeParse(process.env)

  if (!result.success) {
    console.error('❌ Invalid environment variables:', result.error.format())
    throw new Error('Invalid environment variables')
  }

  const value = result.data
  value.PUBLIC_SITE_URL = seoOrigin(value.PUBLIC_SITE_URL, value.NODE_ENV === 'production' || value.SEO_INDEXABLE)
  if (!!value.JWT_REFRESH_PRIVATE_KEY !== !!value.JWT_REFRESH_PUBLIC_KEY) throw new Error('Both refresh RSA keys must be configured together')
  if (value.NODE_ENV === 'production') {
    if (!value.REDIS_PASSWORD.trim()) throw new Error('Production requires an authenticated Redis connection')
    if (!value.JWT_REFRESH_PRIVATE_KEY || !value.JWT_REFRESH_PUBLIC_KEY) throw new Error('Production requires a separate refresh RSA key pair')
    const decode = (key: string) => key.includes('-----BEGIN') ? key : Buffer.from(key, 'base64').toString('utf8')
    const fingerprint = (key: string) => createPublicKey(decode(key)).export({ type: 'spki', format: 'der' }).toString('base64')
    const accessPublic = fingerprint(value.JWT_PUBLIC_KEY)
    const refreshPublic = fingerprint(value.JWT_REFRESH_PUBLIC_KEY)
    if (accessPublic === refreshPublic) throw new Error('Access and refresh RSA keys must be distinct')
    for (const [privateKey, publicKey] of [[value.JWT_PRIVATE_KEY, accessPublic], [value.JWT_REFRESH_PRIVATE_KEY, refreshPublic]]) {
      const derived = createPublicKey(createPrivateKey(decode(privateKey))).export({ type: 'spki', format: 'der' }).toString('base64')
      if (derived !== publicKey) throw new Error('RSA private/public key pair does not match')
    }
    if (value.GOOGLE_CLIENT_ID && !value.GOOGLE_CALLBACK_URL?.startsWith('https://')) throw new Error('Production Google OAuth requires an HTTPS GOOGLE_CALLBACK_URL')
  }
  return value
}

export const env = parseEnv()
export type Env = z.infer<typeof envSchema>
