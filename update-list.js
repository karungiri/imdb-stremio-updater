#!/usr/bin/env node

const fs = require('fs');
const { chromium } = require('playwright');

const IMDB_LIST_ID = 'ls592973749';
const URL = `https://www.imdb.com/list/${IMDB_LIST_ID}/?sort=release_date,asc`;
const OUTPUT = 'list.json';

function loadExisting() {
  try {
    if (fs.existsSync(OUTPUT)) {
      return JSON.parse(fs.readFileSync(OUTPUT, 'utf8'));
    }
  } catch (err) {
    console.error('Could not read existing list.json:', err.message);
  }
  return { generated_at: new Date().toISOString(), items: [] };
}

(async () => {
  let browser;
  try {
    console.log('Launching browser...');
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
    });

    console.log('Opening IMDb list...');
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(5000);

    const html = await page.content();

    const idRegex = /data-tconst="(tt\d+)"/g;
    const titleRegex = /<img[^>]+alt="([^"]+)"[^>]*data-tconst="(tt\d+)"/g;

    const titlesById = new Map();
    let m;

    while ((m = titleRegex.exec(html)) !== null) {
      const title = m[1];
      const imdbId = m[2];
      titlesById.set(imdbId, title);
    }

    const ids = new Set();
    let idMatch;
    while ((idMatch = idRegex.exec(html)) !== null) {
      ids.add(idMatch[1]);
    }

    const items = Array.from(ids).map((imdb_id) => ({
      imdb_id,
      title: titlesById.get(imdb_id) || imdb_id
    }));

    const payload = {
      generated_at: new Date().toISOString(),
      items
    };

    fs.writeFileSync(OUTPUT, JSON.stringify(payload, null, 2), 'utf8');
    console.log(`Wrote ${items.length} items to ${OUTPUT}`);

    if (items.length === 0) {
      console.warn('No IMDb items found; keeping file but output is empty');
    }
  } catch (err) {
    console.error('update-list.js failed:', err.message);
    const existing = loadExisting();
    fs.writeFileSync(OUTPUT, JSON.stringify(existing, null, 2), 'utf8');
    console.log(`Fallback wrote existing list with ${existing.items.length} items`);
    process.exit(0);
  } finally {
    if (browser) await browser.close();
  }
})();
