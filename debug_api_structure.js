const https = require('https');

async function fetchFirstPage() {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'app.matchplay.events',
            path: '/api/tournaments?status=upcoming&page=1',
            method: 'GET',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }
        };

        const req = https.request(options, res => {
            let data = '';
            res.on('data', d => data += d);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    const list = Array.isArray(json) ? json : (json.data || []);
                    resolve(list[0] || null);
                } catch (e) { resolve(null); }
            });
        });
        req.on('error', reject);
        req.end();
    });
}

(async () => {
    const item = await fetchFirstPage();
    if (item) {
        console.log("First Tournament Keys:", Object.keys(item));
        console.log("Full Object:", JSON.stringify(item, null, 2));
    } else {
        console.log("No items found.");
    }
})();
