#!/usr/bin/env node
'use strict';

const https = require('https');
const fs = require('fs');
const path = require('path');

const IMDB_LIST_URL = 'https://www.imdb.com/list/ls592973749/?sort=release_date%2Casc';
const SOURCE = path.join(__dirname, 'source.json');
const OUTPUT = path.join(__dirname, 'list.json');

function fetchPage(url, redirects) {
  redirects = redirects || 0;
  if (redirects > 5) return Promise.reject(new Error('Too many redirects'));
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
        return fetchPage(res.headers.location, redirects + 1).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    }).on('error', reject);
  });
}

function loadSource() {
  try {
    if (fs.existsSync(SOURCE)) {
      const arr = JSON.parse(fs.readFileSync(SOURCE, 'utf8'));
      if (Array.isArray(arr)) return arr;
    }
  } catch (_) {}
  return [];
}

(async () => {
  const existing = loadSource();
  const existingIds = new Set(existing.map(e => e.imdb_id));
  console.log('Existing source.json has', existing.length, 'items');

  let fetchedItems = null;

  try {
    console.log('Attempting to fetch IMDb list:', IMDB_LIST_URL);
    const { status, body } = await fetchPage(IMDB_LIST_URL);
    console.log('HTTP status:', status);

    if (status === 200) {
      const match = body.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
      if (match) {
        const nextData = JSON.parse(match[1]);
        const edges = nextData?.props?.pageProps?.mainColumnData?.list?.titleListItemSearch?.edges;
        if (edges && Array.isArray(edges) && edges.length > 0) {
          fetchedItems = edges.map(e => ({
            imdb_id: e.listItem.id,
            title: e.listItem.titleText.text,
            type: e.listItem.titleType.id
          }));
          console.log('Successfully fetched', fetchedItems.length, 'items from IMDb');
        } else {
          console.warn('No edges found in __NEXT_DATA__');
        }
      } else {
        console.warn('__NEXT_DATA__ not found in page (status 200 but no data)');
      }
    } else {
      console.warn('IMDb returned status', status, '- falling back to source.json');
    }
  } catch (err) {
    console.warn('IMDb fetch failed:', err.message, '- falling back to source.json');
  }

  let finalItems;
  let sourceUpdated = false;

  if (fetchedItems && fetchedItems.length > 0) {
    // Merge: add any new items not already in source.json
    const newItems = fetchedItems.filter(i => !existingIds.has(i.imdb_id));
    if (newItems.length > 0) {
      console.log('Found', newItems.length, 'new items to add:', newItems.map(i => i.title).join(', '));
      // Use the full fetched list (preserves order and removes deleted items)
      finalItems = fetchedItems;
      fs.writeFileSync(SOURCE, JSON.stringify(finalItems, null, 2), 'utf8');
      console.log('Updated source.json with', finalItems.length, 'items');
      sourceUpdated = true;
    } else {
      console.log('No new items found. IMDb list unchanged.');
      finalItems = fetchedItems; // still use live data
    }
  } else {
    // Fallback to existing source.json
    console.log('Using existing source.json with', existing.length, 'items');
    finalItems = existing;
  }

  const payload = {
    generated_at: new Date().toISOString(),
    source_updated: sourceUpdated,
    items: finalItems
  };

  fs.writeFileSync(OUTPUT, JSON.stringify(payload, null, 2), 'utf8');
  console.log('Wrote', finalItems.length, 'items to', OUTPUT);
  finalItems.slice(0, 5).forEach(i => console.log(' -', i.imdb_id, i.title));

  // Signal to workflow whether source.json was updated
  process.exit(sourceUpdated ? 2 : 0);
})();
