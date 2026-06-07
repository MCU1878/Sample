const http = require('http');

http.get('http://localhost:5173/', (res) => {
  console.log('Vite server responded with status:', res.statusCode);
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    console.log('HTML Length:', data.length);
    console.log('HTML snippet:', data.substring(0, 200));
  });
}).on('error', (err) => {
  console.error('Failed to connect to Vite server:', err);
});
