import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { FlashList } from '@shopify/flash-list';

import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Dimensions, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { EventCard } from '../../components/EventCard';
import { EventFilterDrawer } from '../../components/EventFilterDrawer';
import { EVENT_TABS, EVENTS_SCREEN, EventTab } from '../../constants/strings';
import { THEME } from '../../constants/theme';
import { useEvents } from '../../hooks/useEvents';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DRAWER_WIDTH = SCREEN_WIDTH * 0.85;

// PulsingDot removed (moved to EventFilterDrawer)



// Haversine formula to calculate distance in miles




export default function EventsScreen() {
    const [activeTab, setActiveTab] = useState<EventTab>(EVENT_TABS.ALL);
    const [isNearbyOnly, setIsNearbyOnly] = useState(false);
    const [isIfpaOnly, setIsIfpaOnly] = useState(false);
    const [nearbySort, setNearbySort] = useState<'distance' | 'date'>('date');
    const [search, setSearch] = useState('');

    // Data Hook
    const { events, loading, refreshing, onRefresh } = useEvents(activeTab, isNearbyOnly, nearbySort, search);

    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [expandedId, setExpandedId] = useState<number | null>(null);

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
            if (finished) scheduleOnRN(() => setIsDrawerOpen(false));
        });
        backdropOpacity.value = withTiming(0, { duration: 200 });
    }, []);

    const drawerStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: drawerTranslateX.value }],
    }));

    const backdropStyle = useAnimatedStyle(() => ({
        opacity: backdropOpacity.value,
    }));



    const filteredEvents = React.useMemo(() => {
        if (!isIfpaOnly) return events;
        return events.filter(e => e.source === 'ifpa' || e.source === 'both');
    }, [events, isIfpaOnly]);



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
                <Text style={styles.headerTitle}>
                    {EVENTS_SCREEN.TITLE}
                </Text>

                <View style={styles.headerRight}>
                    <View style={styles.searchContainer}>
                        <MaterialCommunityIcons name="magnify" size={20} color={THEME.textSecondary} style={styles.searchIcon} />
                        <TextInput
                            style={styles.searchInput}
                            placeholder={EVENTS_SCREEN.SEARCH_PLACEHOLDER}
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
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={THEME.accent} />
                </View>
            ) : (
                <FlashList
                    data={filteredEvents}
                    onRefresh={onRefresh}
                    refreshing={refreshing}
                    onEndReached={undefined}
                    onEndReachedThreshold={0.5}
                    keyExtractor={(item, index) => (item.tournamentId || index).toString()}
                    contentContainerStyle={styles.listContent}
                    estimatedItemSize={116}
                    ListFooterComponent={null}
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
                        <View style={styles.emptyContainer}>
                            <MaterialCommunityIcons
                                name={activeTab === EVENT_TABS.LIVE ? 'broadcast-off' : 'calendar-blank'}
                                size={48}
                                color={THEME.textSecondary}
                                style={styles.emptyIcon}
                            />
                            <Text style={styles.emptyTitle}>
                                {activeTab === EVENT_TABS.LIVE ? EVENTS_SCREEN.EMPTY_TITLE.LIVE :
                                    activeTab === EVENT_TABS.MY_TOURNAMENTS ? EVENTS_SCREEN.EMPTY_TITLE.MY_TOURNAMENTS :
                                        isNearbyOnly ? EVENTS_SCREEN.EMPTY_TITLE.NEARBY :
                                            EVENTS_SCREEN.EMPTY_TITLE.DEFAULT}
                            </Text>
                            <Text style={styles.emptyText}>
                                {activeTab === EVENT_TABS.LIVE ? EVENTS_SCREEN.EMPTY_TEXT.LIVE :
                                    activeTab === EVENT_TABS.MY_TOURNAMENTS ? EVENTS_SCREEN.EMPTY_TEXT.MY_TOURNAMENTS :
                                        isNearbyOnly ? EVENTS_SCREEN.EMPTY_TEXT.NEARBY :
                                            EVENTS_SCREEN.EMPTY_TEXT.DEFAULT}
                            </Text>
                        </View>
                    }
                />
            )
            }

            {/* Custom Drawer Overlay */}
            <EventFilterDrawer
                isOpen={isDrawerOpen}
                onClose={closeDrawer}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                isNearbyOnly={isNearbyOnly}
                onToggleNearby={handleNearbyToggle}
                isIfpaOnly={isIfpaOnly}
                setIsIfpaOnly={setIsIfpaOnly}
                nearbySort={nearbySort}
                setNearbySort={setNearbySort}
                loading={loading}
                drawerStyle={drawerStyle}
                backdropStyle={backdropStyle}
            />
        </View >
    );
}

import { styles } from '../../styles/events.styles';

