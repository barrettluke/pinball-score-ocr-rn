/**
 * Generate AI Rules Summaries for Top Tournament Pinball Machines
 * Uses Gemini 3 Flash Preview to generate structured rules summaries
 * 
 * Usage: npx ts-node scripts/generate-rules.ts
 * 
 * Required env vars:
 *   - GEMINI_API_KEY
 *   - EXPO_PUBLIC_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 */

const { createClient } = require('@supabase/supabase-js');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config({ path: '.env.local' });

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY || !GEMINI_API_KEY) {
    console.error('Missing required environment variables:');
    console.error('  - EXPO_PUBLIC_SUPABASE_URL');
    console.error('  - SUPABASE_SERVICE_ROLE_KEY');
    console.error('  - GEMINI_API_KEY');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// Top tournament machines (can expand this list)
// These are commonly seen at IFPA-sanctioned events
const TOP_TOURNAMENT_MACHINES = [
    // Modern Stern
    'Godzilla', 'James Bond 007', 'Foo Fighters', 'Rush', 'Jurassic Park',
    'Led Zeppelin', 'Avengers: Infinity Quest', 'Teenage Mutant Ninja Turtles',
    'Star Wars', 'Deadpool', 'Batman 66', 'Iron Maiden', 'Guardians of the Galaxy',
    'Aerosmith', 'Metallica', 'The Walking Dead', 'Game of Thrones', 'Ghostbusters',
    'Spider-Man', 'X-Men', 'The Munsters', 'Stranger Things', "Venom",

    // Jersey Jack
    'The Godfather', 'Guns N\' Roses', 'Toy Story 4', 'Willy Wonka',
    'Pirates of the Caribbean', 'The Hobbit', 'Dialed In!', 'Wizard of Oz',

    // Spooky
    'Ultraman', 'Total Nuclear Annihilation', 'Rick and Morty', 'Scooby-Doo',

    // Classic Bally/Williams
    'The Addams Family', 'Twilight Zone', 'Theatre of Magic', 'Medieval Madness',
    'Attack from Mars', 'Monster Bash', 'Cirqus Voltaire', 'Tales of the Arabian Nights',
    'Indiana Jones', 'The Shadow', 'Creature from the Black Lagoon', 'Scared Stiff',
    'No Good Gofers', 'Party Zone', 'Fish Tales', 'White Water', 'Funhouse',
    'Hurricane', 'The Getaway', 'Terminator 2', 'Star Trek: The Next Generation',
    'Bram Stoker\'s Dracula', 'World Cup Soccer', 'The Champion Pub', 'Junkyard',
    'Revenge from Mars', 'Cactus Canyon', 'Roadshow', 'Congo', 'Dirty Harry',
    'Doctor Who', 'Demolition Man', 'Judge Dredd', 'Johnny Mnemonic', 'Safecracker',
    'NBA Fastbreak', 'No Fear', 'WHO dunnit', 'Jack*Bot', 'Corvette',

    // Classic Data East / Sega
    'Jurassic Park', 'Last Action Hero', 'Tales from the Crypt', 'Guns N\' Roses',
    'The Simpsons Pinball Party', 'South Park', 'Austin Powers', 'Goldeneye',
    'Starship Troopers', 'X-Files', 'Twister', 'Apollo 13', 'Independence Day',
    'Godzilla', 'Star Wars Episode I', 'The Lord of the Rings',

    // Premier / Gottlieb
    'Bone Busters', 'Tee\'d Off', 'Class of 1812', 'Stargate',

    // Chicago Gaming
    'Medieval Madness Remake', 'Attack from Mars Remake', 'Cactus Canyon Remake',
    'Monster Bash Remake', 'Tales of the Arabian Nights Remake',

    // American Pinball
    'Oktoberfest', 'Houdini', 'Hot Wheels', 'Legends of Valhalla', "Galactic Tank Force",

    // Classic EM/SS (Popular in mixed-era tournaments)
    'Eight Ball Deluxe', 'Black Knight', 'Fireball', 'Firepower', 'Gorgar',
    'Haunted House', 'Space Invaders', 'Xenon', 'Flash Gordon', 'Centaur',
    'Solar Fire', 'Embryon', 'Paragon', 'Pharaoh', 'Fathom', 'Elektra',
    'Time Fantasy', 'Comet', 'Cyclone', 'Big Guns', 'Elvira and the Party Monsters',
    'Whirlwind', 'Mousin\' Around!', 'Earthshaker', 'Taxi', 'Diner', 'Dr. Dude',
    'Bride of Pinbot', 'The Machine: Bride of Pinbot', 'Black Rose', 'Gilligan\'s Island',

    // More modern tournament favorites
    'Ghostbusters', 'Batman', 'Tron', 'AC/DC', 'KISS', 'Transformers',
    'Mustang', 'The Avengers', 'Captain America', 'Thor', 'Wolverine',
    'Wheel of Fortune', 'Family Guy', 'American Dad', '24', 'CSI',
    'Shrek', 'Pirates', 'NBA', 'NFL', 'Lord of the Rings', 'The Sopranos',
    'Elvis', 'Playboy', 'Harley-Davidson', 'Grand Prix', 'World Poker Tour',

    // Latest releases
    'Venom', 'Jaws', 'The Mandalorian', 'Elton John', 'John Wick', 'Godzilla Ultima'
];

interface RulesSummary {
    summary: string;
    key_shots: string[];
    modes: string[];
    scoring_tips: string;
}

async function generateRulesSummary(machineName: string, retries = 3): Promise<RulesSummary | null> {
    const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });

    const prompt = `You are a pinball rules expert. Generate a concise tournament strategy summary for the pinball machine "${machineName}".

Format your response as JSON with these exact fields:
{
  "summary": "2-3 sentence overview of the game's main objective and flow",
  "key_shots": ["Shot 1", "Shot 2", "Shot 3", "Shot 4", "Shot 5"],
  "modes": ["Mode/Multiball 1", "Mode/Multiball 2", "Mode/Multiball 3"],
  "scoring_tips": "1-2 sentences on where the biggest points are and tournament strategy"
}

Focus on:
- Main wizard mode path
- High-value multiballs
- Key skillshots
- Tournament-specific strategies (safe plays vs. risky plays)

If you don't have detailed knowledge of this specific machine, provide general guidance based on common pinball strategies.

RESPOND ONLY WITH VALID JSON, no markdown or explanation.`;

    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            const result = await model.generateContent(prompt);
            const text = result.response.text().trim();

            // Parse JSON response
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                console.error(`  Failed to parse JSON for ${machineName}`);
                return null;
            }

            const parsed = JSON.parse(jsonMatch[0]) as RulesSummary;
            return parsed;
        } catch (error: any) {
            // Handle rate limiting
            if (error?.status === 429 && attempt < retries - 1) {
                const waitTime = 35; // Wait 35 seconds on rate limit
                process.stdout.write(` (rate limited, waiting ${waitTime}s...)`);
                await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
                continue;
            }
            console.error(`  Error generating summary for ${machineName}:`, error);
            return null;
        }
    }
    return null;
}

async function main() {
    console.log('🎯 AI Rules Summary Generator (ALL MACHINES)');
    console.log('=============================================\n');

    // Get ALL machines from Supabase (paginate because default limit is 1000)
    let allMachines: any[] = [];
    let page = 0;
    const pageSize = 1000;

    while (true) {
        const { data, error } = await supabase
            .from('opdb_machines')
            .select('opdb_id, name')
            .order('name')
            .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) {
            console.error('Failed to fetch machines:', error);
            return;
        }

        if (!data || data.length === 0) break;

        allMachines = [...allMachines, ...data];
        console.log(`Fetched ${allMachines.length} machines so far...`);

        if (data.length < pageSize) break; // Last page
        page++;
    }

    console.log(`\nFound ${allMachines.length} total machines to process\n`);

    let successCount = 0;
    let skipCount = 0;

    for (let i = 0; i < allMachines.length; i++) {
        const machine = allMachines[i];
        process.stdout.write(`[${i + 1}/${allMachines.length}] ${machine.name}...`);

        // Check if we already have rules for this machine
        const { data: existing } = await supabase
            .from('machine_rules')
            .select('opdb_id')
            .eq('opdb_id', machine.opdb_id)
            .single();

        if (existing) {
            console.log(' (skipped, already exists)');
            skipCount++;
            continue;
        }

        // Generate summary
        const summary = await generateRulesSummary(machine.name);

        if (!summary) {
            console.log(' (failed)');
            continue;
        }

        // Insert into Supabase
        const { error: insertError } = await supabase
            .from('machine_rules')
            .upsert({
                opdb_id: machine.opdb_id,
                summary: summary.summary,
                key_shots: summary.key_shots,
                modes: summary.modes,
                scoring_tips: summary.scoring_tips,
                updated_at: new Date().toISOString()
            });

        if (insertError) {
            console.log(` (insert failed: ${insertError.message})`);
        } else {
            console.log(' ✓');
            successCount++;
        }

        // Rate limiting - paid tier has much higher limits, 1 second is plenty
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('\n============================');
    console.log(`✅ Generated: ${successCount}`);
    console.log(`⏭️  Skipped: ${skipCount}`);
    console.log(`❌ Failed: ${allMachines.length - successCount - skipCount}`);
}

main();
