#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const SOURCE = path.join(__dirname, 'source.json');
const OUTPUT = path.join(__dirname, 'list.json');

try {
  if (!fs.existsSync(SOURCE)) {
    console.error('source.json not found!');
    process.exit(1);
  }

  const source = JSON.parse(fs.readFileSync(SOURCE, 'utf8'));

  if (!Array.isArray(source)) {
    console.error('source.json must be a JSON array.');
    process.exit(1);
  }

  const items = source.map(entry => ({
    imdb_id: entry.imdb_id,
    title: entry.title || entry.imdb_id,
    type: entry.type || 'movie'
  }));

  const payload = {
    generated_at: new Date().toISOString(),
    items
  };

  fs.writeFileSync(OUTPUT, JSON.stringify(payload, null, 2), 'utf8');
  console.log('Wrote', items.length, 'items to', OUTPUT);
  items.slice(0, 5).forEach(i => console.log(' -', i.imdb_id, i.title));
} catch (err) {
  console.error('update-list.js failed:', err.message);
  process.exit(1);
}
