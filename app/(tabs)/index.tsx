import TextRecognition, { TextRecognitionResult } from '@react-native-ml-kit/text-recognition';
import { Asset } from 'expo-asset';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import { Button, Image, Platform, ScrollView, StyleSheet, Text, View } from "react-native";

export default function Index() {
  const [result, setResult] = useState<TextRecognitionResult | null>(null);
  const [imageUri, setImageUri] = useState<string | null>(null);

  const recognizeText = async (uri: string) => {
    if (Platform.OS === 'web') {
      console.log("ML Kit is not supported on web");
      return;
    }
    try {
      const recognitionResult = await TextRecognition.recognize(uri);
      setResult(recognitionResult);
      console.log('Recognized text:', recognitionResult.text);
    } catch (error) {
      console.error("Error recognizing text:", error);
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 1,
    });

    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
      recognizeText(result.assets[0].uri);
    }
  };

  useEffect(() => {
    (async () => {
      // Load default asset for quick testing
      try {
        const imageAsset = Asset.fromModule(require('../../assets/images/react-logo.png')); // Default expo asset
        await imageAsset.downloadAsync();
        if (imageAsset.localUri) {
          // Don't auto-recognize default asset to keep UI clean, or do it if preferred.
          // setImageUri(imageAsset.localUri);
          // recognizeText(imageAsset.localUri);
        }
      } catch (e) {
        console.log("Error loading default asset", e);
      }
    })();
  }, []);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.header}>ML Kit OCR</Text>

      <Button title="Pick an Image" onPress={pickImage} />

      {imageUri && (
        <Image source={{ uri: imageUri }} style={styles.image} />
      )}

      {result ? (
        <View style={styles.resultContainer}>
          <Text style={styles.label}>Full Text:</Text>
          <Text style={styles.text}>{result.text}</Text>

          <Text style={styles.label}>Blocks:</Text>
          {result.blocks.map((block, index) => (
            <View key={index} style={styles.block}>
              <Text style={styles.blockText}>{block.text}</Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={{ marginTop: 20 }}>Select an image to recognize text.</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    alignItems: 'center',
    paddingTop: 60,
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  image: {
    width: 300,
    height: 300,
    resizeMode: 'contain',
    marginVertical: 20,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  resultContainer: {
    width: '100%',
  },
  label: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 10,
  },
  text: {
    fontSize: 16,
    marginBottom: 10,
    padding: 10,
    backgroundColor: '#eee',
  },
  block: {
    marginBottom: 5,
    padding: 5,
    backgroundColor: '#f9f9f9',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  blockText: {
    fontSize: 14,
  },
});
