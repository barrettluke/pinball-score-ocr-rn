export const EVENT_TABS = {
    ALL: 'All',
    LIVE: 'Live',
    UPCOMING: 'Upcoming',
    COMPLETED: 'Completed',
    MY_TOURNAMENTS: 'My Tournaments',
} as const;

export type EventTab = typeof EVENT_TABS[keyof typeof EVENT_TABS];

export const EVENTS_SCREEN = {
    TITLE: 'Find Events',
    SEARCH_PLACEHOLDER: 'Search loaded events...',
    EMPTY_TITLE: {
        LIVE: 'No Live events right now',
        MY_TOURNAMENTS: "You haven't joined any tournaments yet",
        NEARBY: 'No nearby events found for this filter',
        DEFAULT: 'No events found',
    },
    EMPTY_TEXT: {
        LIVE: 'Check back later or browse Upcoming events.',
        MY_TOURNAMENTS: 'Join a tournament on Matchplay to see it here.',
        NEARBY: 'Try switching tabs or disabling "Nearby Only".',
        DEFAULT: 'Try adjusting your search or tabs.',
    },
} as const;

export const SEARCH_SCREEN = {
    TITLE: 'Machines',
    SEARCH_PLACEHOLDER: 'Search for a machine...',
    EMPTY_RESULT: 'No results found.',
    FILTERS: {
        ALL: 'All',
        FAVORITES: 'Favorites',
        MORE: 'More...',
    },
    MODALS: {
        MANUFACTURER: {
            TITLE: 'Select Manufacturer',
            SEARCH_PLACEHOLDER: 'Find a manufacturer...',
        },
    },
    ALERTS: {
        ADDED_TITLE: 'Added!',
        ADDED_SUFFIX: ' has been added to your favorites!',
        ERROR_TITLE: 'Error',
        REMOVE_ERROR: 'Failed to remove machine.',
        SAVE_ERROR: 'Failed to save machine.',
    },
} as const;
