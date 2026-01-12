import { StyleSheet } from 'react-native';
import { THEME } from '../constants/theme';

export const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: THEME.background,
        padding: 16,
        paddingTop: 60,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    greeting: {
        color: THEME.textSecondary,
        fontSize: 14,
    },
    username: {
        color: THEME.text,
        fontSize: 24,
        fontWeight: 'bold',
    },
    statsRow: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 24,
    },
    statCard: {
        flex: 1,
        backgroundColor: THEME.card,
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: THEME.itemBg,
    },
    statIconContainer: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: 'rgba(249, 199, 79, 0.2)', // Unique gold fade
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    statIconContainerAlt: {
        backgroundColor: 'rgba(0, 180, 216, 0.2)', // Unique blue fade
    },
    statLabel: {
        color: THEME.textSecondary,
        fontSize: 10,
        fontWeight: 'bold',
        letterSpacing: 1,
        marginBottom: 4,
    },
    statValue: {
        color: THEME.text,
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 2,
    },
    statSubtext: {
        color: THEME.textSecondary,
        fontSize: 12,
    },

    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    sectionTitle: {
        color: THEME.text,
        fontSize: 18,
        fontWeight: 'bold',
    },
    linkText: {
        color: THEME.accent,
        fontSize: 14,
        fontWeight: '600',
    },
    chartCard: {
        backgroundColor: THEME.card,
        borderRadius: 16,
        padding: 16,
        marginBottom: 32,
        overflow: 'hidden',
    },
    chartHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 24,
    },
    chartLabel: {
        color: THEME.textSecondary,
        fontSize: 14,
        marginBottom: 4,
    },
    chartValue: {
        color: THEME.text,
        fontSize: 32,
        fontWeight: 'bold',
    },
    badge: {
        backgroundColor: 'rgba(40, 167, 69, 0.2)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    badgeNegative: {
        backgroundColor: 'rgba(220, 53, 69, 0.2)',
    },
    badgeText: {
        color: THEME.success,
        fontSize: 12,
        fontWeight: 'bold',
    },
    badgeTextNegative: {
        color: '#dc3545',
    },
    chartFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 8,
    },
    chartFooterText: {
        color: THEME.textSecondary,
        fontSize: 10,
        fontWeight: 'bold',
    },
    chartStyle: {
        paddingRight: 0,
        paddingLeft: 0,
    },
    listCard: {
        backgroundColor: THEME.card,
        borderRadius: 12,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    listCardEmpty: {
        alignItems: 'center',
        padding: 20
    },
    emptyText: {
        color: THEME.textSecondary
    },
    machineIcon: {
        width: 50,
        height: 50,
        borderRadius: 8,
        backgroundColor: THEME.itemBg,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    machineImage: {
        width: '100%',
        height: '100%',
        borderRadius: 8,
    },
    listContent: {
        flex: 1,
    },
    listTitle: {
        color: THEME.text,
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 2,
    },
    listSubtitle: {
        color: THEME.accent,
        fontSize: 14,
        fontWeight: '600',
    },
    // Recent Activity Styles
    recentList: {
        marginBottom: 32,
    },
    recentItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: THEME.card,
        padding: 12,
        borderRadius: 12,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: THEME.itemBg,
    },
    recentDateBox: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 10,
        marginRight: 12,
        borderRightWidth: 1,
        borderRightColor: THEME.itemBg,
    },
    recentDateText: {
        color: THEME.textSecondary,
        fontSize: 12,
        fontWeight: 'bold',
    },
    recentTimeText: {
        color: THEME.textSecondary,
        fontSize: 10,
    },
    recentInfo: {
        flex: 1,
    },
    recentMachine: {
        color: THEME.text,
        fontSize: 14,
        fontWeight: 'bold',
        marginBottom: 2,
    },
    recentScore: {
        color: THEME.accent,
        fontSize: 14,
        fontWeight: 'bold',
    },
});
