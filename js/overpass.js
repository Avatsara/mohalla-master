/**
 * overpass.js
 * Fetches real Points of Interest from OpenStreetMap's Overpass API
 * within a given radius of user's location.
 */

const Overpass = (() => {

  const ENDPOINT = 'https://overpass-api.de/api/interpreter';
  const RADIUS_M = 1000; // 1 km

  // POI categories we want to challenge users with
  // Each entry: [OSM key, OSM value, friendly label, emoji]
  const CATEGORIES = [
    ['amenity', 'cafe',           'Café',          '☕'],
    ['amenity', 'restaurant',     'Restaurant',    '🍽️'],
    ['amenity', 'bank',           'Bank',          '🏦'],
    ['amenity', 'pharmacy',       'Pharmacy',      '💊'],
    ['amenity', 'school',         'School',        '🏫'],
    ['amenity', 'place_of_worship','Place of Worship','🛕'],
    ['amenity', 'hospital',       'Hospital',      '🏥'],
    ['amenity', 'post_office',    'Post Office',   '📮'],
    ['amenity', 'police',         'Police Station','🚔'],
    ['shop',    'supermarket',    'Supermarket',   '🛒'],
    ['shop',    'clothes',        'Clothing Store','👕'],
    ['shop',    'bakery',         'Bakery',        '🥖'],
    ['shop',    'hardware',       'Hardware Store','🔧'],
    ['leisure', 'park',           'Park',          '🌳'],
    ['leisure', 'playground',     'Playground',    '🛝'],
    ['tourism', 'hotel',          'Hotel',         '🏨'],
    ['tourism', 'museum',         'Museum',        '🏛️'],
    ['historic','monument',       'Monument',      '🗿'],
    ['historic','temple',         'Temple',        '🛕'],
  ];

  /**
   * Build and execute an Overpass query for a single category.
   */
  async function fetchCategory(lat, lon, key, value) {
    const query = `
      [out:json][timeout:10];
      (
        node["${key}"="${value}"](around:${RADIUS_M},${lat},${lon});
        way["${key}"="${value}"](around:${RADIUS_M},${lat},${lon});
      );
      out center qt 30;
    `;
    const resp = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`
    });
    if (!resp.ok) throw new Error('Overpass request failed');
    return resp.json();
  }

  /**
   * Main function: fetch a batch of random POIs near the given coordinates.
   * Tries multiple categories until it has enough results.
   */
  async function getNearbyPOIs(lat, lon, minCount = 8) {
    // Shuffle categories so different ones get tried each game
    const shuffled = [...CATEGORIES].sort(() => Math.random() - 0.5);

    const results = [];
    const seen = new Set();

    for (const [key, value, label, emoji] of shuffled) {
      if (results.length >= minCount) break;

      try {
        const data = await fetchCategory(lat, lon, key, value);
        for (const el of data.elements) {
          const elLat = el.lat ?? el.center?.lat;
          const elLon = el.lon ?? el.center?.lon;
          if (!elLat || !elLon) continue;

          const name = el.tags?.name || el.tags?.['name:en'];
          if (!name) continue; // skip unnamed POIs

          const id = `${elLat.toFixed(5)},${elLon.toFixed(5)}`;
          if (seen.has(id)) continue;
          seen.add(id);

          results.push({
            id: el.id,
            name,
            lat: elLat,
            lon: elLon,
            type: label,
            emoji,
            address: buildAddress(el.tags),
            hint: buildHint(el.tags),
            tags: el.tags,
          });
        }
      } catch (e) {
        console.warn(`Overpass: failed for ${key}=${value}`, e);
      }
    }

    return results;
  }

  function buildAddress(tags) {
    if (!tags) return '';
    const parts = [];
    if (tags['addr:housenumber']) parts.push(tags['addr:housenumber']);
    if (tags['addr:street'])      parts.push(tags['addr:street']);
    if (tags['addr:locality'] || tags['addr:city']) {
      parts.push(tags['addr:locality'] || tags['addr:city']);
    }
    return parts.join(', ');
  }

  function buildHint(tags) {
    if (!tags) return '';

    const locality = firstTag(tags, [
      'addr:suburb',
      'addr:neighbourhood',
      'addr:quarter',
      'addr:city_district',
      'addr:locality',
      'is_in:suburb',
      'addr:city',
      'addr:state',
    ]);

    const road = firstTag(tags, [
      'addr:street',
      'addr:road',
    ]);

    if (locality && road && locality.toLowerCase() !== road.toLowerCase()) {
      return `Near ${road}, ${locality}`;
    }
    if (locality) return `In ${locality}`;
    if (road) return `Near ${road}`;
    return '';
  }

  function firstTag(tags, keys) {
    for (const key of keys) {
      const val = tags[key];
      if (typeof val === 'string' && val.trim()) return val.trim();
    }
    return '';
  }

  /**
   * Fallback: if Overpass returns nothing, use hard-coded POIs
   * derived from the user's approximate area (city-level only).
   * This prevents a blank game in areas with sparse OSM data.
   */
  function generateFallbackPOIs(lat, lon) {
    // Scatter fake POIs in a ~500m radius so the game is still playable
    const names = [
      'Main Market', 'Central Park', 'Old Post Office',
      'Railway Crossing', 'Community Hall', 'Water Tower',
      'Primary School', 'Bus Depot'
    ];
    return names.map((name, i) => {
      const angle = (i / names.length) * 2 * Math.PI;
      const dist  = 150 + Math.random() * 600; // 150–750m
      const dLat  = (dist / 111320) * Math.cos(angle);
      const dLon  = (dist / (111320 * Math.cos(lat * Math.PI / 180))) * Math.sin(angle);
      return {
        id: i,
        name,
        lat: lat + dLat,
        lon: lon + dLon,
        type: 'Landmark',
        emoji: '📍',
        address: 'Your neighbourhood',
        hint: 'In your local area',
        isFallback: true,
      };
    });
  }

  return { getNearbyPOIs, generateFallbackPOIs };
})();
