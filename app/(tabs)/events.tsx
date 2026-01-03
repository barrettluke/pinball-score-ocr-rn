import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Image } from 'expo-image';
import * as Location from 'expo-location';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Dimensions, FlatList, Pressable, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withRepeat, withSpring, withTiming } from 'react-native-reanimated';
import { findNearbyTournaments, getTournaments, getUserDashboard, MatchplayTournament } from '../../utils/matchplay';

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

// Memoized Event Card component for FlatList performance
const EventCard = React.memo(({ item }: { item: MatchplayTournament }) => {
    // Pre-compute all display values
    const badgeColor = item.status === 'active' ? THEME.live : item.status === 'upcoming' ? THEME.upcoming : THEME.textSecondary;

    // Compute location string once
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
        if (item.distance) location += ` • ${item.distance.toFixed(1)} mi`;

        return location;
    }, [item.city, item.stateProvince, item.locationName, item.country, item.distance]);

    // Compute date string once
    const dateDisplay = React.useMemo(() => {
        const dateStr = item.startLocalDate && !isNaN(new Date(item.startLocalDate).getTime())
            ? new Date(item.startLocalDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
            : (item.startLocalDate || 'Date TBA');
        return item.startLocalTime ? `${dateStr} • ${item.startLocalTime}` : dateStr;
    }, [item.startLocalDate, item.startLocalTime]);

    return (
        <View style={styles.card}>
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
                    <Text style={styles.cardTitle} numberOfLines={1}>{item.name}</Text>
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
                </View>
            </View>
        </View>
    );
});

export default function EventsScreen() {
    const [activeTab, setActiveTab] = useState<'All' | 'Live' | 'Upcoming' | 'Completed' | 'My Tournaments'>('All');
    const [isNearbyOnly, setIsNearbyOnly] = useState(false);
    const [search, setSearch] = useState('');
    const [events, setEvents] = useState<MatchplayTournament[]>([]);
    const [refreshing, setRefreshing] = useState(false);
    const [loading, setLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);

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

    const loadEvents = useCallback(async (pageNum: number = 1, append: boolean = false) => {
        if (pageNum === 1 && !refreshing) setLoading(true);
        if (pageNum > 1) setLoadingMore(true);

        try {
            let data: MatchplayTournament[] = [];
            let moreAvailable = false;

            if (activeTab === 'My Tournaments') {
                data = await getUserDashboard();
                moreAvailable = false;
            } else {
                let targetStatus: 'active' | 'upcoming' | 'completed' = 'upcoming';
                if (activeTab === 'Live') targetStatus = 'active';
                if (activeTab === 'Completed') targetStatus = 'completed';

                if (isNearbyOnly) {
                    let userLat: number | null = null;
                    let userLon: number | null = null;
                    let userZip: string | null = null;
                    let userState: string | null = null;

                    try {
                        const { status } = await Location.requestForegroundPermissionsAsync();
                        if (status === 'granted') {
                            const location = await Location.getCurrentPositionAsync({});
                            userLat = location.coords.latitude;
                            userLon = location.coords.longitude;

                            try {
                                const address = await Location.reverseGeocodeAsync({ latitude: userLat, longitude: userLon });
                                if (address && address.length > 0) {
                                    userZip = address[0].postalCode;
                                    userState = address[0].region;
                                    console.log(`[Events] User Context: ${userZip}, ${userState}`);
                                }
                            } catch (revErr) { /* ignore */ }
                        }
                    } catch (err) { /* ignore */ }

                    if (userLat && userLon) {
                        const BATCH_SIZE_PAGES = 20;
                        const startPage = ((pageNum - 1) * BATCH_SIZE_PAGES) + 1;

                        console.log(`[Events] Scanning Nearby (${targetStatus}): Batch ${pageNum} (Pages ${startPage}-...)`);

                        const result = await findNearbyTournaments(
                            userLat, userLon, 100, BATCH_SIZE_PAGES,
                            userZip, userState, startPage, targetStatus
                        );

                        data = result.tournaments;
                        moreAvailable = result.scannedPages >= (startPage + BATCH_SIZE_PAGES - 1);
                    }
                } else {
                    if (activeTab === 'All') {
                        const liveResult = await getTournaments('active', pageNum);
                        const upcomingResult = await getTournaments('upcoming', pageNum);
                        data = [...liveResult.tournaments, ...upcomingResult.tournaments];
                        moreAvailable = liveResult.hasMore || upcomingResult.hasMore;
                    } else {
                        const result = await getTournaments(targetStatus, pageNum);
                        data = result.tournaments;
                        moreAvailable = result.hasMore;
                    }
                }
            }

            if (append) {
                const combined = [...events, ...data];
                const unique = Array.from(new Map(combined.map(item => [item.tournamentId || item.itemId || Math.random(), item])).values());
                setEvents(unique);
            } else {
                const unique = Array.from(new Map(data.map(item => [item.tournamentId || item.itemId || Math.random(), item])).values());
                setEvents(unique);
            }

            setHasMore(moreAvailable);
            setPage(pageNum);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }, [activeTab, isNearbyOnly, refreshing, events]);

    const loadMore = useCallback(() => {
        if (!loadingMore && hasMore && !loading) {
            loadEvents(page + 1, true);
        }
    }, [loadingMore, hasMore, loading, page, loadEvents]);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        setPage(1);
        setHasMore(true);
        await loadEvents(1, false);
        setRefreshing(false);
    }, [loadEvents]);

    useEffect(() => {
        setPage(1);
        setHasMore(true);
        loadEvents(1, false);
    }, [activeTab, isNearbyOnly]);

    const filteredEvents = events.filter(event => {
        if (search) {
            const q = search.toLowerCase();
            return event.name.toLowerCase().includes(q) || (event.locationName || '').toLowerCase().includes(q);
        }
        return true;
    });

    const TABS: ('All' | 'Live' | 'Upcoming' | 'Completed' | 'My Tournaments')[] = [
        'All', 'Live', 'Upcoming', 'Completed', 'My Tournaments'
    ];

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
                <FlatList
                    data={filteredEvents}
                    onRefresh={onRefresh}
                    refreshing={refreshing}
                    onEndReached={loadMore}
                    onEndReachedThreshold={0.5}
                    keyExtractor={(item, index) => (item.tournamentId || item.itemId || index).toString()}
                    contentContainerStyle={{ padding: 16 }}
                    getItemLayout={(data, index) => ({
                        length: 116,
                        offset: 116 * index,
                        index,
                    })}
                    removeClippedSubviews={true}
                    maxToRenderPerBatch={10}
                    windowSize={5}
                    initialNumToRender={10}
                    ListFooterComponent={
                        loadingMore ? (
                            <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                                <ActivityIndicator size="small" color={THEME.accent} />
                            </View>
                        ) : null
                    }
                    renderItem={({ item }) => <EventCard item={item} />}
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
            )}

            {/* Custom Drawer Overlay */}
            {isDrawerOpen && (
                <Pressable style={StyleSheet.absoluteFill} onPress={closeDrawer}>
                    <Animated.View style={[styles.backdrop, backdropStyle]} />
                </Pressable>
            )}

            {isDrawerOpen && (
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
                                    Only show events within 100 miles
                                </Text>
                            </View>
                            <Switch
                                value={isNearbyOnly}
                                onValueChange={setIsNearbyOnly}
                                trackColor={{ false: '#3e3e3e', true: 'rgba(0,180,216,0.3)' }}
                                thumbColor={isNearbyOnly ? THEME.accent : '#f4f3f4'}
                            />
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
            )}
        </View>
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
        flexDirection: 'row',
        overflow: 'hidden',
        height: 100,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    cardImage: {
        width: 100,
        height: '100%',
        backgroundColor: '#2b2d42',
    },
    cardContent: {
        flex: 1,
        padding: 12,
        justifyContent: 'center',

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
});
