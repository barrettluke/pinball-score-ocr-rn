
// using native fetch

const API_KEY = 'DCwrX8lS0t9926NlKNUxqcCkSinfl7eEdVopx1KIv7npZGbZGu5CYGo14Exz';
const OPDB_BASE_URL = 'https://opdb.org/api';

async function run() {
    const url = `${OPDB_BASE_URL}/export?api_token=${API_KEY}`;
    console.log(`FETCHING Export Header...`);
    try {
        const res = await fetch(url);
        // Stream reading to just get start
        const reader = res.body?.getReader();
        if (reader) {
            const { value } = await reader.read();
            const chunk = new TextDecoder().decode(value);
            console.log(chunk.substring(0, 1000));
            reader.cancel();
        } else {
            // Fallback if no stream (Node 18 native fetch might not support getReader on all streams easily without plumbing)
            // Using simple text() might download whole thing. 
            // Node fetch response.body is a ReadableStream?
            // Let's just try to read a buffer.
            const buff = await res.arrayBuffer();
            const txt = new TextDecoder().decode(buff.slice(0, 1000));
            console.log(txt);
        }
    } catch (e) {
        console.error('Fetch error:', e);
    }
}

run();
