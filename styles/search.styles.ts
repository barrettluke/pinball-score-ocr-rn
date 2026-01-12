import { StyleSheet } from 'react-native';
import { THEME } from '../constants/theme';

export const styles = StyleSheet.create({
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
        backgroundColor: THEME.accentFade,
        borderRadius: 8,
        marginBottom: 8,
    },
    pageTitle: {
        color: THEME.white,
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
        borderColor: THEME.borderLight,
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
        color: THEME.white,
    },
    searchContainer: {
        flex: 1,
        height: 50,
        backgroundColor: THEME.card,
        borderWidth: 1,
        borderColor: THEME.borderLight,
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

    empty: {
        textAlign: 'center',
        color: THEME.textSecondary,
        marginTop: 40,
        fontSize: 16,
    },
    // Modal Styles
    // Manufacturer Modal Styles
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
        borderBottomColor: THEME.borderLight,
    },
    modalHeaderTitle: {
        color: THEME.white,
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
        borderBottomColor: THEME.itemBg,
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
        backgroundColor: THEME.itemBg,
        padding: 10,
        borderRadius: 8,
    },
    glossaryBadge: {
        backgroundColor: THEME.borderLight,
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
