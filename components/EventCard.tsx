import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Calendar from 'expo-calendar';
import { Image } from 'expo-image';
import React from 'react';
import { Alert, Linking, Platform, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { THEME } from '../constants/theme';
import { formatTime12h } from '../utils/formatters';
import { MatchplayTournament } from '../utils/matchplay';



interface EventCardProps {
    item: MatchplayTournament;
    isExpanded: boolean;
    onPress: () => void;
}

export const EventCard = React.memo(({ item, isExpanded, onPress }: EventCardProps) => {
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

                                {/* Source Badges */}
                                <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
                                    {(item.source === 'ifpa' || item.source === 'both') && (
                                        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255, 215, 0, 0.1)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 1, borderColor: 'rgba(255, 215, 0, 0.3)' }}>
                                            <MaterialCommunityIcons name="trophy" size={10} color="#FFD700" style={{ marginRight: 3 }} />
                                            <Text style={{ color: '#FFD700', fontSize: 10, fontWeight: 'bold' }}>IFPA</Text>
                                        </View>
                                    )}
                                    {(item.source === 'matchplay' || item.source === 'both') && (
                                        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(72, 202, 228, 0.1)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 1, borderColor: 'rgba(72, 202, 228, 0.3)' }}>
                                            <MaterialCommunityIcons name="gamepad-variant" size={10} color="#48cae4" style={{ marginRight: 3 }} />
                                            <Text style={{ color: '#48cae4', fontSize: 10, fontWeight: 'bold' }}>MATCHPLAY</Text>
                                        </View>
                                    )}
                                </View>
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

                            <TouchableOpacity style={styles.actionButton} onPress={() => {
                                if (item.source === 'ifpa') {
                                    const urlMatch = item.description.match(/(https?:\/\/[^\s]+)/g);
                                    if (urlMatch && urlMatch.length > 0) {
                                        Linking.openURL(urlMatch[urlMatch.length - 1]);
                                    } else {
                                        Linking.openURL('https://www.ifpapinball.com/calendar/');
                                    }
                                } else {
                                    openMatchplay();
                                }
                            }}>
                                <MaterialCommunityIcons
                                    name={item.source === 'ifpa' ? "web" : "open-in-new"}
                                    size={18}
                                    color={THEME.accent}
                                />
                                <Text style={styles.actionText}>
                                    {item.source === 'ifpa' ? "Website" : "Matchplay"}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
            </View>
        </Pressable>
    );
});

const styles = StyleSheet.create({
    card: {
        backgroundColor: THEME.card,
        borderRadius: 12,
        marginHorizontal: 16,
        marginVertical: 6,
        padding: 12,
        // Shadow
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 4,
        borderWidth: 1,
        borderColor: '#2e3a59',
    },
    cardExpanded: {
        borderColor: THEME.accent,
        backgroundColor: '#1f2e4d',
    },
    cardCollapsed: {
        flexDirection: 'row',
    },
    cardImage: {
        width: 70,
        height: 70,
        borderRadius: 8,
        backgroundColor: '#0f172a',
        marginRight: 12,
        borderWidth: 1,
        borderColor: '#3e4c69',
    },
    cardContent: {
        flex: 1,
        justifyContent: 'center',
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 4,
    },
    cardTitle: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
        flex: 1,
        marginRight: 8,
    },
    badge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
        borderWidth: 1,
    },
    badgeText: {
        fontSize: 10,
        fontWeight: 'bold',
    },
    cardRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
    },
    cardDetails: {
        color: THEME.textSecondary,
        fontSize: 13,
    },
    cardExpandedContent: {
        marginTop: 12,
    },
    expandedDivider: {
        height: 1,
        backgroundColor: '#3e4c69',
        marginBottom: 12,
    },
    expandedRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    expandedLabel: {
        color: '#e0e1dd',
        fontSize: 14,
        marginLeft: 8,
        flex: 1,
    },
    expandedDescription: {
        color: THEME.textSecondary,
        fontSize: 14,
        fontStyle: 'italic',
        marginTop: 4,
        marginBottom: 12,
        lineHeight: 20,
    },
    expandedActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 12,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 180, 216, 0.15)',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: 'rgba(0, 180, 216, 0.3)',
    },
    actionText: {
        color: THEME.accent,
        fontWeight: 'bold',
        fontSize: 12,
        marginLeft: 6,
    },
});
