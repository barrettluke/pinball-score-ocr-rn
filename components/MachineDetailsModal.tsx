import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Image } from 'expo-image';
import React from 'react';
import { Alert, Linking, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { THEME } from '../constants/theme';
import { OPDBMachine, OPDBMachineDetails } from '../utils/opdb';
import { MachineRules } from '../utils/rules';



const ACRONYMS: Record<string, string> = {
    'ss': 'Solid State (Electronic)',
    'em': 'Electro-Mechanical (Reels)',
    'dmd': 'Dot Matrix Display',
    'lcd': 'Liquid Crystal Display (Modern)',
    'alphanumeric': 'Alphanumeric (Early Digital)',
    'reels': 'Mechanical Reels'
};

const generateAbbreviation = (name: string) => {
    if (!name) return '';

    // Strip common variant suffixes to match base machine
    const cleanName = name
        .replace(/\b(Special Collectors Edition|Limited Edition|Vault Edition|Signature Edition|Collector's Edition|Premium|Pro|LE|SE|VE|CE)\b/gi, '')
        .trim();

    return cleanName
        .replace(/[^\w\s-]/g, '') // Remove special chars
        .split(/[\s-:]+/)        // Split by space, dash, colon
        .map(w => w.charAt(0))
        .join('')
        .toUpperCase();
};

const getRulesLink = (machine: OPDBMachine) => {
    if (!machine.name) return '';

    // Strip common variant suffixes to match base machine
    let cleanName = machine.name
        .replace(/\b(Special Collectors Edition|Limited Edition|Vault Edition|Signature Edition|Collector's Edition|Premium|Pro|LE|SE|VE|CE)\b/gi, '')
        .replace(/[()]/g, '') // Remove parenthesis
        .trim();

    // Special cases
    if (cleanName.includes('The Machine: Bride of Pin')) {
        cleanName = 'Bride of Pinbot';
    }

    // Slugify: lowercase -> remove leading "the " -> remove non-alphanumeric
    const slug = cleanName.toLowerCase()
        .replace(/^the\s+/, '')
        .replace(/[^a-z0-9]/g, '');

    const year = machine.manufacture_date ? parseInt(machine.manufacture_date.substring(0, 4)) : 0;

    if (year >= 2010) {
        // Use Google Search for modern games to avoid broken direct links (handles JJP, variants, WIPs etc)
        const query = encodeURIComponent(`${cleanName} pinball rulesheet site:tiltforums.com`);
        return `https://www.google.com/search?q=${query}`;
    } else if (year >= 1980) {
        return `http://www.pinball.org/rules/${slug}.html`;
    } else {
        // Use Google Search for instruction cards (handles .pdf, .jpg, and various sites)
        const query = encodeURIComponent(`${cleanName} pinball instruction card site:pinballrebel.com OR site:ipdb.org`);
        return `https://www.google.com/search?q=${query}`;
    }
};

interface MachineDetailsModalProps {
    visible: boolean;
    machine: OPDBMachine | null;
    extendedDetails: OPDBMachineDetails | null;
    rulesSummary: MachineRules | null;
    favoriteIds: Set<string>;
    isSaving: boolean;
    onClose: () => void;
    onToggleFavorite: (machine: OPDBMachine) => void;
}

export const MachineDetailsModal = ({
    visible,
    machine,
    extendedDetails,
    rulesSummary,
    favoriteIds,
    isSaving,
    onClose,
    onToggleFavorite
}: MachineDetailsModalProps) => {
    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="fade"
            onRequestClose={onClose}
        >
            <Pressable style={styles.modalOverlay} onPress={onClose}>
                <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
                    {machine && (
                        <>
                            <TouchableOpacity style={{ position: 'absolute', top: 16, right: 16, zIndex: 10 }} onPress={onClose}>
                                <MaterialCommunityIcons name="close" size={24} color={THEME.textSecondary} />
                            </TouchableOpacity>
                            {/* Machine Image */}
                            {machine.image ? (
                                <Image
                                    source={{ uri: machine.image }}
                                    style={styles.modalImage}
                                    contentFit="cover"
                                />
                            ) : (
                                <View style={[styles.modalImage, styles.placeholderImage]}>
                                    <MaterialCommunityIcons name="gamepad-variant" size={64} color={THEME.textSecondary} />
                                </View>
                            )}

                            {/* Machine Info */}
                            <Text style={styles.modalTitle}>
                                {machine.name}
                                {` [${(extendedDetails?.shortname || generateAbbreviation(machine.name)).toUpperCase()}]`}
                            </Text>
                            <Text style={styles.modalSubtitle}>
                                {extendedDetails?.manufacturer_full_name || machine.manufacturer || 'Unknown Manufacturer'}
                                {/* Date Display */}
                                {(extendedDetails?.manufacture_date || machine.manufacture_date) ? (() => {
                                    const d = extendedDetails?.manufacture_date || machine.manufacture_date;
                                    if (!d) return '';
                                    // Try to parse YYYY-MM-DD
                                    if (d.match(/^\d{4}-\d{2}-\d{2}$/)) {
                                        const dateObj = new Date(d);
                                        // Format: "October 1994"
                                        return ` • ${dateObj.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`;
                                    }
                                    return ` • ${d}`;
                                })() : ''}
                            </Text>

                            {/* Extended Info */}
                            {extendedDetails && (
                                <View style={styles.extendedInfo}>
                                    <View style={styles.infoStats}>
                                        {extendedDetails.type && (
                                            <View style={styles.infoBadge}>
                                                <Text style={styles.infoBadgeText}>
                                                    {ACRONYMS[extendedDetails.type.toLowerCase()] || extendedDetails.type.toUpperCase()}
                                                </Text>
                                            </View>
                                        )}
                                        {extendedDetails.display && (
                                            <View style={styles.infoBadge}>
                                                <Text style={styles.infoBadgeText}>
                                                    {ACRONYMS[extendedDetails.display.toLowerCase()] || extendedDetails.display.toUpperCase()}
                                                </Text>
                                            </View>
                                        )}
                                        {extendedDetails.player_count && (
                                            <View style={styles.infoBadge}>
                                                <Text style={styles.infoBadgeText}>{extendedDetails.player_count} Players</Text>
                                            </View>
                                        )}
                                    </View>

                                    {extendedDetails.description ? (
                                        <Text style={styles.descriptionText}>{extendedDetails.description}</Text>
                                    ) : null}
                                </View>
                            )}

                            {/* AI Rules Summary */}
                            {rulesSummary && (
                                <View style={styles.rulesSummaryContainer}>
                                    <View style={styles.aiDisclaimer}>
                                        <MaterialCommunityIcons name="auto-fix" size={14} color={THEME.accent} />
                                        <Text style={styles.aiDisclaimerText}>AI Tips & Strategy</Text>
                                    </View>
                                    <Text style={styles.rulesSummaryText}>{rulesSummary.summary}</Text>

                                    {rulesSummary.key_shots && rulesSummary.key_shots.length > 0 && (
                                        <View style={styles.rulesSection}>
                                            <Text style={styles.rulesSectionTitle}>Key Shots</Text>
                                            <Text style={styles.rulesSectionContent}>
                                                {rulesSummary.key_shots.join(' • ')}
                                            </Text>
                                        </View>
                                    )}

                                    {rulesSummary.modes && rulesSummary.modes.length > 0 && (
                                        <View style={styles.rulesSection}>
                                            <Text style={styles.rulesSectionTitle}>Modes</Text>
                                            <Text style={styles.rulesSectionContent}>
                                                {rulesSummary.modes.join(' • ')}
                                            </Text>
                                        </View>
                                    )}

                                    {rulesSummary.scoring_tips && (
                                        <View style={styles.rulesSection}>
                                            <Text style={styles.rulesSectionTitle}>Scoring Tips</Text>
                                            <Text style={styles.rulesSectionContent}>
                                                {rulesSummary.scoring_tips}
                                            </Text>
                                        </View>
                                    )}
                                </View>
                            )}

                            {/* Rules Button */}
                            <TouchableOpacity
                                style={[styles.favoriteButton, { backgroundColor: '#457b9d', marginBottom: 12 }]}
                                onPress={() => {
                                    const url = getRulesLink(machine);
                                    Linking.openURL(url).catch(err => Alert.alert("Error", "Could not open rules link: " + url));
                                }}
                            >
                                <MaterialCommunityIcons
                                    name="book-open-page-variant"
                                    size={20}
                                    color="#fff"
                                />
                                <Text style={styles.favoriteButtonText}>Read Rules</Text>
                            </TouchableOpacity>

                            {/* Toggle Favorites Button */}
                            <TouchableOpacity
                                style={[
                                    styles.favoriteButton,
                                    favoriteIds.has(machine.opdb_id || '') ? { backgroundColor: '#e63946' } : {}
                                ]}
                                onPress={() => onToggleFavorite(machine)}
                                disabled={isSaving}
                            >
                                <MaterialCommunityIcons
                                    name={favoriteIds.has(machine.opdb_id || '') ? "heart-minus" : "heart-plus"}
                                    size={20}
                                    color="#fff"
                                />
                                <Text style={styles.favoriteButtonText}>
                                    {isSaving ? 'Saving...' : favoriteIds.has(machine.opdb_id || '') ? 'Remove from Favorites' : 'Add to Favorites'}
                                </Text>

                            </TouchableOpacity>
                        </>
                    )}
                </Pressable>
            </Pressable>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    modalContent: {
        backgroundColor: THEME.card,
        borderRadius: 20,
        padding: 24,
        width: '100%',
        maxWidth: 340,
        alignItems: 'center',
    },
    modalImage: {
        width: 200,
        height: 200,
        borderRadius: 16,
        marginBottom: 20,
    },
    placeholderImage: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: THEME.text,
        textAlign: 'center',
        marginBottom: 8,
    },
    modalSubtitle: {
        fontSize: 16,
        color: THEME.textSecondary,
        textAlign: 'center',
        marginBottom: 24,
    },
    favoriteButton: {
        backgroundColor: THEME.accent,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        paddingHorizontal: 24,
        borderRadius: 12,
        width: '100%',
        gap: 8,
        marginBottom: 12,
    },
    favoriteButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    extendedInfo: {
        width: '100%',
        marginBottom: 20,
        gap: 12,
    },
    infoStats: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: 8,
    },
    infoBadge: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    infoBadgeText: {
        color: THEME.textSecondary,
        fontSize: 12,
        fontWeight: 'bold',
    },
    descriptionText: {
        color: THEME.textSecondary,
        fontSize: 14,
        lineHeight: 20,
        textAlign: 'center',
        fontStyle: 'italic',
    },
    rulesSummaryContainer: {
        width: '100%',
        backgroundColor: 'rgba(0,180,216,0.08)',
        borderRadius: 12,
        padding: 16,
        marginTop: 16,
        marginBottom: 8,
    },
    aiDisclaimer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    aiDisclaimerText: {
        color: THEME.accent,
        fontSize: 11,
        fontWeight: '600',
        marginLeft: 6,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    rulesSummaryText: {
        color: THEME.text,
        fontSize: 14,
        lineHeight: 20,
        marginBottom: 12,
    },
    rulesSection: {
        marginTop: 8,
    },
    rulesSectionTitle: {
        color: THEME.accent,
        fontSize: 12,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    rulesSectionContent: {
        color: THEME.textSecondary,
        fontSize: 13,
        lineHeight: 18,
    },
});
