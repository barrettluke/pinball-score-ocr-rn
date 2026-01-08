/**
 * formatters.ts - General purpose formatting utilities
 */

/**
 * Convert 24h time "17:00:00" to 12h "5:00 PM"
 */
export const formatTime12h = (time: string | undefined): string => {
    if (!time) return '';
    const [h, m] = time.split(':');
    const hour = parseInt(h, 10);
    if (isNaN(hour)) return time;
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${m} ${ampm}`;
};
