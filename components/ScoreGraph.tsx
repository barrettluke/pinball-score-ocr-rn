import React from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import { LineChart } from 'react-native-chart-kit';

interface ScoreGraphProps {
    scores: { value: number; date: string }[];
    machineName: string;
}

export default function ScoreGraph({ scores, machineName }: ScoreGraphProps) {
    if (scores.length < 2) {
        return (
            <View style={styles.container}>
                <Text style={styles.title}>{machineName}</Text>
                <Text style={styles.placeholder}>Need at least 2 scores to visualize trend.</Text>
            </View>
        );
    }

    // Sort by date
    const sortedScores = [...scores].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Format labels (just show index or short date)
    const labels = sortedScores.map((_, index) => (index + 1).toString());
    const data = sortedScores.map((s) => s.value);

    return (
        <View style={styles.container}>
            <Text style={styles.title}>{machineName}</Text>
            <LineChart
                data={{
                    labels,
                    datasets: [{ data }],
                }}
                width={Dimensions.get('window').width - 32} // from react-native
                height={220}
                yAxisLabel=""
                yAxisSuffix=""
                yAxisInterval={1}
                chartConfig={{
                    backgroundColor: '#ffffff',
                    backgroundGradientFrom: '#ffffff',
                    backgroundGradientTo: '#ffffff',
                    decimalPlaces: 0,
                    color: (opacity = 1) => `rgba(0, 122, 255, ${opacity})`,
                    labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                    style: {
                        borderRadius: 16,
                    },
                    propsForDots: {
                        r: '4',
                        strokeWidth: '2',
                        stroke: '#007AFF',
                    },
                }}
                bezier
                style={{
                    marginVertical: 8,
                    borderRadius: 16,
                }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginBottom: 20,
        alignItems: 'center',
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 10,
    },
    placeholder: {
        fontStyle: 'italic',
        color: '#666',
    },
});
