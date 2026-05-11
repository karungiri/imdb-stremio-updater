#!/usr/bin/env node
'use strict';

const https = require('https');
const fs = require('fs');
const path = require('path');

const IMDB_LIST_URL = 'https://www.imdb.com/list/ls592973749/?sort=release_date%2Casc';
const OUTPUT = path.join(__dirname, 'list.json');

function fetchPage(url) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'identity'
      }
    };
    https.get(url, options, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchPage(res.headers.location).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    }).on('error', reject);
  });
}

function loadExisting() {
  try {
    if (fs.existsSync(OUTPUT)) return JSON.parse(fs.readFileSync(OUTPUT, 'utf8'));
  } catch (_) {}
  return { generated_at: new Date().toISOString(), items: [] };
}

(async () => {
  console.log('Fetching IMDb list:', IMDB_LIST_URL);
  const { status, body } = await fetchPage(IMDB_LIST_URL);
  console.log('HTTP status:', status);

  const match = body.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!match) {
    console.error('Could not find __NEXT_DATA__ - IMDb may have blocked the request.');
    const existing = loadExisting();
    fs.writeFileSync(OUTPUT, JSON.stringify(existing, null, 2), 'utf8');
    console.log('Kept existing list with', existing.items.length, 'items.');
    process.exit(0);
  }

  const nextData = JSON.parse(match[1]);
  const edges = nextData?.props?.pageProps?.mainColumnData?.list?.titleListItemSearch?.edges;

  if (!edges || !Array.isArray(edges) || edges.length === 0) {
    console.error('No edges in __NEXT_DATA__ - structure may have changed.');
    const existing = loadExisting();
    fs.writeFileSync(OUTPUT, JSON.stringify(existing, null, 2), 'utf8');
    console.log('Kept existing list with', existing.items.length, 'items.');
    process.exit(0);
  }

  const items = edges.map(e => ({
    imdb_id: e.listItem.id,
    title: e.listItem.titleText.text,
    type: e.listItem.titleType.id
  }));

  const payload = { generated_at: new Date().toISOString(), items };
  fs.writeFileSync(OUTPUT, JSON.stringify(payload, null, 2), 'utf8');
  console.log('Wrote', items.length, 'items to', OUTPUT);
  items.slice(0, 5).forEach(i => console.log(' -', i.imdb_id, i.title));
})();
