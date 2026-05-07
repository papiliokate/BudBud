const fs = require('fs');
const path = require('path');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffmpeg = require('fluent-ffmpeg');

ffmpeg.setFfmpegPath(ffmpegPath);

const ASSETS_DIR = path.join(__dirname, 'public', 'assets');
const TEMP_DIR = path.join(__dirname, 'public', 'assets_temp');

if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR);
}

const files = fs.readdirSync(ASSETS_DIR).filter(f => f.endsWith('.png'));

async function processFile(file) {
    return new Promise((resolve, reject) => {
        const inputPath = path.join(ASSETS_DIR, file);
        const outputPath = path.join(TEMP_DIR, file);
        let filter = '';

        if (file.startsWith('emoji_')) {
            filter = 'scale=110:110';
        } else if (file.startsWith('bud_')) {
            filter = 'scale=260:260';
        } else if (file === 'miro_heart.png') {
            filter = 'scale=300:300';
        } else {
            // Keep original size for bg.png or others, but compress
            filter = 'scale=iw:ih';
        }

        ffmpeg(inputPath)
            .outputOptions([
                '-vf', filter
            ])
            .save(outputPath)
            .on('end', () => {
                const origSize = fs.statSync(inputPath).size;
                const newSize = fs.statSync(outputPath).size;
                console.log(`Processed ${file}: ${(origSize/1024).toFixed(1)}KB -> ${(newSize/1024).toFixed(1)}KB`);
                resolve(outputPath);
            })
            .on('error', (err) => {
                console.error(`Error processing ${file}:`, err);
                reject(err);
            });
    });
}

async function run() {
    console.log(`Found ${files.length} PNG files. Starting optimization...`);
    for (const file of files) {
        try {
            await processFile(file);
        } catch (e) {
            console.error("Failed on", file);
        }
    }
    
    console.log("Replacing original files...");
    for (const file of files) {
        const tempPath = path.join(TEMP_DIR, file);
        const origPath = path.join(ASSETS_DIR, file);
        if (fs.existsSync(tempPath)) {
            fs.copyFileSync(tempPath, origPath);
            fs.unlinkSync(tempPath);
        }
    }
    fs.rmdirSync(TEMP_DIR);
    console.log("Optimization complete!");
}

run();
