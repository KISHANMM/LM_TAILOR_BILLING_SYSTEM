import sharp from 'sharp';
import fs from 'fs';

const sourceImg = 'C:\\Users\\Kishan\\.gemini\\antigravity\\brain\\26d67cd2-4480-4dd2-9f67-776a8262af2e\\lm_tailor_logo_1772811187435.png';

async function generate() {
    try {
        await sharp(sourceImg)
            .resize(192, 192)
            .toFormat('png')
            .toFile('./public/pwa-192x192.png');
        console.log('✅ pwa-192x192.png generated');

        await sharp(sourceImg)
            .resize(512, 512)
            .toFormat('png')
            .toFile('./public/pwa-512x512.png');
        console.log('✅ pwa-512x512.png generated');

        await sharp(sourceImg)
            .resize(180, 180)
            .toFormat('png')
            .toFile('./public/apple-touch-icon.png');
        console.log('✅ apple-touch-icon.png generated');

    } catch (err) {
        console.error('Error generating icons:', err);
    }
}

generate();
