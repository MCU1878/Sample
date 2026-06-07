const https = require('https');
const fs = require('fs');
const path = require('path');

const url = 'https://en.wikipedia.org/wiki/2026_FIFA_World_Cup_group_stage';

const options = {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  }
};

https.get(url, options, (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    console.log('Downloaded Wikipedia HTML successfully. Status:', res.statusCode);
    if (res.statusCode === 200) {
      fs.writeFileSync(path.join(__dirname, 'group_stage.html'), data);
      console.log('Saved to group_stage.html');
    } else {
      console.log('Failed to download. Body length:', data.length);
    }
  });
}).on('error', (err) => {
  console.error('Error fetching URL:', err);
});
