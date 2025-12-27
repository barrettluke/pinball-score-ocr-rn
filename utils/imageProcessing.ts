import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { Image } from 'react-native';

/**
 * Processes the captured image:
 * 1. Crops to the center "score box" area (10% x 40% -> 80% width, 15% height).
 * 2. Applies Grayscale (via resize, since direct grayscale isn't supported).
 */
export const processScoreImage = async (uri: string, _providedWidth: number, _providedHeight: number) => {
    try {
        // 1. Get ACTUAL dimensions from the file to avoid orientation mismatches (Camera vs File)
        const { width, height } = await new Promise<{ width: number; height: number }>((resolve, reject) => {
            Image.getSize(uri, (w, h) => resolve({ width: w, height: h }), reject);
        });

        // Overlay logic: x: 10%, y: 40%, w: 80%, h: 15%

        // Strict clamping
        const originX = Math.max(0, Math.round(width * 0.1));
        const originY = Math.max(0, Math.round(height * 0.4));

        const targetWidth = Math.round(width * 0.8);
        const cropWidth = Math.min(targetWidth, width - originX);

        const targetHeight = Math.round(height * 0.15);
        const cropHeight = Math.min(targetHeight, height - originY);

        if (cropWidth <= 0 || cropHeight <= 0) {
            console.warn(`Invalid crop: ${cropWidth}x${cropHeight} for ${width}x${height}`);
            return uri;
        }

        const cropRegion = {
            originX,
            originY,
            width: cropWidth,
            height: cropHeight,
        };

        console.log(`Cropping ${width}x${height} image with:`, JSON.stringify(cropRegion));

        const result = await manipulateAsync(
            uri,
            [
                { crop: cropRegion },
                { resize: { width: 800 } }
            ],
            { compress: 1, format: SaveFormat.JPEG }
        );
        return result.uri;
    } catch (e) {
        console.error('Image Processing Error:', e);
        return uri;
    }
};
