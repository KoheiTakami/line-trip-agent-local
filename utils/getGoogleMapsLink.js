const fetch = require('node-fetch');

/**
 * スポット名からGoogle Mapsのピン留めリンクを生成
 * @param {string} spotName - スポット名や住所
 * @returns {Promise<string>} - Google Mapsのピン留めリンク
 */
async function getGoogleMapsLink(spotName) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) throw new Error('GOOGLE_MAPS_API_KEY is not set');
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(spotName)}&key=${apiKey}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.status === 'OK' && data.results.length > 0) {
    const location = data.results[0].geometry.location;
    return `https://www.google.com/maps/search/?api=1&query=${location.lat},${location.lng}`;
  }
  throw new Error('Geocoding failed for: ' + spotName);
}

module.exports = getGoogleMapsLink; 