import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { ActivityIndicator, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const THEME = {
    background: '#0d1b2a',
    card: '#1b263b',
    accent: '#00b4d8',
    text: '#e0e1dd',
    textSecondary: '#778da9',
    success: '#28a745',
};

interface Location {
    id: number;
    name: string;
    city: string;
    state: string;
    distance?: number;
}

interface NearbyLocationProps {
    locations: { location: Location; matchingMachines: string[] }[];
    loading: boolean;
    userLocation: { lat: number; lon: number } | null;
}

export function NearbyLocationsList({ locations, loading, userLocation }: NearbyLocationProps) {
    if (loading) {
        return (
            <View style={styles.loading}>
                <ActivityIndicator size="small" color={THEME.accent} />
                <Text style={styles.loadingText}>Finding locations with your favorites...</Text>
            </View>
        );
    }

    if (locations.length > 0) {
        return (
            <ScrollView style={styles.list} nestedScrollEnabled>
                {locations.slice(0, 20).map(({ location, matchingMachines }) => (
                    <TouchableOpacity
                        key={location.id}
                        style={styles.card}
                        onPress={() => Linking.openURL(`https://pinballmap.com/map?by_location_id=${location.id}`)}
                    >
                        <View style={styles.info}>
                            <Text style={styles.name} numberOfLines={1}>{location.name}</Text>
                            <Text style={styles.address} numberOfLines={1}>
                                {location.city}, {location.state} • {location.distance?.toFixed(1)} mi
                            </Text>
                            <View style={styles.chips}>
                                {matchingMachines.slice(0, 2).map((name, i) => (
                                    <View key={i} style={styles.chip}>
                                        <Text style={styles.chipText} numberOfLines={1}>{name}</Text>
                                    </View>
                                ))}
                                {matchingMachines.length > 2 && (
                                    <Text style={styles.more}>+{matchingMachines.length - 2} more</Text>
                                )}
                            </View>
                        </View>
                        <MaterialCommunityIcons name="chevron-right" size={20} color={THEME.textSecondary} />
                    </TouchableOpacity>
                ))}
            </ScrollView>
        );
    }

    if (userLocation) {
        return (
            <View style={styles.loading}>
                <MaterialCommunityIcons name="map-marker-off" size={32} color={THEME.textSecondary} />
                <Text style={styles.loadingText}>No locations found with your favorites nearby</Text>
            </View>
        );
    }

    return (
        <View style={styles.loading}>
            <Text style={styles.loadingText}>Enable location to see nearby pinball</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    loading: {
        height: 150,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
    },
    loadingText: {
        color: THEME.textSecondary,
        fontSize: 14,
    },
    list: {
        maxHeight: 250,
    },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.05)',
    },
    info: {
        flex: 1,
    },
    name: {
        color: THEME.text,
        fontSize: 14,
        fontWeight: '600',
    },
    address: {
        color: THEME.textSecondary,
        fontSize: 12,
        marginTop: 2,
    },
    chips: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 4,
        marginTop: 6,
    },
    chip: {
        backgroundColor: 'rgba(0,180,216,0.2)',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10,
    },
    chipText: {
        color: THEME.accent,
        fontSize: 11,
        maxWidth: 100,
    },
    more: {
        color: THEME.textSecondary,
        fontSize: 11,
        alignSelf: 'center',
    },
});
