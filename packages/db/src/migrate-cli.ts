#!/usr/bin/env node
import { runMigrations } from './migrate.js';

const ownerUrl = process.env['DATABASE_OWNER_URL'];
if (!ownerUrl) {
  console.error('DATABASE_OWNER_URL is not set');
  process.exit(1);
}
await runMigrations(ownerUrl);
console.log('migrations applied');
