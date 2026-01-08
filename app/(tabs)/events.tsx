import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { FlashList } from '@shopify/flash-list';
import * as Calendar from 'expo-calendar';
import { Image } from 'expo-image';
import * as Location from 'expo-location';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, Linking, Platform, Pressable, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withRepeat, withSpring, withTiming } from 'react-native-reanimated';
import { formatTime12h } from '../../utils/formatters';
import { getNearbyTournaments, getSupabaseTournaments, getUserDashboard, getValidStatuses, MatchplayTournament, searchTournaments } from '../../utils/matchplay';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DRAWER_WIDTH = SCREEN_WIDTH * 0.85;

// Pulsing Live Dot component
const PulsingDot = () => {
    const opacity = useSharedValue(1);
    const scale = useSharedValue(1);

    useEffect(() => {
        opacity.value = withRepeat(withTiming(0.4, { duration: 800 }), -1, true);
        scale.value = withRepeat(withTiming(1.3, { duration: 800 }), -1, true);
    }, []);

    const animatedStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
        transform: [{ scale: scale.value }],
    }));

    return (
        <View style={{ position: 'relative', width: 8, height: 8, marginRight: 6 }}>
            {/* Glow layer */}
            <Animated.View style={[
                { position: 'absolute', width: 8, height: 8, borderRadius: 4, backgroundColor: '#e63946' },
                animatedStyle
            ]} />
            {/* Solid center */}
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#e63946' }} />
        </View>
    );
};

const THEME = {
    background: '#0d1b2a',
    card: '#1b263b',
    accent: '#00b4d8',
    text: '#e0e1dd',
    textSecondary: '#778da9',
    success: '#28a745',
    live: '#e63946', // Red for LIVE
    upcoming: '#457b9d', // Blueish for UPCOMING
};

// Haversine formula to calculate distance in miles
const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 3958.8; // Radius of Earth in miles
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};



// Expandable Event Card component
const EventCard = React.memo(({ item, isExpanded, onPress }: {
    item: MatchplayTournament;
    isExpanded: boolean;
    onPress: () => void;
}) => {
    const badgeColor = item.status === 'active' ? THEME.live :
        item.status === 'upcoming' ? THEME.upcoming : THEME.textSecondary;

    // Compute location string
    const locationDisplay = React.useMemo(() => {
        let city = (item.city || '').replace(/\d+/g, '').replace(/,?\s*(US|USA|UK)$/i, '').trim();
        let state = (item.stateProvince || '').replace(/\d+/g, '').trim();
        if (/^(US|USA|UK)$/i.test(state)) state = '';
        if (state.length > 2 && /^[A-Z]{2}/i.test(state)) state = state.substring(0, 2).toUpperCase();

        const cityState = [city, state].filter(Boolean).join(', ');
        const venue = item.locationName;
        const country = item.country && !/^(US|USA)$/i.test(item.country) ? item.country : '';

        let location = venue && cityState ? `${venue} • ${cityState}` : (cityState || venue || 'Location TBA');
        if (country) location += `, ${country}`;

        return location;
    }, [item.city, item.stateProvince, item.locationName, item.country]);

    // Compute date string
    const dateDisplay = React.useMemo(() => {
        const dateStr = item.startLocalDate && !isNaN(new Date(item.startLocalDate).getTime())
            ? new Date(item.startLocalDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
            : (item.startLocalDate || 'Date TBA');
        const timeStr = formatTime12h(item.startLocalTime);
        return timeStr ? `${dateStr} • ${timeStr}` : dateStr;
    }, [item.startLocalDate, item.startLocalTime]);

    // Full date for expanded view
    const fullDateDisplay = React.useMemo(() => {
        if (!item.startLocalDate || isNaN(new Date(item.startLocalDate).getTime())) return 'Date TBA';
        return new Date(item.startLocalDate).toLocaleDateString(undefined, {
            weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
        });
    }, [item.startLocalDate]);

    const openMatchplay = () => {
        const url = `https://app.matchplay.events/tournaments/${item.tournamentId}`;
        Linking.openURL(url);
    };

    const addToCalendar = async () => {
        try {
            const { status } = await Calendar.requestCalendarPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission required', 'Calendar access is needed to add this event.');
                return;
            }

            // Get default calendar
            let calendarId: string | null = null;
            if (Platform.OS === 'ios') {
                const defaultCalendar = await Calendar.getDefaultCalendarAsync();
                calendarId = defaultCalendar.id;
            } else {
                const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
                const primary = calendars.find(c => c.isPrimary);
                calendarId = primary ? primary.id : calendars[0]?.id;
            }

            if (!calendarId) {
                Alert.alert('Error', 'No calendar found on device.');
                return;
            }

            // Construct Date
            // startLocalDate comes as YYYY-MM-DD
            // startLocalTime comes as HH:mm:ss or similar
            let startDate = new Date(item.startLocalDate);
            if (item.startLocalTime) {
                // Combine date and time
                const [h, m] = item.startLocalTime.split(':');
                startDate.setHours(parseInt(h), parseInt(m));
            } else {
                startDate.setHours(9, 0); // Default 9 AM
            }

            // End date (default 4 hours duration)
            const endDate = new Date(startDate.getTime() + 4 * 60 * 60 * 1000);

            await Calendar.createEventAsync(calendarId, {
                title: item.name,
                startDate,
                endDate,
                timeZone: 'UTC', // Required for Android to avoid offset issues sometimes
                location: item.locationName ? `${item.locationName}, ${item.address || ''}` : item.address,
                notes: `View on Matchplay: https://app.matchplay.events/tournaments/${item.tournamentId}\n\n${item.description || ''}`
            });

            Alert.alert('Success', 'Event added to your calendar!');

        } catch (e) {
            console.error('Calendar error:', e);
            Alert.alert('Error', 'Could not add event to calendar.');
        }
    };

    return (
        <Pressable onPress={onPress}>
            <View style={[styles.card, isExpanded && styles.cardExpanded]}>
                {/* Collapsed View - Always Visible */}
                <View style={styles.cardCollapsed}>
                    {item.imageUrl ? (
                        <Image
                            source={{ uri: item.imageUrl }}
                            style={styles.cardImage}
                            contentFit="cover"
                            transition={200}
                            cachePolicy="memory-disk"
                        />
                    ) : (
                        <View style={[styles.cardImage, { justifyContent: 'center', alignItems: 'center' }]}>
                            <MaterialCommunityIcons name="trophy-outline" size={32} color={THEME.textSecondary} />
                        </View>
                    )}
                    <View style={styles.cardContent}>
                        <View style={styles.cardHeader}>
                            <Text style={styles.cardTitle} numberOfLines={isExpanded ? 2 : 1}>{item.name}</Text>
                            <View style={[styles.badge, { borderColor: badgeColor, backgroundColor: item.status === 'active' ? badgeColor : 'transparent' }]}>
                                <Text style={[styles.badgeText, { color: item.status === 'active' ? '#fff' : badgeColor }]}>{item.status.toUpperCase()}</Text>
                            </View>
                        </View>
                        <View style={styles.cardRow}>
                            <View style={{ flex: 1 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                                    <MaterialCommunityIcons name="map-marker" size={12} color={THEME.textSecondary} style={{ marginRight: 4 }} />
                                    <Text style={styles.cardDetails} numberOfLines={1}>{locationDisplay}</Text>
                                </View>
                                <Text style={styles.cardDetails}>{dateDisplay}</Text>
                            </View>
                            <MaterialCommunityIcons
                                name={isExpanded ? "chevron-up" : "chevron-down"}
                                size={20}
                                color={THEME.textSecondary}
                            />
                        </View>
                    </View>
                </View>

                {/* Expanded Details */}
                {isExpanded && (
                    <View style={styles.cardExpandedContent}>
                        <View style={styles.expandedDivider} />

                        {/* Full Date/Time */}
                        <View style={styles.expandedRow}>
                            <MaterialCommunityIcons name="calendar" size={16} color={THEME.accent} />
                            <Text style={styles.expandedLabel}>{fullDateDisplay}</Text>
                        </View>
                        {item.startLocalTime && (
                            <View style={styles.expandedRow}>
                                <MaterialCommunityIcons name="clock-outline" size={16} color={THEME.accent} />
                                <Text style={styles.expandedLabel}>{formatTime12h(item.startLocalTime)}</Text>
                            </View>
                        )}

                        {/* Full Address */}
                        {item.address && (
                            <View style={styles.expandedRow}>
                                <MaterialCommunityIcons name="directions" size={16} color={THEME.accent} />
                                <Text style={styles.expandedLabel}>{item.address}</Text>
                            </View>
                        )}

                        {/* Description */}
                        {item.description && (
                            <Text style={styles.expandedDescription} numberOfLines={4}>
                                {item.description}
                            </Text>
                        )}

                        {/* Actions */}
                        <View style={styles.expandedActions}>
                            <TouchableOpacity style={styles.actionButton} onPress={addToCalendar}>
                                <MaterialCommunityIcons name="calendar-plus" size={18} color={THEME.accent} />
                                <Text style={styles.actionText}>Add to Calendar</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.actionButton} onPress={openMatchplay}>
                                <MaterialCommunityIcons name="open-in-new" size={18} color={THEME.accent} />
                                <Text style={styles.actionText}>Matchplay</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
            </View>
        </Pressable>
    );
});

export default function EventsScreen() {
    const [activeTab, setActiveTab] = useState<'All' | 'Live' | 'Upcoming' | 'Completed' | 'My Tournaments'>('All');
    const [isNearbyOnly, setIsNearbyOnly] = useState(false);
    const [nearbySort, setNearbySort] = useState<'distance' | 'date'>('date');
    const [search, setSearch] = useState('');
    const [events, setEvents] = useState<MatchplayTournament[]>([]);
    const [refreshing, setRefreshing] = useState(false);
    const [loading, setLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [expandedId, setExpandedId] = useState<number | null>(null);
    const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(null);

    // Animation Values
    const drawerTranslateX = useSharedValue(DRAWER_WIDTH);
    const backdropOpacity = useSharedValue(0);

    const openDrawer = useCallback(() => {
        setIsDrawerOpen(true);
        // Faster, snappier spring
        drawerTranslateX.value = withSpring(0, { damping: 20, stiffness: 200, mass: 0.8 });
        backdropOpacity.value = withTiming(0.5, { duration: 200 });
    }, []);

    const closeDrawer = useCallback(() => {
        drawerTranslateX.value = withSpring(DRAWER_WIDTH, { damping: 20, stiffness: 200, mass: 0.8 }, (finished) => {
            if (finished) runOnJS(setIsDrawerOpen)(false);
        });
        backdropOpacity.value = withTiming(0, { duration: 200 });
    }, []);

    const drawerStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: drawerTranslateX.value }],
    }));

    const backdropStyle = useAnimatedStyle(() => ({
        opacity: backdropOpacity.value,
    }));

    const loadEvents = useCallback(async () => {
        setLoading(true);

        try {
            let data: MatchplayTournament[] = [];
            // Use local variable to ensure we have latest location for sorting immediately
            let currentLoc = userLocation;

            if (activeTab === 'My Tournaments') {
                // Personal tournaments - uses Matchplay API
                data = await getUserDashboard();
            } else {
                // Public tournaments - uses Supabase
                let targetStatus: 'active' | 'upcoming' | 'completed' = 'upcoming';
                if (activeTab === 'Live') targetStatus = 'active';
                if (activeTab === 'Completed') targetStatus = 'completed';

                if (isNearbyOnly || nearbySort === 'distance') {
                    // DISTANCE-BASED FETCHING (PostGIS)
                    try {
                        const { status } = await Location.requestForegroundPermissionsAsync();
                        if (status === 'granted') {
                            const location = await Location.getCurrentPositionAsync({});
                            currentLoc = { lat: location.coords.latitude, lon: location.coords.longitude };
                            setUserLocation(currentLoc); // Update state for UI/Search
                            const radius = isNearbyOnly ? 100 : 25000; // 100 miles or Global (25k miles)

                            if (activeTab === 'All') {
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

                            // (Sort removed from here, moved to end of function)
                        } else {
                            // Permission denied, fallback to standard date sort
                            console.log('Location permission denied, falling back to standard sort');
                            if (activeTab === 'All') {
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
                    if (activeTab === 'All') {
                        const now = new Date();
                        const todayStr = now.toLocaleDateString('en-CA');

                        const live = await getSupabaseTournaments('active'); // Fetch all active (even started yesterday)
                        const upcoming = await getSupabaseTournaments('upcoming', todayStr); // Fetch future only
                        data = [...live, ...upcoming];
                    } else if (activeTab === 'Upcoming') {
                        const now = new Date();
                        const todayStr = now.toLocaleDateString('en-CA');
                        data = await getSupabaseTournaments('upcoming', todayStr);
                    } else {
                        data = await getSupabaseTournaments(targetStatus);
                    }
                }
            }

            // Dedupe by tournamentId
            const unique = Array.from(new Map(data.map(item => [item.tournamentId, item])).values());

            // 1. FILTER: Show only events strictly starting Today or Future (User Request)
            // "dates not from the past or started before the current date"
            let finalEvents = unique;
            if (activeTab !== 'Completed' && activeTab !== 'My Tournaments') {
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
                    if (activeTab === 'Completed') return dateB - dateA;
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
            setHasMore(false); // No pagination anymore
        } catch (e) {
            console.error('loadEvents error:', e);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }, [activeTab, isNearbyOnly, nearbySort]);

    const loadMore = useCallback(() => {
        // No pagination needed - we load all events at once
    }, []);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await loadEvents();
        setRefreshing(false);
    }, [loadEvents]);

    useEffect(() => {
        let isMounted = true;

        const fetchData = async () => {
            setLoading(true);
            try {
                if (search.length >= 2) {
                    // Search with active Status Filter
                    const statuses = activeTab === 'All' ? undefined : getValidStatuses(activeTab.toLowerCase());
                    let results = await searchTournaments(search, statuses);

                    // Apply Client-Side Sort to Search Results
                    if (nearbySort === 'distance') {
                        // Ensure we have location
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

                        if (loc) {
                            results.sort((a, b) => {
                                if (!a.latitude || !a.longitude) return 1;
                                if (!b.latitude || !b.longitude) return -1;
                                const distA = getDistance(loc!.lat, loc!.lon, a.latitude, a.longitude);
                                const distB = getDistance(loc!.lat, loc!.lon, b.latitude, b.longitude);
                                return distA - distB;
                            });
                        }
                    } else {
                        // Date sort (default for searchTournaments but explicit here if needed)
                        // searchTournaments already sorts by date, but maybe enforce direction?
                    }

                    if (isMounted) setEvents(results);
                } else {
                    // Standard load (tabs or nearby)
                    const results = await loadEvents();
                    if (isMounted && results) setEvents(results);
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
            fetchData();
        }

        return () => { isMounted = false; };
    }, [search, activeTab, isNearbyOnly, nearbySort]); // Combined dependency

    const filteredEvents = events; // No local filtering needed anymore

    const TABS: ('All' | 'Live' | 'Upcoming' | 'Completed' | 'My Tournaments')[] = [
        'All', 'Live', 'Upcoming', 'Completed', 'My Tournaments'
    ];

    const handleNearbyToggle = useCallback((value: boolean) => {
        setIsNearbyOnly(value);
        if (value) {
            setNearbySort('distance'); // Auto-switch to distance for utility
        } else {
            setNearbySort('date'); // Revert to date for speed
        }
    }, []);

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={{ color: '#fff', fontSize: 24, fontWeight: 'bold', marginBottom: 16 }}>
                    Find Events
                </Text>

                <View style={{ flexDirection: 'row', gap: 12 }}>
                    <View style={styles.searchContainer}>
                        <MaterialCommunityIcons name="magnify" size={20} color={THEME.textSecondary} style={{ marginRight: 8 }} />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search loaded events..."
                            placeholderTextColor={THEME.textSecondary}
                            value={search}
                            onChangeText={setSearch}
                        />
                        {search.length > 0 && (
                            <TouchableOpacity onPress={() => setSearch('')} style={styles.clearButton}>
                                <MaterialCommunityIcons name="close-circle" size={20} color={THEME.textSecondary} />
                            </TouchableOpacity>
                        )}
                    </View>
                    <TouchableOpacity onPress={openDrawer} style={styles.filterButton}>
                        <MaterialCommunityIcons name="filter-variant" size={24} color="#fff" />
                    </TouchableOpacity>
                </View>
            </View>

            {loading && !refreshing ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator size="large" color={THEME.accent} />
                </View>
            ) : (
                <FlashList
                    data={filteredEvents}
                    onRefresh={onRefresh}
                    refreshing={refreshing}
                    onEndReached={loadMore}
                    onEndReachedThreshold={0.5}
                    keyExtractor={(item, index) => (item.tournamentId || index).toString()}
                    contentContainerStyle={{ padding: 16 }}
                    estimatedItemSize={116}
                    ListFooterComponent={
                        loadingMore ? (
                            <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                                <ActivityIndicator size="small" color={THEME.accent} />
                            </View>
                        ) : null
                    }
                    renderItem={({ item }) => (
                        <EventCard
                            item={item}
                            isExpanded={expandedId === item.tournamentId}
                            onPress={() => setExpandedId(
                                expandedId === item.tournamentId ? null : item.tournamentId
                            )}
                        />
                    )}
                    ListEmptyComponent={
                        <View style={{ alignItems: 'center', marginTop: 40, paddingHorizontal: 32 }}>
                            <MaterialCommunityIcons
                                name={activeTab === 'Live' ? 'broadcast-off' : 'calendar-blank'}
                                size={48}
                                color={THEME.textSecondary}
                                style={{ marginBottom: 16, opacity: 0.5 }}
                            />
                            <Text style={{ color: THEME.text, textAlign: 'center', fontSize: 16, fontWeight: '600', marginBottom: 8 }}>
                                {activeTab === 'Live' ? 'No Live events right now' :
                                    activeTab === 'My Tournaments' ? 'You haven\'t joined any tournaments yet' :
                                        isNearbyOnly ? 'No nearby events found for this filter' :
                                            'No events found'}
                            </Text>
                            <Text style={{ color: THEME.textSecondary, textAlign: 'center', fontSize: 13 }}>
                                {activeTab === 'Live' ? 'Check back later or browse Upcoming events.' :
                                    activeTab === 'My Tournaments' ? 'Join a tournament on Matchplay to see it here.' :
                                        isNearbyOnly ? 'Try switching tabs or disabling "Nearby Only".' :
                                            'Try adjusting your search or tabs.'}
                            </Text>
                        </View>
                    }
                />
            )
            }

            {/* Custom Drawer Overlay */}
            {
                isDrawerOpen && (
                    <Pressable style={StyleSheet.absoluteFill} onPress={closeDrawer}>
                        <Animated.View style={[styles.backdrop, backdropStyle]} />
                    </Pressable>
                )
            }

            {
                isDrawerOpen && (
                    <Animated.View style={[styles.drawer, drawerStyle]}>
                        <View style={styles.drawerHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                <Text style={styles.drawerTitle}>Filters</Text>
                                {loading && <ActivityIndicator size="small" color={THEME.accent} />}
                            </View>
                            <TouchableOpacity onPress={closeDrawer}>
                                <MaterialCommunityIcons name="close" size={24} color={THEME.text} />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.drawerContent}>
                            {/* Nearby Toggle */}
                            <View style={styles.drawerRow}>
                                <View style={{ flex: 1 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <MaterialCommunityIcons name="map-marker-radius" size={24} color={THEME.accent} style={{ marginRight: 8 }} />
                                        <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>Nearby Only</Text>
                                    </View>
                                    <Text style={{ color: THEME.textSecondary, fontSize: 12, marginTop: 4 }}>
                                        Limit search radius to 100 miles
                                    </Text>
                                </View>
                                <Switch
                                    value={isNearbyOnly}
                                    onValueChange={handleNearbyToggle}
                                    trackColor={{ false: '#3e3e3e', true: 'rgba(0,180,216,0.3)' }}
                                    thumbColor={isNearbyOnly ? THEME.accent : '#f4f3f4'}
                                />
                            </View>

                            {/* Sort Options */}
                            <View style={{ marginBottom: 24 }}>
                                <Text style={styles.sectionTitle}>Sort By</Text>
                                <View style={styles.sortContainer}>
                                    <TouchableOpacity
                                        style={[styles.sortOption, nearbySort === 'distance' && styles.activeSortOption]}
                                        onPress={() => setNearbySort('distance')}
                                    >
                                        <Text style={[styles.sortText, nearbySort === 'distance' && styles.activeSortText]}>Distance</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.sortOption, nearbySort === 'date' && styles.activeSortOption]}
                                        onPress={() => setNearbySort('date')}
                                    >
                                        <Text style={[styles.sortText, nearbySort === 'date' && styles.activeSortText]}>Date</Text>
                                    </TouchableOpacity>
                                </View>
                                {nearbySort === 'distance' && !isNearbyOnly && (
                                    <Text style={{ color: THEME.textSecondary, fontSize: 11, marginTop: 6, fontStyle: 'italic' }}>
                                        Showing closest events worldwide (no distance limit).
                                    </Text>
                                )}
                            </View>

                            <Text style={styles.sectionTitle}>Event Status</Text>
                            {TABS.map((tab) => (
                                <TouchableOpacity
                                    key={tab}
                                    style={[styles.drawerItem, activeTab === tab && styles.activeDrawerItem]}
                                    onPress={() => setActiveTab(tab)}
                                >
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        {tab === 'Live' && <PulsingDot />}
                                        <Text style={[styles.drawerItemText, activeTab === tab && styles.activeDrawerItemText]}>{tab}</Text>
                                    </View>
                                    {activeTab === tab && (
                                        <MaterialCommunityIcons name="check" size={18} color="#fff" />
                                    )}
                                </TouchableOpacity>
                            ))}
                        </View>
                    </Animated.View>
                )
            }
        </View >
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: THEME.background,
        paddingTop: 60,
    },
    header: {
        paddingHorizontal: 16,
        marginBottom: 16,
    },
    searchContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: THEME.card,
        borderRadius: 8,
        paddingHorizontal: 12,
        height: 48,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    searchInput: {
        flex: 1,
        color: THEME.text,
        fontSize: 16,
    },
    clearButton: {
        padding: 4,
    },
    filterButton: {
        width: 48,
        height: 48,
        backgroundColor: THEME.card,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    card: {
        backgroundColor: THEME.card,
        borderRadius: 16,
        marginBottom: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    cardExpanded: {
        borderColor: THEME.accent,
        borderWidth: 1,
    },
    cardCollapsed: {
        flexDirection: 'row',
        height: 100,
    },
    cardImage: {
        width: 100,
        height: 100,
        backgroundColor: '#2b2d42',
    },
    cardContent: {
        flex: 1,
        padding: 12,
        justifyContent: 'center',
    },
    cardExpandedContent: {
        padding: 16,
        paddingTop: 0,
    },
    expandedDivider: {
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.1)',
        marginBottom: 16,
    },
    expandedRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    expandedLabel: {
        color: THEME.text,
        fontSize: 14,
        marginLeft: 10,
        flex: 1,
    },
    expandedDescription: {
        color: THEME.textSecondary,
        fontSize: 13,
        lineHeight: 18,
        marginTop: 4,
        marginBottom: 12,
    },
    expandedActions: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 12,
    },
    actionButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.05)',
        paddingVertical: 12,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    actionText: {
        color: THEME.accent,
        fontWeight: 'bold',
        fontSize: 14,
        marginLeft: 8,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    cardTitle: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
        flex: 1,
        marginRight: 8,
    },
    badge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        borderWidth: 1,
        minWidth: 50,
        alignItems: 'center',
    },
    badgeText: {
        fontSize: 10,
        fontWeight: 'bold',
    },
    cardRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    cardDetails: {
        color: THEME.textSecondary,
        fontSize: 12,
    },
    // Drawer Styles
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#000',
        zIndex: 100,
    },
    drawer: {
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        width: DRAWER_WIDTH,
        backgroundColor: '#0d1b2a',
        zIndex: 101,
        borderLeftWidth: 1,
        borderLeftColor: 'rgba(255,255,255,0.1)',
        paddingTop: 60,
        shadowColor: "#000",
        shadowOffset: { width: -5, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 10,
        elevation: 20,
    },
    drawerHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingBottom: 20,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.05)',
    },
    drawerTitle: {
        color: '#fff',
        fontSize: 20,
        fontWeight: 'bold',
    },
    drawerContent: {
        flex: 1,
        padding: 20,
    },
    drawerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 30,
        backgroundColor: THEME.card,
        padding: 16,
        borderRadius: 12,
    },
    sectionTitle: {
        color: THEME.textSecondary,
        fontSize: 14,
        fontWeight: 'bold',
        marginBottom: 12,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    drawerItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 16,
        paddingHorizontal: 12,
        marginBottom: 8,
        borderRadius: 8,
    },
    activeDrawerItem: {
        backgroundColor: 'rgba(0,180,216,0.1)',
    },
    drawerItemText: {
        color: THEME.textSecondary,
        fontSize: 16,
        fontWeight: '500',
    },
    activeDrawerItemText: {
        color: THEME.accent,
        fontWeight: 'bold',
    },
    // Bottom Sheet Styles
    sheetBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    sheetContainer: {
        backgroundColor: THEME.card,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: 20,
        paddingBottom: 40,
        maxHeight: '70%',
    },
    sheetHandle: {
        width: 40,
        height: 4,
        backgroundColor: THEME.textSecondary,
        borderRadius: 2,
        alignSelf: 'center',
        marginVertical: 12,
    },
    sheetTitle: {
        color: '#fff',
        fontSize: 22,
        fontWeight: 'bold',
        marginBottom: 12,
    },
    sheetBadge: {
        alignSelf: 'flex-start',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 6,
        marginBottom: 20,
    },
    sheetBadgeText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: 'bold',
    },
    sheetSection: {
        marginBottom: 20,
    },
    sheetRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    sheetLabel: {
        color: THEME.text,
        fontSize: 15,
        marginLeft: 12,
        flex: 1,
    },
    sheetSectionTitle: {
        color: THEME.accent,
        fontSize: 14,
        fontWeight: 'bold',
        marginBottom: 8,
        textTransform: 'uppercase',
    },
    sheetDescription: {
        color: THEME.textSecondary,
        fontSize: 14,
        lineHeight: 20,
    },
    sheetButton: {
        backgroundColor: THEME.accent,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 12,
        marginTop: 10,
    },
    sheetButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    sortContainer: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 8,
        padding: 4,
    },
    sortOption: {
        flex: 1,
        paddingVertical: 8,
        alignItems: 'center',
        borderRadius: 6
    },
    activeSortOption: {
        backgroundColor: THEME.accent
    },
    sortText: {
        color: THEME.textSecondary,
        fontSize: 14,
        fontWeight: '600'
    },
    activeSortText: {
        color: '#fff'
    }
});
