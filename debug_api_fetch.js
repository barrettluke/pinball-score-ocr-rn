const https = require('https');

async function fetchPage(page) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'app.matchplay.events',
            path: `/api/tournaments?status=completed&page=${page}`,
            method: 'GET',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }
        };

        const req = https.request(options, res => {
            let data = '';
            res.on('data', d => data += d);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    resolve(Array.isArray(json) ? json : (json.data || []));
                } catch (e) { resolve([]); }
            });
        });
        req.on('error', reject);
        req.end();
    });
}

(async () => {
    let count = 0;
    console.log("Scanning first 10 pages for 'UT' or 'Utah'...");
    for (let p = 1; p <= 10; p++) {
        const items = await fetchPage(p);
        console.log(`Page ${p}: ${items.length} items.`);
        for (const t of items) {
            const addr = t.location ? (t.location.address || '') : '';
            const name = t.name || '';
            const combined = (addr + ' ' + name).toUpperCase();
            if (combined.includes(' UT ') || combined.includes(', UT') || combined.includes('UTAH')) {
                console.log(`FOUND MATCH on Page ${p}: ${t.name} - ${addr}`);
                count++;
            }
        }
    }
    console.log(`Total Utah events found in 10 pages: ${count}`);
})();
