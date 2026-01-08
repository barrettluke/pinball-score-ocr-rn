import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { getDatabase } from '../../utils/database';
import { fetchMachineDetails, getTopManufacturers, OPDBMachine, OPDBMachineDetails, searchMachines } from '../../utils/opdb';

const THEME = {
    background: '#0d1b2a',
    card: '#1b263b',
    accent: '#00b4d8',
    text: '#e0e1dd',
    textSecondary: '#778da9',
    success: '#28a745',
};

const ACRONYMS: Record<string, string> = {
    'ss': 'Solid State (Electronic)',
    'em': 'Electro-Mechanical (Reels)',
    'dmd': 'Dot Matrix Display',
    'lcd': 'Liquid Crystal Display (Modern)',
    'alphanumeric': 'Alphanumeric (Early Digital)',
    'reels': 'Mechanical Reels'
};


// Helper to generate a guessed abbreviation (e.g. "The Addams Family" -> "TAF")
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

export default function SearchScreen() {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<OPDBMachine[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedMachine, setSelectedMachine] = useState<OPDBMachine | null>(null);
    const [extendedDetails, setExtendedDetails] = useState<OPDBMachineDetails | null>(null);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [savingMachineId, setSavingMachineId] = useState<string | null>(null);
    const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
    const [activeFilter, setActiveFilter] = useState('All');

    // Dynamic Manufacturers
    const [allManufacturers, setAllManufacturers] = useState<{ label: string; query: string; count?: number }[]>([]);
    const [visibleChips, setVisibleChips] = useState<{ label: string; query: string }[]>([
        { label: 'All', query: '' },
        { label: 'Favorites', query: 'FAV' }
    ]);

    // Modal State
    const [isManufacturerModalVisible, setIsManufacturerModalVisible] = useState(false);
    const [manufacturerSearch, setManufacturerSearch] = useState('');
    const [isGlossaryVisible, setIsGlossaryVisible] = useState(false);

    // Load manufacturers on mount
    useFocusEffect(
        useCallback(() => {
            loadManufacturers();
            loadFavoriteIds();
        }, [])
    );

    // Load favorite IDs to know which machines are already favorited
    const loadFavoriteIds = async () => {
        try {
            const db = await getDatabase();
            const rows: { opdb_id: string }[] = await db.getAllAsync('SELECT opdb_id FROM machines');
            setFavoriteIds(new Set(rows.map(r => r.opdb_id)));
        } catch (e) {
            console.error('Error loading favorite IDs:', e);
        }
    };

    const loadManufacturers = async () => {
        // Optimistically keep All/Fav
        const dynamic = await getTopManufacturers();

        const seen = new Set<string>();
        const cleaned: { label: string; query: string; count: number }[] = [];

        for (const m of dynamic) {
            // Clean names: "Stern Pinball" -> "Stern", "Jersey Jack Pinball" -> "Jersey Jack"
            const label = m.label.replace(' Pinball', '').replace(' Electronics', '').replace(' Manufacturing', '').trim();

            if (!seen.has(label)) {
                seen.add(label);
                // Use the cleaned label as the query so "Stern" matches "%Stern%" (capturing both Pinball/Electronics)
                cleaned.push({
                    label,
                    query: label,
                    count: m.count
                });
            }
        }

        setAllManufacturers(cleaned);
    };

    // Update visible chips when manufacturers load
    useFocusEffect(
        useCallback(() => {
            const top = allManufacturers.slice(0, 5);
            setVisibleChips([
                { label: 'All', query: '' },
                { label: 'Favorites', query: 'FAV' },
                ...top,
                { label: 'More...', query: 'MORE' }
            ]);
        }, [allManufacturers])
    );

    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(true);

    const fetchMachines = async (searchQuery: string, filter: string, pageToFetch: number, append: boolean = false) => {
        if (!append) setLoading(true);

        try {
            const limit = 50;
            // Determine effective filter
            const effectiveFilter = filter === 'All' || filter === 'Favorites' ? undefined : filter;

            const machines = await searchMachines(searchQuery, effectiveFilter, pageToFetch, limit);

            if (append) {
                setResults(prev => [...prev, ...machines]);
            } else {
                setResults(machines);
            }
            // If we got fewer than limit, no more pages
            setHasMore(machines.length === limit);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    // Debounced Search Effect
    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            handleSearch(query);
        }, 600);

        return () => clearTimeout(delayDebounceFn);
    }, [query]);

    const handleSearch = async (searchQuery?: string, manufacturerQuery?: string) => {
        const q = searchQuery ?? query;
        // Reset pagination but keep old results visible during load
        setPage(0);
        setHasMore(true);
        // Don't clear results here - let fetchMachines replace them smoothly

        // If Favorites, load local
        if (activeFilter === 'Favorites' && !manufacturerQuery) {
            loadSavedMachines();
            return;
        }

        // Otherwise fetch remote
        // Note: manufacturerQuery is passed from filter tap. If null, use activeFilter's query? 
        // Logic complication: activeFilter state might not be updated yet if called from tap.
        // We rely on args.

        let filterStr = manufacturerQuery;
        if (!filterStr && activeFilter !== 'All' && activeFilter !== 'Favorites') {
            // Find current active filter query
            const m = allManufacturers.find(m => m.label === activeFilter);
            filterStr = m?.query;
        }

        await fetchMachines(q, filterStr || '', 0, false);
    };

    const loadMore = () => {
        if (loading || !hasMore || activeFilter === 'Favorites') return;
        const nextPage = page + 1;
        setPage(nextPage);

        // Resolve filter
        let filterStr = '';
        if (activeFilter !== 'All' && activeFilter !== 'Favorites') {
            const m = allManufacturers.find(m => m.label === activeFilter);
            filterStr = m?.query || '';
        }

        fetchMachines(query, filterStr, nextPage, true);
    };

    // Load saved machines from local database (Favorites)
    const loadSavedMachines = async () => {
        try {
            setLoading(true);
            setHasMore(false); // No pagination for local favorites currently
            const db = await getDatabase();
            const saved: any[] = await db.getAllAsync(
                'SELECT opdb_id, name, manufacturer, year, image_url FROM machines ORDER BY name'
            );
            setResults(saved.map(m => ({
                opdb_id: m.opdb_id,
                name: m.name,
                manufacturer: m.manufacturer,
                manufacture_date: m.year,
                image: m.image_url
            })));
        } catch (e) {
            console.error('Error loading saved machines:', e);
        } finally {
            setLoading(false);
        }
    };

    // Load saved machines on mount and when returning to screen
    useFocusEffect(
        useCallback(() => {
            if (activeFilter === 'All') {
                // Load All (Browse)
                handleSearch('', '');
            } else if (activeFilter === 'Favorites') {
                loadSavedMachines();
            }
        }, [activeFilter])
    );

    const handleFilterTap = (manufacturer: { label: string; query: string }) => {
        if (manufacturer.label === 'More...') {
            setIsManufacturerModalVisible(true);
            return;
        }

        setIsManufacturerModalVisible(false);
        setActiveFilter(manufacturer.label);
        setQuery(''); // Always clear text on filter change

        if (manufacturer.label === 'Favorites') {
            loadSavedMachines();
        } else if (manufacturer.label === 'All') {
            // Browse All Mode
            handleSearch('', ''); // Empty query, empty filter
        } else {
            handleSearch('', manufacturer.query);
        }
    };

    const handleMachineTap = async (machine: OPDBMachine) => {
        setSelectedMachine(machine);
        setExtendedDetails(null); // Reset
        setIsModalVisible(true);

        // Fetch full details
        const details = await fetchMachineDetails(machine.opdb_id);
        if (details && details.opdb_id === machine.opdb_id) {
            setExtendedDetails(details);
        }
    };

    const handleAddFavorite = async (machine: OPDBMachine, fromList: boolean = false) => {
        if (!machine) return;

        setIsSaving(true);
        setSavingMachineId(machine.opdb_id);

        const isAlreadyFavorite = favoriteIds.has(machine.opdb_id);

        try {
            const db = await getDatabase();

            if (isAlreadyFavorite) {
                // Remove from favorites
                await db.runAsync('DELETE FROM machines WHERE opdb_id = ?', machine.opdb_id);
                // Update local state
                setFavoriteIds(prev => {
                    const next = new Set(prev);
                    next.delete(machine.opdb_id);
                    return next;
                });
                // Refresh list if viewing Favorites
                if (activeFilter === 'Favorites') {
                    loadSavedMachines();
                }
            } else {
                // Add to favorites
                await db.runAsync(
                    'INSERT OR REPLACE INTO machines (opdb_id, name, manufacturer, year, image_url) VALUES (?, ?, ?, ?, ?)',
                    machine.opdb_id,
                    machine.name,
                    machine.manufacturer,
                    machine.manufacture_date,
                    machine.image || null
                );
                // Update local state
                setFavoriteIds(prev => new Set(prev).add(machine.opdb_id));

                if (!fromList) {
                    Alert.alert('Added!', `${machine.name} has been added to your favorites!`);
                    setIsModalVisible(false);
                    setSelectedMachine(null);
                }
            }
        } catch (error) {
            console.error(error);
            Alert.alert('Error', isAlreadyFavorite ? 'Failed to remove machine.' : 'Failed to save machine.');
        } finally {
            setIsSaving(false);
            setSavingMachineId(null);
        }
    };

    const closeModal = () => {
        setIsModalVisible(false);
        setSelectedMachine(null);
    };

    return (
        <View style={styles.container}>
            {/* Page Title */}
            <View style={styles.headerRow}>
                <Text style={styles.pageTitle}>Machines</Text>
                <TouchableOpacity onPress={() => setIsGlossaryVisible(true)} style={styles.infoButton}>
                    <MaterialCommunityIcons name="information-variant" size={20} color={THEME.textSecondary} />
                </TouchableOpacity>
            </View>

            <View style={styles.searchBar}>
                <View style={styles.searchContainer}>
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search for a machine..."
                        placeholderTextColor="#778da9"
                        value={query}
                        onChangeText={setQuery}
                        onSubmitEditing={() => handleSearch()}
                        returnKeyType="search"
                        autoCorrect={false}
                    />
                    {query.length > 0 && (
                        <TouchableOpacity onPress={() => setQuery('')} style={styles.clearButton}>
                            <MaterialCommunityIcons name="close-circle" size={20} color={THEME.textSecondary} />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* Manufacturer Filter Chips */}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.filterContainer}
                contentContainerStyle={styles.filterContent}
            >
                {visibleChips.map((manufacturer) => (
                    <TouchableOpacity
                        key={manufacturer.label}
                        style={[
                            styles.filterChip,
                            activeFilter === manufacturer.label && styles.filterChipActive
                        ]}
                        onPress={() => handleFilterTap(manufacturer)}
                    >
                        <Text style={[
                            styles.filterChipText,
                            activeFilter === manufacturer.label && styles.filterChipTextActive
                        ]}>
                            {manufacturer.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            {loading && page === 0 && results.length === 0 ? (
                <View style={styles.loaderContainer}>
                    <ActivityIndicator size="large" color={THEME.accent} />
                </View>
            ) : (
                <View style={{ flex: 1, width: '100%' }}>
                    <FlashList
                        data={results}
                        estimatedItemSize={76}
                        keyExtractor={(item) => item.opdb_id}
                        onEndReached={loadMore}
                        onEndReachedThreshold={0.5}
                        ListFooterComponent={loading && page > 0 ? <ActivityIndicator color={THEME.accent} style={{ margin: 20 }} /> : null}
                        renderItem={({ item }) => {
                            const isFavorited = favoriteIds.has(item.opdb_id);
                            const isSavingThis = savingMachineId === item.opdb_id;
                            return (
                                <TouchableOpacity style={styles.item} onPress={() => handleMachineTap(item)}>
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
                                                handleAddFavorite(item, true);
                                            }}
                                            disabled={isSavingThis}
                                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                        >
                                            {isSavingThis ? (
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
                        }}
                        keyboardShouldPersistTaps="handled"
                        contentContainerStyle={styles.listContent}
                        ListEmptyComponent={
                            !loading ? <Text style={styles.empty}>No results found.</Text> : null
                        }
                    />
                </View>
            )}

            {/* Machine Detail Modal */}
            <Modal
                visible={isModalVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={closeModal}
            >
                <Pressable style={styles.modalOverlay} onPress={closeModal}>
                    <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
                        {selectedMachine && (
                            <>
                                <TouchableOpacity style={{ position: 'absolute', top: 16, right: 16, zIndex: 10 }} onPress={closeModal}>
                                    <MaterialCommunityIcons name="close" size={24} color={THEME.textSecondary} />
                                </TouchableOpacity>
                                {/* Machine Image */}
                                {selectedMachine.image ? (
                                    <Image
                                        source={{ uri: selectedMachine.image }}
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
                                    {selectedMachine.name}
                                    {` [${(extendedDetails?.shortname || generateAbbreviation(selectedMachine.name)).toUpperCase()}]`}
                                </Text>
                                <Text style={styles.modalSubtitle}>
                                    {extendedDetails?.manufacturer_full_name || selectedMachine.manufacturer || 'Unknown Manufacturer'}
                                    {/* Date Display */}
                                    {(extendedDetails?.manufacture_date || selectedMachine.manufacture_date) ? (() => {
                                        const d = extendedDetails?.manufacture_date || selectedMachine.manufacture_date;
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

                                {/* Rules Button */}
                                <TouchableOpacity
                                    style={[styles.favoriteButton, { backgroundColor: '#457b9d', marginBottom: 12 }]}
                                    onPress={() => {
                                        const url = getRulesLink(selectedMachine);
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

                                {/* Add to Favorites Button */}
                                <TouchableOpacity
                                    style={styles.favoriteButton}
                                    onPress={() => handleAddFavorite(selectedMachine!)}
                                    disabled={isSaving || favoriteIds.has(selectedMachine?.opdb_id || '')}
                                >
                                    <MaterialCommunityIcons
                                        name="heart-plus"
                                        size={20}
                                        color="#fff"
                                    />
                                    <Text style={styles.favoriteButtonText}>
                                        {isSaving ? 'Saving...' : 'Add to Favorites'}
                                    </Text>

                                </TouchableOpacity>
                            </>
                        )}
                    </Pressable>
                </Pressable>
            </Modal>

            {/* Manufacturer Selection Modal */}
            <Modal
                visible={isManufacturerModalVisible}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => setIsManufacturerModalVisible(false)}
            >
                <View style={styles.fullScreenModal}>
                    <View style={styles.modalHeaderRow}>
                        <Text style={styles.modalHeaderTitle}>Select Manufacturer</Text>
                        <TouchableOpacity onPress={() => setIsManufacturerModalVisible(false)} style={styles.closeIcon}>
                            <MaterialCommunityIcons name="close" size={28} color={THEME.text} />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.modalSearchContainer}>
                        <View style={[styles.searchContainer, { flex: 0, width: '100%' }]}>
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Find a manufacturer..."
                                placeholderTextColor="#778da9"
                                value={manufacturerSearch}
                                onChangeText={setManufacturerSearch}
                                autoFocus
                            />
                            {manufacturerSearch.length > 0 && (
                                <TouchableOpacity onPress={() => setManufacturerSearch('')} style={styles.clearButton}>
                                    <MaterialCommunityIcons name="close-circle" size={20} color={THEME.textSecondary} />
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>

                    <FlashList
                        data={allManufacturers.filter(m => m.label.toLowerCase().includes(manufacturerSearch.toLowerCase()))}
                        keyExtractor={(item) => item.label}
                        estimatedItemSize={60}
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                style={styles.manufacturerItem}
                                onPress={() => handleFilterTap(item)}
                            >
                                <Text style={styles.manufacturerName}>{item.label}</Text>
                                {item.count && (
                                    <View style={styles.countBadge}>
                                        <Text style={styles.countText}>{item.count}</Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                        )}
                        contentContainerStyle={{ padding: 16 }}
                        keyboardShouldPersistTaps="handled"
                    />
                </View>
            </Modal>

            {/* Glossary Modal */}
            <Modal
                visible={isGlossaryVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setIsGlossaryVisible(false)}
            >
                <Pressable style={styles.modalOverlay} onPress={() => setIsGlossaryVisible(false)}>
                    <Pressable style={styles.modalContent} onPress={e => e.stopPropagation()}>
                        <TouchableOpacity style={{ position: 'absolute', top: 16, right: 16, zIndex: 10 }} onPress={() => setIsGlossaryVisible(false)}>
                            <MaterialCommunityIcons name="close" size={24} color={THEME.textSecondary} />
                        </TouchableOpacity>

                        <Text style={[styles.modalTitle, { marginTop: 8 }]}>Glossary</Text>
                        <Text style={[styles.modalSubtitle, { marginBottom: 16 }]}>What do these codes mean?</Text>

                        <ScrollView style={{ width: '100%', maxHeight: 300 }}>
                            {Object.entries(ACRONYMS).map(([key, desc]) => (
                                <View key={key} style={styles.glossaryItem}>
                                    <View style={styles.glossaryBadge}>
                                        <Text style={styles.glossaryBadgeText}>{key.toUpperCase()}</Text>
                                    </View>
                                    <Text style={styles.glossaryText}>{desc}</Text>
                                </View>
                            ))}
                        </ScrollView>
                    </Pressable>
                </Pressable>
            </Modal>


        </View >
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 16,
        backgroundColor: THEME.background,
        paddingTop: 60,
    },
    loadingBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8,
        backgroundColor: 'rgba(0,180,216,0.1)',
        borderRadius: 8,
        marginBottom: 8,
    },
    pageTitle: {
        color: '#fff',
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 16,
    },
    searchBar: {
        flexDirection: 'row',
        marginBottom: 12,
        gap: 12,
    },
    filterContainer: {
        marginBottom: 16,
        minHeight: 40,
        flexGrow: 0,
    },
    filterContent: {
        gap: 8,
        paddingHorizontal: 4, // Add some padding so shadow doesn't clip
    },
    filterChip: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        backgroundColor: THEME.card,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    filterChipActive: {
        backgroundColor: THEME.accent,
        borderColor: THEME.accent,
    },
    filterChipText: {
        color: THEME.textSecondary,
        fontSize: 13,
        lineHeight: 18,
        fontWeight: '600',
    },
    filterChipTextActive: {
        color: '#fff',
    },
    searchContainer: {
        flex: 1,
        height: 50,
        backgroundColor: THEME.card,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
    },
    searchInput: {
        flex: 1,
        height: '100%',
        color: THEME.text,
        fontSize: 16,
    },
    clearButton: {
        padding: 4,
    },

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
        width: 50,
        height: 50,
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
    empty: {
        textAlign: 'center',
        color: THEME.textSecondary,
        marginTop: 40,
        fontSize: 16,
    },
    // Modal Styles
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
    closeButton: {
        paddingVertical: 12,
    },
    closeButtonText: {
        color: THEME.textSecondary,
        fontSize: 16,
    },
    // Extended Info Styles
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
    // Manufacturer Modal Styles
    fullScreenModal: {
        flex: 1,
        backgroundColor: THEME.background,
    },
    modalHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        paddingTop: 50, // Increased for safe area
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.1)',
    },
    modalHeaderTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    closeIcon: {
        padding: 4,
    },
    modalSearchContainer: {
        padding: 16,
    },
    manufacturerItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.05)',
    },
    manufacturerName: {
        color: THEME.text,
        fontSize: 16,
    },
    countBadge: {
        backgroundColor: THEME.card,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 10,
    },
    countText: {
        color: THEME.textSecondary,
        fontSize: 12,
        fontWeight: 'bold',
    },
    // New Header & Glossary Styles
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    infoButton: {
        padding: 8,
    },
    glossaryItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        backgroundColor: 'rgba(255,255,255,0.05)',
        padding: 10,
        borderRadius: 8,
    },
    glossaryBadge: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        marginRight: 12,
        minWidth: 50,
        alignItems: 'center',
    },
    glossaryBadgeText: {
        color: THEME.textSecondary,
        fontSize: 12,
        fontWeight: 'bold',
    },
    glossaryText: {
        color: THEME.text,
        fontSize: 14,
        flex: 1,
    },
    loaderContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingTop: 50,
    },
    listContent: {
        paddingBottom: 20,
    },
});
