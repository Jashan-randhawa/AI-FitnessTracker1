require('dotenv').config();

const { validateEnvironment } = require('./src/config/envValidator');
const envValidation = validateEnvironment();

if (!envValidation.valid) {
  console.error('❌ [FATAL] Environment validation failed:');
  for (const err of envValidation.errors) {
    console.error(`  - ${err}`);
  }
  process.exit(1);
}

if (envValidation.warnings.length > 0) {
  for (const warn of envValidation.warnings) {
    console.warn(`⚠️  [CONFIG WARNING] ${warn}`);
  }
}

const app = require('./src/app');
const connectDB = require('./src/config/db');
const { seedBlogPosts } = require('./src/services/seed.service');

const HOST = process.env.HOST || '0.0.0.0';
const PORT = process.env.PORT || 1337;

const start = async () => {
  await connectDB();

  try {
    await seedBlogPosts();
  } catch (err) {
    console.error('Bootstrap: failed to seed blog posts', err);
  }

  app.listen(PORT, HOST, () => {
    console.log(`AI Fitness Tracker API running at http://${HOST}:${PORT}`);
    if (!process.env.BREVO_API_KEY) {
      if (process.env.NODE_ENV === 'production') {
        console.warn('⚠️  [SECURITY WARNING] BREVO_API_KEY is not configured in production. Password reset emails will fail!');
      } else {
        console.log('ℹ️  [email] BREVO_API_KEY not configured — reset links will be printed to server console in dev mode.');
      }
    }
  });
};

start();

process.on('unhandledRejection', (err) => {
  console.error('Unhandled promise rejection:', err);
});
