import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { FlashList } from '@shopify/flash-list';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { GlossaryModal } from '../../components/GlossaryModal';
import { MachineDetailsModal } from '../../components/MachineDetailsModal';
import { MachineListItem } from '../../components/MachineListItem';
import { NearbyMapSection } from '../../components/NearbyMapSection';
import { SEARCH_SCREEN } from '../../constants/strings';
import { THEME } from '../../constants/theme';
import { getDatabase } from '../../utils/database';
import { fetchMachineDetails, getTopManufacturers, OPDBMachine, OPDBMachineDetails, searchMachines } from '../../utils/opdb';
import { getRulesSummary, hasLocalRules, MachineRules, syncRulesSummaries } from '../../utils/rules';








const DOM_CONFIG = { matchContents: true };

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
    const [rulesSummary, setRulesSummary] = useState<MachineRules | null>(null);
    const [activeFilter, setActiveFilter] = useState('All');

    // Dynamic Manufacturers
    const [allManufacturers, setAllManufacturers] = useState<{ label: string; query: string; count?: number }[]>([]);
    const [visibleChips, setVisibleChips] = useState<{ label: string; query: string }[]>([
        { label: SEARCH_SCREEN.FILTERS.ALL, query: '' },
        { label: SEARCH_SCREEN.FILTERS.FAVORITES, query: 'FAV' }
    ]);

    // Modal State
    const [isManufacturerModalVisible, setIsManufacturerModalVisible] = useState(false);
    const [manufacturerSearch, setManufacturerSearch] = useState('');
    const [isGlossaryVisible, setIsGlossaryVisible] = useState(false);

    // Pinball Map State moved to NearbyMapSection


    // Load manufacturers on mount
    useFocusEffect(
        useCallback(() => {
            loadManufacturers();
            loadFavoriteIds();
            // Sync rules on first load if not cached
            hasLocalRules().then(has => {
                if (!has) syncRulesSummaries();
            });
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
                { label: SEARCH_SCREEN.FILTERS.ALL, query: '' },
                { label: SEARCH_SCREEN.FILTERS.FAVORITES, query: 'FAV' },
                ...top,
                { label: SEARCH_SCREEN.FILTERS.MORE, query: 'MORE' }
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
            const effectiveFilter = filter === SEARCH_SCREEN.FILTERS.ALL || filter === SEARCH_SCREEN.FILTERS.FAVORITES ? undefined : filter;

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
            loadSavedMachines(q);
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
    const loadSavedMachines = async (searchQuery: string = '') => {
        try {
            setLoading(true);
            setHasMore(false); // No pagination for local favorites currently
            const db = await getDatabase();

            let query = 'SELECT opdb_id, name, manufacturer, year, image_url FROM machines';
            const params: string[] = [];

            if (searchQuery.trim().length > 0) {
                query += ' WHERE name LIKE ?';
                params.push(`%${searchQuery.trim()}%`);
            }

            query += ' ORDER BY name';

            const saved: any[] = await db.getAllAsync(query, params);

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
            if (activeFilter === SEARCH_SCREEN.FILTERS.ALL) {
                // Load All (Browse)
                handleSearch('', '');
            } else if (activeFilter === SEARCH_SCREEN.FILTERS.FAVORITES) {
                loadSavedMachines();
            }
        }, [activeFilter])
    );

    const handleFilterTap = (manufacturer: { label: string; query: string }) => {
        if (manufacturer.label === SEARCH_SCREEN.FILTERS.MORE) {
            setIsManufacturerModalVisible(true);
            return;
        }

        setIsManufacturerModalVisible(false);
        setActiveFilter(manufacturer.label);
        setQuery(''); // Always clear text on filter change

        if (manufacturer.label === SEARCH_SCREEN.FILTERS.FAVORITES) {
            loadSavedMachines();
        } else if (manufacturer.label === SEARCH_SCREEN.FILTERS.ALL) {
            // Browse All Mode
            handleSearch('', ''); // Empty query, empty filter
        } else {
            handleSearch('', manufacturer.query);
        }
    };

    const handleMachineTap = async (machine: OPDBMachine) => {
        setSelectedMachine(machine);
        setExtendedDetails(null); // Reset
        setRulesSummary(null); // Reset rules
        setIsModalVisible(true);

        // Fetch full details and rules in parallel
        const [details, rules] = await Promise.all([
            fetchMachineDetails(machine.opdb_id),
            getRulesSummary(machine.opdb_id)
        ]);

        if (details && details.opdb_id === machine.opdb_id) {
            setExtendedDetails(details);
        }
        if (rules) {
            setRulesSummary(rules);
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
                    Alert.alert(SEARCH_SCREEN.ALERTS.ADDED_TITLE, `${machine.name}${SEARCH_SCREEN.ALERTS.ADDED_SUFFIX}`);
                    setIsModalVisible(false);
                    setSelectedMachine(null);
                }
            }
        } catch (error) {
            console.error(error);
            Alert.alert(SEARCH_SCREEN.ALERTS.ERROR_TITLE, isAlreadyFavorite ? SEARCH_SCREEN.ALERTS.REMOVE_ERROR : SEARCH_SCREEN.ALERTS.SAVE_ERROR);
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
                <Text style={styles.pageTitle}>{SEARCH_SCREEN.TITLE}</Text>
                <TouchableOpacity onPress={() => setIsGlossaryVisible(true)} style={styles.infoButton}>
                    <MaterialCommunityIcons name="information-variant" size={20} color={THEME.textSecondary} />
                </TouchableOpacity>
            </View>

            <View style={styles.searchBar}>
                <View style={styles.searchContainer}>
                    <TextInput
                        style={styles.searchInput}
                        placeholder={SEARCH_SCREEN.SEARCH_PLACEHOLDER}
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

            {/* Pinball Map View (only shown on Favorites) */}
            <NearbyMapSection isVisible={activeFilter === SEARCH_SCREEN.FILTERS.FAVORITES} />

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
                        renderItem={({ item }) => (
                            <MachineListItem
                                item={item}
                                isFavorited={favoriteIds.has(item.opdb_id)}
                                isSaving={savingMachineId === item.opdb_id}
                                onTap={handleMachineTap}
                                onFavorite={(m) => handleAddFavorite(m, true)}
                            />
                        )}
                        keyboardShouldPersistTaps="handled"
                        contentContainerStyle={styles.listContent}
                        ListEmptyComponent={
                            !loading ? <Text style={styles.empty}>{SEARCH_SCREEN.EMPTY_RESULT}</Text> : null
                        }
                    />
                </View>
            )}

            {/* Machine Detail Modal */}
            <MachineDetailsModal
                visible={isModalVisible}
                machine={selectedMachine}
                extendedDetails={extendedDetails}
                rulesSummary={rulesSummary}
                favoriteIds={favoriteIds}
                isSaving={isSaving}
                onClose={closeModal}
                onToggleFavorite={handleAddFavorite}
            />

            {/* Manufacturer Selection Modal */}
            <Modal
                visible={isManufacturerModalVisible}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => setIsManufacturerModalVisible(false)}
            >
                <View style={styles.fullScreenModal}>
                    <View style={styles.modalHeaderRow}>
                        <Text style={styles.modalHeaderTitle}>{SEARCH_SCREEN.MODALS.MANUFACTURER.TITLE}</Text>
                        <TouchableOpacity onPress={() => setIsManufacturerModalVisible(false)} style={styles.closeIcon}>
                            <MaterialCommunityIcons name="close" size={28} color={THEME.text} />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.modalSearchContainer}>
                        <View style={[styles.searchContainer, { flex: 0, width: '100%' }]}>
                            <TextInput
                                style={styles.searchInput}
                                placeholder={SEARCH_SCREEN.MODALS.MANUFACTURER.SEARCH_PLACEHOLDER}
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
            <GlossaryModal
                visible={isGlossaryVisible}
                onClose={() => setIsGlossaryVisible(false)}
            />


        </View >
    );
}

import { styles } from '../../styles/search.styles';

