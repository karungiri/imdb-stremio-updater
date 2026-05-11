#!/usr/bin/env node

const fs = require('fs');
const https = require('https');

const IMDB_LIST_ID = 'ls592973749';
const URL = `https://www.imdb.com/list/${IMDB_LIST_ID}/?sort=release_date,asc`;
const OUTPUT = 'list.json';

function fetchHtml(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9'
        }
      },
      (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`IMDb responded ${res.statusCode}`));
          res.resume();
          return;
        }
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => resolve(data));
      }
    );
    req.on('error', reject);
  });
}

(async () => {
  try {
    console.log('Fetching IMDb list page...');
    const html = await fetchHtml(URL);

    // Extract tt-IDs plus nearby titles in a very simple way
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
  } catch (err) {
    console.error('update-list.js failed:', err.message);
    process.exit(1);
  }
})();
