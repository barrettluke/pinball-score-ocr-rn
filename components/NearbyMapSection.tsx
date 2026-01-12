import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as ExpoLocation from 'expo-location';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { THEME } from '../constants/theme';
import { getDatabase } from '../utils/database';
import { findLocationsWithFavorites, PinballMapLocation } from '../utils/pinballmap';
import PinballMap from './PinballMap';

const DOM_CONFIG = { matchContents: true };

interface NearbyMapSectionProps {
    isVisible: boolean;
}

export const NearbyMapSection = ({ isVisible }: NearbyMapSectionProps) => {
    // Pinball Map State
    const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(null);
    const [showMap, setShowMap] = useState(true);
    const [nearbyLocations, setNearbyLocations] = useState<{ location: PinballMapLocation; matchingMachines: string[] }[]>([]);
    const [loadingLocations, setLoadingLocations] = useState(false);

    // Request location and fetch nearby pinball locations when visible
    useEffect(() => {
        if (isVisible && showMap) {
            requestLocationAndFetchNearby();
        }
    }, [isVisible, showMap]);

    const requestLocationAndFetchNearby = async () => {
        try {
            setLoadingLocations(true);

            // Request location permission
            const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                setLoadingLocations(false);
                return;
            }

            // Get current location
            const location = await ExpoLocation.getCurrentPositionAsync({});
            const { latitude, longitude } = location.coords;
            setUserLocation({ lat: latitude, lon: longitude });

            // Get favorite machine names
            const db = await getDatabase();
            const favorites: { name: string }[] = await db.getAllAsync('SELECT name FROM machines');
            const favoriteNames = favorites.map(f => f.name);

            if (favoriteNames.length === 0) {
                setNearbyLocations([]);
                setLoadingLocations(false);
                return;
            }

            // Search for locations with these machines
            const locations = await findLocationsWithFavorites(latitude, longitude, favoriteNames, 60);
            setNearbyLocations(locations);
        } catch (error) {
            console.error('Error fetching nearby locations:', error);
        } finally {
            setLoadingLocations(false);
        }
    };

    const handleLocationSelect = useCallback((id: number) => {
        Linking.openURL(`https://pinballmap.com/map?by_location_id=${id}`);
    }, []);

    if (!isVisible) return null;

    if (!showMap) {
        return (
            <TouchableOpacity style={styles.mapCollapsed} onPress={() => setShowMap(true)}>
                <MaterialCommunityIcons name="map-marker-radius" size={20} color={THEME.accent} />
                <Text style={styles.mapCollapsedText}>Show Nearby Map ({nearbyLocations.length} locations)</Text>
                <MaterialCommunityIcons name="chevron-down" size={20} color={THEME.textSecondary} />
            </TouchableOpacity>
        );
    }

    return (
        <View style={styles.mapContainer}>
            <View style={styles.mapHeader}>
                <Text style={styles.mapTitle}>Nearby Locations</Text>
                <TouchableOpacity onPress={() => setShowMap(false)}>
                    <MaterialCommunityIcons name="chevron-up" size={24} color={THEME.textSecondary} />
                </TouchableOpacity>
            </View>
            {loadingLocations ? (
                <View style={styles.mapLoading}>
                    <ActivityIndicator size="small" color={THEME.accent} />
                    <Text style={styles.mapLoadingText}>Finding locations with your favorites...</Text>
                </View>
            ) : nearbyLocations.length > 0 && userLocation ? (
                <View style={{ height: 350, borderRadius: 8, overflow: 'hidden' }}>
                    <PinballMap
                        userLocation={userLocation}
                        locations={nearbyLocations}
                        onLocationSelect={handleLocationSelect}
                        dom={DOM_CONFIG}
                    />
                </View>
            ) : userLocation ? (
                <View style={styles.mapLoading}>
                    <MaterialCommunityIcons name="map-marker-off" size={32} color={THEME.textSecondary} />
                    <Text style={styles.mapLoadingText}>No locations found with your favorites nearby</Text>
                </View>
            ) : (
                <View style={styles.mapLoading}>
                    <Text style={styles.mapLoadingText}>Enable location to see nearby pinball</Text>
                </View>
            )}


            {nearbyLocations.length > 0 && !loadingLocations && (
                <>
                    <Text style={styles.mapCount}>
                        {nearbyLocations.length} location{nearbyLocations.length !== 1 ? 's' : ''} with your favorites nearby
                    </Text>
                    {/* Fallback list in case map doesn't load properly */}
                    <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
                        {nearbyLocations.slice(0, 10).map(({ location, matchingMachines }) => (
                            <TouchableOpacity
                                key={location.id}
                                style={styles.locationItem}
                                onPress={() => Linking.openURL(`https://pinballmap.com/map?by_location_id=${location.id}`)}
                            >
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.locationName} numberOfLines={1}>{location.name}</Text>
                                    <Text style={styles.locationMeta} numberOfLines={1}>
                                        {location.city}, {location.state} • {location.distance?.toFixed(1)} mi
                                    </Text>
                                    <Text style={styles.locationMachines} numberOfLines={2}>
                                        🎯 {matchingMachines.join(', ')}
                                    </Text>
                                </View>
                                <MaterialCommunityIcons name="chevron-right" size={18} color={THEME.textSecondary} />
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    mapContainer: {
        marginBottom: 16,
        backgroundColor: THEME.card,
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    mapHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    mapTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#fff',
    },
    mapLoading: {
        height: 200,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.2)',
        borderRadius: 8,
    },
    mapLoadingText: {
        color: THEME.textSecondary,
        marginTop: 12,
        textAlign: 'center',
    },
    mapCount: {
        color: THEME.accent,
        fontSize: 14,
        fontWeight: 'bold',
        marginTop: 12,
        marginBottom: 8,
    },
    locationItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.05)'
    },
    locationName: {
        color: THEME.text,
        fontSize: 14,
        fontWeight: '600'
    },
    locationMeta: {
        color: THEME.textSecondary,
        fontSize: 12
    },
    locationMachines: {
        color: THEME.accent,
        fontSize: 11,
        marginTop: 2
    },
    mapCollapsed: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 12,
        backgroundColor: THEME.card,
        borderRadius: 12,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    mapCollapsedText: {
        color: THEME.text,
        fontSize: 14,
        fontWeight: '600',
        flex: 1,
        marginLeft: 10,
    },
});
