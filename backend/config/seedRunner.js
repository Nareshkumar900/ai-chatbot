/**
 * Standalone Database Seeder Runner
 */
const fs = require('fs');
const path = require('path');
const db = require('./db');

async function runSeed() {
  console.log('[Seed] Re-seeding database...');
  const sqliteFile = path.join(__dirname, '../../database/medical_system.sqlite');
  if (fs.existsSync(sqliteFile)) {
    try {
      fs.unlinkSync(sqliteFile);
      console.log('[Seed] Removed previous database file.');
    } catch (e) {
      console.warn('[Seed] Could not remove existing file:', e.message);
    }
  }

  await db.initDB();
  console.log('[Seed] Database initialization and seed completed successfully!');
  process.exit(0);
}

runSeed().catch(err => {
  console.error('[Seed] Error during seeding:', err);
  process.exit(1);
});
