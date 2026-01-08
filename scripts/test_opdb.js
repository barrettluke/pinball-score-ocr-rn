const apiKey = 'DCwrX8lS0t9926NlKNUxqcCkSinfl7eEdVopx1KIv7npZGbZGu5CYGo14Exz';
async function test() {
    // 1. Search for "The Addams Family" to get ID
    const searchUrl = `https://opdb.org/api/search?q=The Addams Family&api_token=${apiKey}`;
    console.log('Searching:', searchUrl);
    const sResp = await fetch(searchUrl);
    const sData = await sResp.json();
    const taf = sData.find(m => m.name === 'The Addams Family');
    if (!taf) {
        console.log('TAF not found in search');
        // print first 5
        console.log('Top 5 results:', sData.slice(0, 5).map(m => m.name));
        return;
    }
    console.log('Found TAF:', taf.opdb_id, taf.name);

    // 2. Fetch Details
    const detailUrl = `https://opdb.org/api/machines/${taf.opdb_id}?api_token=${apiKey}`;
    console.log('Fetching Details:', detailUrl);
    const dResp = await fetch(detailUrl);
    const dData = await dResp.json();
    console.log('Shortname:', dData.shortname);
    console.log('Full Data:', JSON.stringify(dData, null, 2));
}
test();
