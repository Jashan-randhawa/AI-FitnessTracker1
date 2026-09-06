require('dotenv').config();

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
  });
};

start();

process.on('unhandledRejection', (err) => {
  console.error('Unhandled promise rejection:', err);
});
