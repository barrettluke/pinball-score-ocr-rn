import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, Mask, Rect } from 'react-native-svg';

export default function CameraOverlay() {
    return (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <Svg height="100%" width="100%">
                <Defs>
                    <Mask id="mask" x="0" y="0" height="100%" width="100%">
                        <Rect height="100%" width="100%" fill="#fff" />
                        <Rect x="10%" y="40%" width="80%" height="15%" rx="10" ry="10" fill="#000" />
                    </Mask>
                </Defs>
                <Rect height="100%" width="100%" fill="rgba(0, 0, 0, 0.8)" mask="url(#mask)" />
                <Rect x="10%" y="40%" width="80%" height="15%" rx="10" ry="10" stroke="#00FF00" strokeWidth="2" fill="transparent" />
            </Svg>
            <View style={styles.textContainer}>
                <Text style={styles.text}>Align Score Here</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    textContainer: {
        position: 'absolute',
        top: '35%',
        width: '100%',
        alignItems: 'center',
    },
    text: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
        textShadowColor: 'rgba(0, 0, 0, 0.75)',
        textShadowOffset: { width: -1, height: 1 },
        textShadowRadius: 10,
    },
});
