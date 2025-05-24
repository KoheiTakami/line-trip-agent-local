const fs = require('fs');
const getSheetData = require('../api/getSheetData');

getSheetData().then(data => {
  // 1行目はヘッダー想定
  const spots = data.slice(1).map(row => ({
    name: row[0],
    category: row[1],
    features: row[2],
    culturalBackground: row[3],
    accessInfo: row[4],
    googleMapsLink: row[5],
  }));
  fs.writeFileSync('spots.json', JSON.stringify(spots, null, 2), 'utf-8');
  console.log('スポットデータをspots.jsonに保存しました');
}); 