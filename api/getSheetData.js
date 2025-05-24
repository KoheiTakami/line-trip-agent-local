const { google } = require('googleapis');
const sheets = google.sheets('v4');
const auth = new google.auth.GoogleAuth({
  keyFile: 'line-trip-agent-local-8bb1eaed63dc.json',
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

async function getSheetData() {
  const client = await auth.getClient();
  const spreadsheetId = '1934655963'; // スプレッドシートのID
  const range = 'kanto_spots_100!A1:Z100'; // シート名と範囲

  const res = await sheets.spreadsheets.values.get({
    auth: client,
    spreadsheetId,
    range,
  });

  return res.data.values;
}

module.exports = getSheetData; 