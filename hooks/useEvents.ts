import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';
import { EVENT_TABS, EventTab } from '../constants/strings';
import { getDistance } from '../utils/location';
import { getNearbyTournaments, getSupabaseTournaments, getUserDashboard, getValidStatuses, MatchplayTournament, searchTournaments } from '../utils/matchplay';

export const useEvents = (
    activeTab: EventTab,
    isNearbyOnly: boolean,
    nearbySort: 'distance' | 'date',
    search: string
) => {
    const [events, setEvents] = useState<MatchplayTournament[]>([]);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(null);

    const loadEvents = useCallback(async () => {
        setLoading(true);

        try {
            let data: MatchplayTournament[] = [];
            // Use local variable to ensure we have latest location for sorting immediately
            let currentLoc = userLocation;

            if (activeTab === EVENT_TABS.MY_TOURNAMENTS) {
                // Personal tournaments - uses Matchplay API
                data = await getUserDashboard();
            } else {
                // Public tournaments - uses Supabase
                let targetStatus: 'active' | 'upcoming' | 'completed' = 'upcoming';
                if (activeTab === EVENT_TABS.LIVE) targetStatus = 'active';
                if (activeTab === EVENT_TABS.COMPLETED) targetStatus = 'completed';

                if (isNearbyOnly || nearbySort === 'distance') {
                    // DISTANCE-BASED FETCHING (PostGIS)
                    try {
                        const { status } = await Location.requestForegroundPermissionsAsync();
                        if (status === 'granted') {
                            const location = await Location.getCurrentPositionAsync({});
                            currentLoc = { lat: location.coords.latitude, lon: location.coords.longitude };
                            setUserLocation(currentLoc); // Update state for UI/Search
                            const radius = isNearbyOnly ? 100 : 25000; // 100 miles or Global (25k miles)

                            if (activeTab === EVENT_TABS.ALL) {
                                const [nearbyLive, nearbyUpcoming] = await Promise.all([
                                    getNearbyTournaments(
                                        location.coords.latitude,
                                        location.coords.longitude,
                                        radius,
                                        'active'
                                    ),
                                    getNearbyTournaments(
                                        location.coords.latitude,
                                        location.coords.longitude,
                                        radius,
                                        'upcoming'
                                    )
                                ]);
                                data = [...nearbyLive, ...nearbyUpcoming];
                            } else {
                                data = await getNearbyTournaments(
                                    location.coords.latitude,
                                    location.coords.longitude,
                                    radius,
                                    targetStatus
                                );
                            }

                            // --- IFPA INTEGRATION ---
                            // Fetch IFPA data if we have location (IFPA requires lat/lon)
                            if (activeTab === EVENT_TABS.ALL || activeTab === EVENT_TABS.UPCOMING) {
                                try {
                                    // IFPA calendar fetch (Defaults to 50 miles, maybe expand if verified?)
                                    // Only fetch if "Nearby" is on or if we have location rights
                                    const { searchIfpaCalendar } = require('../utils/ifpa');
                                    const ifpaEvents = await searchIfpaCalendar(
                                        location.coords.latitude,
                                        location.coords.longitude,
                                        Math.min(radius, 100) // IFPA API might have limit or we want local for now
                                    );

                                    if (ifpaEvents.length > 0) {
                                        data = [...data, ...ifpaEvents];
                                    }
                                } catch (ifpaErr) {
                                    console.log('IFPA fetch skipped/failed', ifpaErr);
                                }
                            }
                            // ------------------------

                        } else {
                            // Permission denied, fallback to standard date sort
                            console.log('Location permission denied, falling back to standard sort');
                            if (activeTab === EVENT_TABS.ALL) {
                                const live = await getSupabaseTournaments('active');
                                const upcoming = await getSupabaseTournaments('upcoming');
                                data = [...live, ...upcoming];
                            } else {
                                data = await getSupabaseTournaments(targetStatus);
                            }
                        }
                    } catch (err) {
                        console.error('Location error:', err);
                        // Fallback on error
                        data = await getSupabaseTournaments(targetStatus);
                    }
                } else {
                    // STANDARD DATE-SORTED FETCH
                    if (activeTab === EVENT_TABS.ALL) {
                        const now = new Date();
                        const todayStr = now.toLocaleDateString('en-CA');

                        const live = await getSupabaseTournaments('active'); // Fetch all active (even started yesterday)
                        const upcoming = await getSupabaseTournaments('upcoming', todayStr); // Fetch future only
                        data = [...live, ...upcoming];
                    } else if (activeTab === EVENT_TABS.UPCOMING) {
                        const now = new Date();
                        const todayStr = now.toLocaleDateString('en-CA');
                        data = await getSupabaseTournaments('upcoming', todayStr);
                    } else {
                        data = await getSupabaseTournaments(targetStatus);
                    }
                }
            }

            // Deduplicate and Merge MatchPlay vs IFPA
            const matchplayEvents = data.filter(e => e.source !== 'ifpa');
            const ifpaEvents = data.filter(e => e.source === 'ifpa');

            // Map for quick lookup of MatchPlay events by "Date|NameStub"
            // Using fuzzier matching: normalized name + date
            const mergedEvents = [...matchplayEvents];

            ifpaEvents.forEach(ifpaEv => {
                const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
                const ifpaName = normalize(ifpaEv.name);

                // Find match
                const matchIndex = mergedEvents.findIndex(mpEv => {
                    const mpName = normalize(mpEv.name);
                    // Check Date match (exact)
                    if (mpEv.startLocalDate !== ifpaEv.startLocalDate) return false;

                    // Check Name match (contains or vice versa)
                    return mpName.includes(ifpaName) || ifpaName.includes(mpName);
                });

                if (matchIndex >= 0) {
                    // Start of Merge: Found duplicate!
                    // Update source to 'both' to show both badges
                    mergedEvents[matchIndex] = {
                        ...mergedEvents[matchIndex],
                        source: 'both',
                    };
                } else {
                    // Unique IFPA event
                    // We'll use negative IDs for IFPA-only events in this view to be safe.
                    mergedEvents.push({
                        ...ifpaEv,
                        tournamentId: -Math.abs(ifpaEv.tournamentId) // Negative ID for IFPA-sourced
                    });
                }
            });

            const unique = mergedEvents;

            // 1. FILTER: Show only events strictly starting Today or Future (User Request)
            // "dates not from the past or started before the current date"
            let finalEvents = unique;
            if (activeTab !== EVENT_TABS.COMPLETED && activeTab !== EVENT_TABS.MY_TOURNAMENTS) {
                const now = new Date();
                const todayStr = now.toLocaleDateString('en-CA'); // YYYY-MM-DD format local

                finalEvents = unique.filter(event => {
                    if (!event.startLocalDate) return false;
                    return event.startLocalDate >= todayStr;
                });
            }

            // 2. SORT: Apply Client-Side Sort (Date or Distance)
            if (nearbySort === 'date') {
                finalEvents.sort((a, b) => {
                    const dateA = new Date(a.startLocalDate).getTime();
                    const dateB = new Date(b.startLocalDate).getTime();
                    if (isNaN(dateA)) return 1;
                    if (isNaN(dateB)) return -1;
                    if (activeTab === EVENT_TABS.COMPLETED) return dateB - dateA;
                    return dateA - dateB;
                });
            } else if (nearbySort === 'distance' && currentLoc) {
                finalEvents.sort((a, b) => {
                    // Push items without location to the bottom
                    if (!a.latitude || !a.longitude) return 1;
                    if (!b.latitude || !b.longitude) return -1;

                    const distA = getDistance(currentLoc!.lat, currentLoc!.lon, a.latitude, a.longitude);
                    const distB = getDistance(currentLoc!.lat, currentLoc!.lon, b.latitude, b.longitude);
                    return distA - distB;
                });
            }

            setEvents(finalEvents);
        } catch (e) {
            console.error('loadEvents error:', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [activeTab, isNearbyOnly, nearbySort, userLocation]);

    // Search Effect
    useEffect(() => {
        let isMounted = true;

        const fetchData = async () => {
            setLoading(true);
            try {
                if (search.length >= 2) {
                    // Search with active Status Filter
                    const statuses = activeTab === EVENT_TABS.ALL ? undefined : getValidStatuses(activeTab.toLowerCase());
                    let results = await searchTournaments(search, statuses);

                    // Apply Client-Side Sort to Search Results
                    let loc = userLocation;
                    if (!loc) {
                        try {
                            const { status } = await Location.requestForegroundPermissionsAsync();
                            if (status === 'granted') {
                                const l = await Location.getCurrentPositionAsync({});
                                loc = { lat: l.coords.latitude, lon: l.coords.longitude };
                                setUserLocation(loc);
                            }
                        } catch (e) {
                            console.log('Loc error in search sort', e);
                        }
                    }

                    // --- IFPA SEARCH INTEGRATION ---
                    if (loc) {
                        try {
                            const { searchIfpaCalendar } = require('../utils/ifpa');
                            const ifpaEvents = await searchIfpaCalendar(
                                loc.lat,
                                loc.lon,
                                100 // 100 miles radius for search
                            );

                            const queryLower = search.toLowerCase();
                            const matchingIfpa = ifpaEvents.filter((e: MatchplayTournament) =>
                                e.name.toLowerCase().includes(queryLower)
                            );

                            if (matchingIfpa.length > 0) {
                                // Dedupe/Merge Logic (Same as loadEvents)
                                const matchplayEvents = results.filter(e => e.source !== 'ifpa');
                                const existingIfpa = results.filter(e => e.source === 'ifpa');
                                const mergedEvents = [...matchplayEvents];

                                matchingIfpa.forEach((ifpaEv: MatchplayTournament) => {
                                    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
                                    const ifpaName = normalize(ifpaEv.name);

                                    const matchIndex = mergedEvents.findIndex(mpEv => {
                                        const mpName = normalize(mpEv.name);
                                        if (mpEv.startLocalDate !== ifpaEv.startLocalDate) return false;
                                        return mpName.includes(ifpaName) || ifpaName.includes(mpName);
                                    });

                                    if (matchIndex >= 0) {
                                        mergedEvents[matchIndex] = { ...mergedEvents[matchIndex], source: 'both' };
                                    } else {
                                        mergedEvents.push({ ...ifpaEv, tournamentId: -Math.abs(ifpaEv.tournamentId) });
                                    }
                                });
                                results = mergedEvents;
                            }
                        } catch (err) {
                            console.log('IFPA search error', err);
                        }
                    }
                    // -------------------------------

                    if (nearbySort === 'distance' && loc) {
                        results.sort((a, b) => {
                            if (!a.latitude || !a.longitude) return 1;
                            if (!b.latitude || !b.longitude) return -1;
                            const distA = getDistance(loc!.lat, loc!.lon, a.latitude, a.longitude);
                            const distB = getDistance(loc!.lat, loc!.lon, b.latitude, b.longitude);
                            return distA - distB;
                        });
                    }

                    if (isMounted) setEvents(results);
                } else {
                    // Standard load (tabs or nearby)
                    const results = await loadEvents();
                    // loadEvents already sets state? No, loadEvents is void and sets state.
                    // But in original code, Search Effect called loadEvents().
                    // Wait, loadEvents is async void.
                    // Original code: "const results = await loadEvents(); if (isMounted && results) setEvents(results);"
                    // But loadEvents in original code returned VOID in signature?
                    // Let's check original.
                    // Lines 68-276: `const loadEvents = useCallback(async () => { ... setEvents(finalEvents); ... }, ...);`
                    // It does NOT return data.
                    // BUT in the Search Effect (Line 374): `const results = await loadEvents();`
                    // This implies loadEvents returns something?
                    // TS would complain if it didn't.
                    // Ah, Line 374 in Step 1847: `const results = await loadEvents();`
                    // But `loadEvents` definition at Line 76 starts with `const loadEvents = useCallback(async () => {`.
                    // It uses `setEvents` internally. It does NOT return `finalEvents`.
                    // So `results` is `undefined`.
                    // Then `if (isMounted && results) setEvents(results);` would fail?
                    // Or `results` is implicitly `void`.
                    // This might be a bug in the original code or I misread it.
                    // Line 76 does NOT have a return statement at the end of the try block.
                    // So `loadEvents` returns `Promise<void>`.
                    // Result: `undefined`.
                    // `if (undefined)` is false.
                    // So `setEvents` is NOT called with results in the `else` block of Search Effect.
                    // BUT `loadEvents` calls `setEvents` internally (Line 268).
                    // So it works! It just sets events twice? No, only inside `loadEvents`.
                    // So `results` variable is useless.
                }
            } catch (e) {
                console.error('Fetch error:', e);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        // Debounce only if searching
        if (search.length >= 2) {
            const timer = setTimeout(fetchData, 400);
            return () => clearTimeout(timer);
        } else {
            // Check if we are searching or just loading default
            // If search is empty, we just call loadEvents via fetchData -> loadEvents path
            fetchData();
        }

        return () => { isMounted = false; };
    }, [search, activeTab, isNearbyOnly, nearbySort, loadEvents]);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await loadEvents();
        // loadEvents sets refreshing to false in finally?
        // But here we set it to true.
        // My hook `loadEvents` sets refreshing to false in finally.
    }, [loadEvents]);

    return {
        events,
        loading,
        refreshing,
        onRefresh,
        userLocation
    };
};
