import { StyleSheet } from 'react-native';
import { THEME } from '../constants/theme';

export const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: THEME.background,
        paddingTop: 60,
    },
    header: {
        paddingHorizontal: 16,
        marginBottom: 16,
    },
    searchContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: THEME.card,
        borderRadius: 8,
        paddingHorizontal: 12,
        height: 48,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    searchInput: {
        flex: 1,
        color: THEME.text,
        fontSize: 16,
    },
    clearButton: {
        padding: 4,
    },
    filterButton: {
        width: 48,
        height: 48,
        backgroundColor: THEME.card,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: THEME.borderLight,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        color: THEME.white,
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 16,
    },
    headerRight: {
        flexDirection: 'row',
        gap: 12,
    },
    searchIcon: {
        marginRight: 8,
    },
    listContent: {
        padding: 16,
    },
    loadingFooter: {
        paddingVertical: 20,
        alignItems: 'center',
    },
    emptyContainer: {
        alignItems: 'center',
        marginTop: 40,
        paddingHorizontal: 32,
    },
    emptyIcon: {
        marginBottom: 16,
        opacity: 0.5,
    },
    emptyTitle: {
        color: THEME.text,
        textAlign: 'center',
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 8,
    },
    emptyText: {
        color: THEME.textSecondary,
        textAlign: 'center',
        fontSize: 13,
    },
});
