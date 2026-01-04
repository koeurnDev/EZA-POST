const http = require('http');

const start = Date.now();

const req = http.get('http://localhost:5001/api/banners', (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
        const duration = Date.now() - start;
        console.log(`Status: ${res.statusCode}`);
        console.log(`Duration: ${duration}ms`);
        console.log(`Data size: ${data.length} bytes`);
    });
});

req.on('error', (e) => {
    console.error(`Problem with request: ${e.message}`);
});

req.end();
