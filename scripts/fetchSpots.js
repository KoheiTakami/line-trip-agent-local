const getSheetData = require('../api/getSheetData');
const fs = require('fs').promises;
const path = require('path');

async function fetchAndSaveSpots() {
  try {
    // データを取得
    const data = await getSheetData();
    
    // ヘッダー行を取得
    const headers = data[0];
    
    // データ行をオブジェクトの配列に変換
    const spots = data.slice(1).map(row => {
      const spot = {};
      headers.forEach((header, index) => {
        spot[header] = row[index] || '';
      });
      return spot;
    });

    // JSONファイルとして保存
    const outputPath = path.join(__dirname, '../data/spots.json');
    await fs.writeFile(outputPath, JSON.stringify(spots, null, 2), 'utf8');
    
    console.log('スポットデータを正常に保存しました:', outputPath);
  } catch (error) {
    console.error('エラーが発生しました:', error);
  }
}

fetchAndSaveSpots(); 