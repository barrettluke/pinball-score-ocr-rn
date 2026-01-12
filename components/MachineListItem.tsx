import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Image } from 'expo-image';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { THEME } from '../constants/theme';
import { OPDBMachine } from '../utils/opdb';



interface MachineListItemProps {
    item: OPDBMachine;
    isFavorited: boolean;
    isSaving: boolean;
    onTap: (item: OPDBMachine) => void;
    onFavorite: (item: OPDBMachine) => void;
}

export const MachineListItem = React.memo(({ item, isFavorited, isSaving, onTap, onFavorite }: MachineListItemProps) => {
    return (
        <TouchableOpacity style={styles.item} onPress={() => onTap(item)}>
            <View style={styles.itemRow}>
                {item.image && (
                    <Image
                        source={{ uri: item.image }}
                        style={styles.thumbnail}
                        contentFit="cover"
                    />
                )}
                <View style={styles.itemContent}>
                    <Text style={styles.title}>{item.name}</Text>
                    <Text style={styles.subtitle}>
                        {item.manufacturer} {item.manufacture_date ? `• ${item.manufacture_date}` : ''}
                    </Text>
                    {(item.type || item.player_count) && (
                        <View style={styles.metaBadges}>
                            {[
                                item.type?.toUpperCase(),
                                item.display?.toUpperCase(),
                                item.player_count ? `${item.player_count}P` : null
                            ].filter(Boolean).slice(0, 3).map((badge, index) => (
                                <View key={index} style={styles.listBadge}>
                                    <Text style={styles.listBadgeText}>{badge}</Text>
                                </View>
                            ))}
                        </View>
                    )}
                </View>
                <TouchableOpacity
                    style={styles.heartButton}
                    onPress={(e) => {
                        e.stopPropagation();
                        onFavorite(item);
                    }}
                    disabled={isSaving}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    {isSaving ? (
                        <ActivityIndicator size="small" color={THEME.accent} />
                    ) : (
                        <MaterialCommunityIcons
                            name={isFavorited ? 'heart' : 'heart-outline'}
                            size={24}
                            color={isFavorited ? '#e63946' : THEME.textSecondary}
                        />
                    )}
                </TouchableOpacity>
                <MaterialCommunityIcons name="chevron-right" size={24} color={THEME.textSecondary} />
            </View>
        </TouchableOpacity>
    );
});

const styles = StyleSheet.create({
    item: {
        padding: 16,
        backgroundColor: THEME.card,
        marginBottom: 10,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    itemRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    thumbnail: {
        width: 60,
        height: 60,
        borderRadius: 8,
        marginRight: 12,
    },
    itemContent: {
        flex: 1,
    },
    title: {
        fontSize: 16,
        fontWeight: 'bold',
        color: THEME.text,
    },
    subtitle: {
        fontSize: 14,
        color: THEME.textSecondary,
        marginTop: 2,
    },
    metaBadges: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginTop: 6,
    },
    listBadge: {
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    listBadgeText: {
        fontSize: 10,
        color: THEME.textSecondary,
        fontWeight: '600',
    },
    heartButton: {
        padding: 8,
        marginRight: 4,
    },
});
