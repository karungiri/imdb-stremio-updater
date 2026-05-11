const { addonBuilder, serveHTTP } = require('stremio-addon-sdk');
const fs = require('fs');
const path = require('path');

const manifest = {
  id: 'org.imdblist.bollywood2026',
  version: '1.0.0',
  name: 'IMDb Bollywood Movies 2026',
  description: 'Top Bollywood Movies of 2026 from IMDb list',
  logo: 'https://ia.media-imdb.com/images/M/MV5BMTczNjM0NDY0Ml5BMl5BanBnXkFtZTgwMTk1MzQ2OTE@._V1_.png',
  resources: ['catalog'],
  types: ['movie'],
  catalogs: [
    {
      id: 'imdb-movie-list',
      type: 'movie',
      name: 'IMDb Movie List - Bollywood 2026'
    }
  ]
};

const builder = new addonBuilder(manifest);

function loadList() {
  try {
    const file = path.join(__dirname, 'list.json');
    const raw = fs.readFileSync(file, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed.items || !Array.isArray(parsed.items)) return [];
    return parsed.items;
  } catch {
    return [];
  }
}

builder.defineCatalogHandler(async ({ type, id }) => {
  if (id !== 'imdb-movie-list') return { metas: [] };

  const items = loadList();

  const metas = items.map((item) => {
    const imdbId = item.imdb_id || item.id;
    return {
      id: imdbId,
      imdb_id: imdbId,
      type: 'movie',
      name: item.title || item.name || imdbId,
      poster: `https://images.metahub.space/poster/medium/${imdbId}/img`,
      posterShape: 'poster'
    };
  });

  return { metas };
});

serveHTTP(builder.getInterface(), { port: 7516 });
console.log('Addon running on port 7516 (JSON-backed)');
