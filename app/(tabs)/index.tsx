import TextRecognition from '@react-native-ml-kit/text-recognition';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Button, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import CameraOverlay from '../../components/CameraOverlay';
import { findConsensus } from '../../utils/voting';

import { processScoreImage } from '../../utils/imageProcessing';

export default function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [processing, setProcessing] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  const router = useRouter();

  if (!permission) {
    return <View />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>We need your permission to show the camera</Text>
        <Button onPress={requestPermission} title="grant permission" />
      </View>
    );
  }

  const takePicture = async () => {
    if (cameraRef.current && !processing) {
      setProcessing(true);
      try {
        const capturedPhotos: string[] = [];

        // 1. BURST CAPTURE (Fast as possible)
        // User only needs to hold still during this phase (approx 200-300ms)
        for (let i = 0; i < 3; i++) {
          const photo = await cameraRef.current.takePictureAsync({
            quality: 1,
            base64: false,
            exif: false,
            skipProcessing: true
          });
          if (photo?.uri) {
            capturedPhotos.push(photo.uri);
          }
          // Tiny delay to ensure frames are slightly different (for de-noising/voting)
          await new Promise(r => setTimeout(r, 50));
        }

        // 2. PARALLEL PROCESSING
        // User can move phone now, we have the images.
        if (capturedPhotos.length > 0) {
          const processedResults = await Promise.all(capturedPhotos.map(async (uri) => {
            try {
              // A. Crop & Resize
              // Note: processScoreImage now internally checks Image.getSize ensures correct orientation/dimensions
              const processedUri = await processScoreImage(uri, 0, 0);

              // B. OCR
              const result = await TextRecognition.recognize(processedUri);
              const rawText = result.text.match(/\d+/g)?.join('') || '';

              return { uri: processedUri, text: rawText };
            } catch (e) {
              console.log('Frame processing error', e);
              return null;
            }
          }));

          // Filter valid results
          const validResults = processedResults.filter(r => r !== null) as { uri: string, text: string }[];
          const candidates = validResults.map(r => r.text).filter(t => t.length > 0);

          // Consensus
          const consensus = findConsensus(candidates);

          // SMART SELECTION: Find the specific image that gave us the winning score.
          // This ensures that if Frame 1 was perfect and Frame 3 was blurry, we show Frame 1.
          const bestResult = validResults.find(r => r.text === consensus);
          const finalImageUri = bestResult ? bestResult.uri : (validResults.length > 0 ? validResults[validResults.length - 1].uri : '');

          console.log('Candidates:', candidates, 'Consensus:', consensus, 'Selected Image:', finalImageUri);

          if (finalImageUri) {
            router.push({
              pathname: '/verify-score',
              params: { imageUri: finalImageUri, ocrValue: consensus }
            });
          }
        }

      } catch (e) {
        console.error(e);
      } finally {
        setProcessing(false);
      }
    }
  };

  return (
    <View style={styles.container}>
      <CameraView style={styles.camera} ref={cameraRef} facing="back" animateShutter={false}>
        <CameraOverlay />
        <View style={styles.buttonContainer}>
          <TouchableOpacity style={styles.captureButton} onPress={takePicture} disabled={processing}>
            {processing ? <ActivityIndicator color="#000" /> : <View style={styles.shutterInner} />}
          </TouchableOpacity>
        </View>
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
  },
  message: {
    textAlign: 'center',
    paddingBottom: 10,
  },
  camera: {
    flex: 1,
  },
  buttonContainer: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'transparent',
    marginBottom: 40,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  captureButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shutterInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: '#000',
    backgroundColor: '#fff',
  },
});
