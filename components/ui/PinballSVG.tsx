import * as React from 'react';
import Svg, { Path, SvgProps } from 'react-native-svg';

export function PinballSVG(props: SvgProps) {
    return (
        <Svg
            viewBox="0 0 512 512"
            fill="currentColor"
            {...props}
        >
            {/* 
        Recreation of the user's reference image (GiPinballFlipper style):
        - Ball top-left with a highlight/shadow detail
        - Flipper bottom-right, angled up-left, with a pivot hole
      */}

            {/* The Ball: Circle with a "shine" cutout (using a path for the shine visual) */}
            <Path d="M256 72 
               a 70 70 0 1 0 0 140 
               a 70 70 0 1 0 0 -140
               z 
               M220 100 
               a 40 40 0 0 1 50 10
               a 45 45 0 0 0 -60 50 
               a 45 45 0 0 1 10 -60
               z" />

            {/* The Flipper: Angled rounded bar with a pivot hole */}
            <Path d="M430 380 
               c 0 40 -30 70 -70 70 
               c -20 0 -40 -10 -50 -25
               L 150 300 
               c -20 -15 -20 -40 0 -55 
               c 15 -15 40 -15 55 0
               l 180 140 
               c 15 10 35 10 50 0 
               c 20 -15 45 -10 65 15
               z
               M385 390
               a 20 20 0 1 0 0 40
               a 20 20 0 1 0 0 -40
               z"
                fillRule="evenodd"
            />

        </Svg>
    );
}
