import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { THEME } from '../constants/theme';



const ACRONYMS: Record<string, string> = {
    'ss': 'Solid State (Electronic)',
    'em': 'Electro-Mechanical (Reels)',
    'dmd': 'Dot Matrix Display',
    'lcd': 'Liquid Crystal Display (Modern)',
    'alphanumeric': 'Alphanumeric (Early Digital)',
    'reels': 'Mechanical Reels'
};

interface GlossaryModalProps {
    visible: boolean;
    onClose: () => void;
}

export const GlossaryModal = ({ visible, onClose }: GlossaryModalProps) => {
    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="fade"
            onRequestClose={onClose}
        >
            <Pressable style={styles.modalOverlay} onPress={onClose}>
                <Pressable style={styles.modalContent} onPress={e => e.stopPropagation()}>
                    <TouchableOpacity style={{ position: 'absolute', top: 16, right: 16, zIndex: 10 }} onPress={onClose}>
                        <MaterialCommunityIcons name="close" size={24} color={THEME.textSecondary} />
                    </TouchableOpacity>

                    <Text style={[styles.modalTitle, { marginTop: 8 }]}>Glossary</Text>
                    <Text style={[styles.modalSubtitle, { marginBottom: 16 }]}>What do these codes mean?</Text>

                    <ScrollView style={{ width: '100%', maxHeight: 400 }} showsVerticalScrollIndicator={true}>
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
});
