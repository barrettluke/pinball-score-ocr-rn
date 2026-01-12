import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import React, { useEffect } from 'react';
import { ActivityIndicator, Dimensions, Pressable, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { EVENT_TABS, EventTab } from '../constants/strings';
import { THEME } from '../constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DRAWER_WIDTH = SCREEN_WIDTH * 0.85;



// Pulsing Live Dot component (Local to Drawer for now)
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



interface EventFilterDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    activeTab: string;
    setActiveTab: (tab: EventTab) => void;
    isNearbyOnly: boolean;
    onToggleNearby: (val: boolean) => void;
    isIfpaOnly: boolean;
    setIsIfpaOnly: (val: boolean) => void;
    nearbySort: 'distance' | 'date';
    setNearbySort: (val: 'distance' | 'date') => void;
    loading: boolean;
    drawerStyle: any; // AnimatedStyle
    backdropStyle: any; // AnimatedStyle
}

export const EventFilterDrawer = ({
    isOpen,
    onClose,
    activeTab,
    setActiveTab,
    isNearbyOnly,
    onToggleNearby,
    isIfpaOnly,
    setIsIfpaOnly,
    nearbySort,
    setNearbySort,
    loading,
    drawerStyle,
    backdropStyle
}: EventFilterDrawerProps) => {

    const TABS: EventTab[] = [
        EVENT_TABS.ALL,
        EVENT_TABS.LIVE,
        EVENT_TABS.UPCOMING,
        EVENT_TABS.COMPLETED,
        EVENT_TABS.MY_TOURNAMENTS
    ];

    if (!isOpen) return null;

    return (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
            {/* Note: In absoluteFill, the view covers screen. pointerEvents="box-none" lets touches pass if no child catches them, 
                 but current implementation in events.tsx had separate conditional rendering for Backdrop and Drawer.
                 Here we bundle them.
             */}

            {/* Backdrop */}
            <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
                <Animated.View style={[styles.backdrop, backdropStyle]} />
            </Pressable>

            {/* Drawer */}
            <Animated.View style={[styles.drawer, drawerStyle]}>
                <View style={styles.drawerHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <Text style={styles.drawerTitle}>Filters</Text>
                        {loading && <ActivityIndicator size="small" color={THEME.accent} />}
                    </View>
                    <TouchableOpacity onPress={onClose}>
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
                            onValueChange={onToggleNearby}
                            trackColor={{ false: '#3e3e3e', true: 'rgba(0,180,216,0.3)' }}
                            thumbColor={isNearbyOnly ? THEME.accent : '#f4f3f4'}
                        />
                    </View>

                    {/* IFPA Only Toggle */}
                    <View style={styles.drawerRow}>
                        <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <MaterialCommunityIcons name="trophy" size={24} color="#FFD700" style={{ marginRight: 8 }} />
                                <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>IFPA Only</Text>
                            </View>
                            <Text style={{ color: THEME.textSecondary, fontSize: 12, marginTop: 4 }}>
                                Show only sanctioned events
                            </Text>
                        </View>
                        <Switch
                            value={isIfpaOnly}
                            onValueChange={setIsIfpaOnly}
                            trackColor={{ false: '#3e3e3e', true: 'rgba(255, 215, 0, 0.3)' }}
                            thumbColor={isIfpaOnly ? '#FFD700' : '#f4f3f4'}
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
                                {tab === EVENT_TABS.LIVE && <PulsingDot />}
                                <Text style={[styles.drawerItemText, activeTab === tab && styles.activeDrawerItemText]}>{tab}</Text>
                            </View>
                            {activeTab === tab && (
                                <MaterialCommunityIcons name="check" size={18} color="#fff" />
                            )}
                        </TouchableOpacity>
                    ))}
                </View>
            </Animated.View>
        </View>
    );
};

const styles = StyleSheet.create({
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
