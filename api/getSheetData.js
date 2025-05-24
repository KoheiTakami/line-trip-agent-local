const { google } = require('googleapis');
const sheets = google.sheets('v4');
const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS),
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

async function getSheetData() {
  const client = await auth.getClient();
  const spreadsheetId = '1gDK7eaPZHtLFV_H7WYmXaCJjnhucmpfbETNEr6Pg2dE'; // 正しいスプレッドシートID
  const range = 'kanto_spots_with_affinity_tags!A1:G101'; // 正しいシート名に修正

  const res = await sheets.spreadsheets.values.get({
    auth: client,
    spreadsheetId,
    range,
  });

  return res.data.values;
}

// スプレッドシート内の全シート名を取得する関数
async function getSheetNames() {
  const client = await auth.getClient();
  const spreadsheetId = '1gDK7eaPZHtLFV_H7WYmXaCJjnhucmpfbETNEr6Pg2dE';
  const res = await sheets.spreadsheets.get({
    auth: client,
    spreadsheetId,
  });
  return res.data.sheets.map(sheet => sheet.properties.title);
}

module.exports = getSheetData;
module.exports.getSheetNames = getSheetNames; 