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
        const candidates: string[] = [];
        let finalImageUri = '';

        // BURST CAPTURE: Take 3 photos
        for (let i = 0; i < 3; i++) {
          const photo = await cameraRef.current.takePictureAsync({
            quality: 1,
            base64: false,
            exif: false,
            skipProcessing: true // specific to expo-camera (v5+) to speed up slightly if available, else ignored
          });

          if (photo?.uri) {
            // Store the last one to use for display
            finalImageUri = photo.uri;

            // Process & OCR immediately (or waiting until all 3 captured might trigger UI freeze? 
            // Doing it sequentially here for simplicity, or parallel promises if speed needed)
            try {
              const processedUri = await processScoreImage(photo.uri, photo.width, photo.height);
              finalImageUri = processedUri; // Prefer showing the processed one

              const result = await TextRecognition.recognize(processedUri);
              const rawText = result.text.match(/\d+/g)?.join('') || '';
              if (rawText) candidates.push(rawText);
            } catch (err) {
              console.warn('Frame processing failed', err);
            }
          }
          // Scan delay (optional, but camera might need ms to reset)
          await new Promise(r => setTimeout(r, 100));
        }

        const consensus = findConsensus(candidates);
        console.log('Candidates:', candidates, 'Consensus:', consensus);

        if (finalImageUri) {
          router.push({
            pathname: '/verify-score',
            params: { imageUri: finalImageUri, ocrValue: consensus }
          });
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
