/**
 * Environment Configuration Validation
 * 
 * Validates all required environment variables at startup to fail fast
 * rather than encountering runtime errors later.
 */

import { z } from 'zod';

const DEFAULT_CORS_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://0.0.0.0:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5174',
  'http://localhost:5180',
  'http://127.0.0.1:5180',
  'http://localhost:5181',
  'http://127.0.0.1:5181',
  'http://localhost:5182',
  'http://127.0.0.1:5182',
  'http://localhost:5183',
  'http://127.0.0.1:5183',
  'http://localhost:5184',
  'http://127.0.0.1:5184',
  'http://localhost:5185',
  'http://127.0.0.1:5185',
  'http://localhost:5186',
  'http://127.0.0.1:5186',
  'http://localhost:1420',
  'http://127.0.0.1:1420',
  'tauri://localhost',
  'https://tauri.localhost',
  'http://tauri.localhost',
];

// ============ Environment Schema ============

const envSchema = z.object({
  // Required: Database
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // Required: Server
  PORT: z.string().regex(/^\d+$/, 'PORT must be a valid number').default('8001'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Required: Security
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters for security').optional()
    .transform((val) => {
      if (!val || val === 'change-this-in-production') {
        if (process.env.NODE_ENV === 'production') {
          throw new Error('JWT_SECRET must be set in production');
        }
        console.warn('⚠️  WARNING: Using default JWT_SECRET. Set a secure value for production!');
        return 'development-secret-change-in-production-32chars';
      }
      return val;
    }),
  JWT_EXPIRES_IN: z.string().default('7d'),

  // Optional: CORS (comma-separated for multiple origins)
  CORS_ORIGIN: z.string().optional().default(DEFAULT_CORS_ORIGINS.join(',')),

  // Optional: Email (SMTP)
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().regex(/^\d+$/).optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().email().optional(),

  // Optional: AWS SES
  AWS_REGION: z.string().optional(),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  SES_FROM_EMAIL: z.string().email().optional(),

  // Optional: WooCommerce
  WOOCOMMERCE_URL: z.string().url().optional(),
  WOOCOMMERCE_CONSUMER_KEY: z.string().optional(),
  WOOCOMMERCE_CONSUMER_SECRET: z.string().optional(),

  // Optional: QuickBooks
  QB_ODBC_DSN: z.string().optional(),
  QB_HOST: z.string().optional(),

  // Optional: File Storage
  UPLOAD_DIR: z.string().optional().default('./uploads'),
  MAX_FILE_SIZE: z.string().regex(/^\d+$/).optional().default('10485760'), // 10MB

  // Optional: Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.string().regex(/^\d+$/).optional().default('60000'),
  RATE_LIMIT_MAX_REQUESTS: z.string().regex(/^\d+$/).optional().default('200'),

  // Optional: Portal
  PORTAL_URL: z.string().url().optional(),
  PORTAL_JWT_SECRET: z.string().min(32, 'PORTAL_JWT_SECRET should be at least 32 characters for security').optional(),

  // Optional: Microsoft 365 OAuth2 (email)
  MS_CLIENT_ID: z.string().optional(),
  MS_CLIENT_SECRET: z.string().optional(),
  MS_TENANT_ID: z.string().optional(),
  MS_REDIRECT_URI: z.string().optional(),
});

export type EnvConfig = z.infer<typeof envSchema>;

// ============ Validation Function ============

let _validatedEnv: EnvConfig | null = null;

/**
 * Validate environment variables and return typed config
 * Call this at application startup before any other initialization
 */
export function validateEnv(): EnvConfig {
  // Return cached if already validated
  if (_validatedEnv) {
    return _validatedEnv;
  }

  console.log('🔍 Validating environment configuration...');

  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('\n❌ Environment validation failed:');
    console.error('━'.repeat(50));

    const errors = result.error.errors;
    for (const error of errors) {
      const path = error.path.join('.');
      console.error(`  • ${path}: ${error.message}`);
    }

    console.error('━'.repeat(50));
    console.error('\nPlease check your .env file or environment variables.');
    console.error('See .env.example for required configuration.\n');

    // In production, fail hard
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }

    // In development, throw to prevent silent failures
    throw new Error('Environment validation failed');
  }

  _validatedEnv = result.data;

  // Log successful validation with summary
  console.log('✅ Environment configuration validated');
  logConfigSummary(_validatedEnv);

  return _validatedEnv;
}

/**
 * Get validated environment config
 * Throws if validateEnv() hasn't been called
 */
export function getEnv(): EnvConfig {
  if (!_validatedEnv) {
    return validateEnv();
  }
  return _validatedEnv;
}

// ============ Configuration Summary ============

function logConfigSummary(env: EnvConfig): void {
  const features = {
    '📧 Email (SMTP)': !!(env.SMTP_HOST && env.SMTP_USER),
    '☁️  Email (AWS SES)': !!(env.AWS_REGION && env.SES_FROM_EMAIL),
    '🛒 WooCommerce': !!(env.WOOCOMMERCE_URL),
    '📊 QuickBooks': !!(env.QB_ODBC_DSN || env.QB_HOST),
    '🌐 Customer Portal': !!(env.PORTAL_URL),
  };

  const enabledFeatures = Object.entries(features)
    .filter(([, enabled]) => enabled)
    .map(([name]) => name);

  const disabledFeatures = Object.entries(features)
    .filter(([, enabled]) => !enabled)
    .map(([name]) => name);

  if (enabledFeatures.length > 0) {
    console.log('   Enabled: ' + enabledFeatures.join(', '));
  }
  if (disabledFeatures.length > 0 && process.env.NODE_ENV === 'development') {
    console.log('   Available: ' + disabledFeatures.join(', '));
  }
}

// ============ Environment Example Generator ============

/**
 * Generate example .env file content
 */
export function generateEnvExample(): string {
  return `# ERP Workflow Environment Configuration
# Copy this file to .env and fill in your values

# ============ Required ============

# PostgreSQL connection string
DATABASE_URL="postgresql://postgres:password@localhost:5432/erp_workflow"

# Server port
PORT=8001

# Environment (development, production, test)
NODE_ENV=development

# JWT secret - MUST be at least 32 characters in production
# Generate with: openssl rand -base64 32
JWT_SECRET=your-super-secret-jwt-key-at-least-32-chars

# ============ Optional: CORS ============

# Frontend origin for CORS
CORS_ORIGIN=http://localhost:5173

# ============ Optional: Email (SMTP) ============

# SMTP_HOST=smtp.example.com
# SMTP_PORT=587
# SMTP_USER=your-email@example.com
# SMTP_PASS=your-password
# SMTP_FROM=noreply@example.com

# ============ Optional: Email (AWS SES) ============

# AWS_REGION=us-east-1
# AWS_ACCESS_KEY_ID=your-access-key
# AWS_SECRET_ACCESS_KEY=your-secret-key
# SES_FROM_EMAIL=noreply@example.com

# ============ Optional: WooCommerce ============

# WOOCOMMERCE_URL=https://your-store.com
# WOOCOMMERCE_CONSUMER_KEY=ck_xxx
# WOOCOMMERCE_CONSUMER_SECRET=cs_xxx

# ============ Optional: QuickBooks ============

# QB_ODBC_DSN=QuickBooks Data
# QB_HOST=CHRISTINA-NEW

# ============ Optional: Customer Portal ============

# PORTAL_URL=http://localhost:5174
# PORTAL_JWT_SECRET=your-portal-jwt-secret

# ============ Optional: Rate Limiting ============

# RATE_LIMIT_WINDOW_MS=60000
# RATE_LIMIT_MAX_REQUESTS=200
`;
}
