const https = require('https');
const fs = require('fs');
const path = require('path');

const url = 'https://raw.githubusercontent.com/murilofarias10/world-cup-2026/main/fifa-world-cup-2026-UTC.csv';
// バックアップURL（もしmainでなくmasterだった場合）
const urlBackup = 'https://raw.githubusercontent.com/murilofarias10/world-cup-2026/master/fifa-world-cup-2026-UTC.csv';

const download = (targetUrl) => {
  https.get(targetUrl, (res) => {
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    res.on('end', () => {
      console.log('Download status:', res.statusCode);
      if (res.statusCode === 200) {
        fs.writeFileSync(path.join(__dirname, 'schedule.csv'), data);
        console.log('Saved to schedule.csv');
      } else if (res.statusCode === 404 && targetUrl === url) {
        console.log('Main branch failed, trying master...');
        download(urlBackup);
      } else {
        console.log('Failed. Status:', res.statusCode);
      }
    });
  }).on('error', (err) => {
    console.error('Error:', err);
  });
};

download(url);
