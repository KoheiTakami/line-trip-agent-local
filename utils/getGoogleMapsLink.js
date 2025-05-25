const fetch = require('node-fetch');

/**
 * スポット名からGoogle Mapsのピン留めリンク（Place ID方式）を生成
 * @param {string} spotName - スポット名や住所
 * @returns {Promise<string>} - Google Mapsのピン留めリンク
 */
async function getGoogleMapsLink(spotName) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) throw new Error('GOOGLE_MAPS_API_KEY is not set');
  // 東京・表参道周辺をデフォルトのバイアスにする
  const locationBias = 'point:35.665498,139.712891'; // 表参道駅付近
  // スポット名に地名を付加（例：La jolla → La jolla 表参道 東京）
  const query = `${spotName} 東京 表参道`;
  const url = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(query)}&inputtype=textquery&fields=place_id&key=${apiKey}&locationbias=${locationBias}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.status === 'OK' && data.candidates.length > 0) {
    const placeId = data.candidates[0].place_id;
    return `https://www.google.com/maps/place/?q=place_id:${placeId}`;
  }
  throw new Error('Place ID not found for: ' + spotName);
}

module.exports = getGoogleMapsLink; 