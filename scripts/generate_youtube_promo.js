import puppeteer from 'puppeteer';
import { PuppeteerScreenRecorder } from 'puppeteer-screen-recorder';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const sleep = ms => new Promise(res => setTimeout(res, ms));

const RAW_VIDEO = path.resolve('raw_promo.mp4');
const FINAL_VIDEO = 'C:\\Users\\papil\\Downloads\\carousel_promo.mp4';

async function main() {
    console.log("Starting Vite for StudioHub...");
    const server = spawn('node', ['node_modules/vite/bin/vite.js', '../StudioHub', '--port', '5174', '--strictPort', '--host', '127.0.0.1'], {
        cwd: process.cwd(),
        shell: false
    });

    server.stderr.on('data', d => console.error("VITE:", d.toString()));
    
    let viteReady = false;
    for (let i=0; i<30; i++) {
        try {
            const res = await fetch("http://127.0.0.1:5174/");
            if (res.ok) { viteReady = true; break; }
        } catch(e) {}
        await sleep(500);
    }
    if (!viteReady) throw new Error("Vite didn't start");

    console.log("Launching Puppeteer...");
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--window-size=1920,1080', '--no-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    console.log("Navigating...");
    await page.goto("http://127.0.0.1:5174/", { waitUntil: 'networkidle0' });

    // Inject text overlay container
    await page.evaluate(() => {
        const style = document.createElement('style');
        style.innerHTML = `
            #promo-overlay {
                position: fixed;
                bottom: 10%;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(0, 0, 0, 0.85);
                color: #fff;
                padding: 20px 40px;
                border-radius: 12px;
                font-family: 'Outfit', sans-serif;
                font-size: 48px;
                font-weight: 800;
                text-align: center;
                z-index: 9999;
                box-shadow: 0 10px 30px rgba(0,0,0,0.5);
                opacity: 0;
                transition: opacity 0.5s ease, transform 0.5s ease;
            }
            #promo-overlay.visible {
                opacity: 1;
                transform: translateX(-50%) translateY(-20px);
            }
            
            /* Custom cursor for demonstration */
            #demo-cursor {
                position: fixed;
                width: 40px;
                height: 40px;
                background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="white" stroke="black" stroke-width="2"><path d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 0 1 .35-.15h6.8c.45 0 .67-.54.35-.85L5.85 2.86a.5.5 0 0 0-.35-.15z"/></svg>');
                z-index: 10000;
                pointer-events: none;
                transition: left 0.5s ease, top 0.5s ease;
                top: 50%;
                left: 50%;
            }
        `;
        document.head.appendChild(style);

        const overlay = document.createElement('div');
        overlay.id = 'promo-overlay';
        document.body.appendChild(overlay);
        
        const cursor = document.createElement('div');
        cursor.id = 'demo-cursor';
        document.body.appendChild(cursor);

        window.showText = (text) => {
            overlay.classList.remove('visible');
            setTimeout(() => {
                overlay.innerHTML = text;
                overlay.classList.add('visible');
            }, 500);
        };
        
        window.hideText = () => {
            overlay.classList.remove('visible');
        };
        
        window.moveCursorTo = (selector) => {
            const el = document.querySelector(selector);
            if (el) {
                const rect = el.getBoundingClientRect();
                cursor.style.left = (rect.left + rect.width / 2) + 'px';
                cursor.style.top = (rect.top + rect.height / 2) + 'px';
                
                // Simulate hover on the element manually since real mouse isn't there
                el.classList.add('hover');
            }
        };
        
        window.unhover = (selector) => {
            const el = document.querySelector(selector);
            if (el) el.classList.remove('hover');
        };
    });

    const recorder = new PuppeteerScreenRecorder(page, {
        fps: 30,
        ffmpeg_Path: ffmpegInstaller.path,
        videoFrame: { width: 1920, height: 1080 },
        aspectRatio: '16:9'
    });

    console.log("Recording...");
    await recorder.start(RAW_VIDEO);

    // Timeline: 32 seconds
    // 0-4s: Intro
    await page.evaluate(() => window.showText("Tired of paying for puzzle games?"));
    await sleep(4000);

    // 4-8s: The Carousel
    await page.evaluate(() => window.showText("Meet the Oops-Games Carousel!"));
    await sleep(4000);

    // 8-12s: Action
    await page.evaluate(() => window.showText("Click to ride and play them all..."));
    await page.evaluate(() => window.moveCursorTo('#carousel-start-btn'));
    await page.hover('#carousel-start-btn'); // Real puppeteer hover for CSS effects
    await sleep(4000);

    // 12-18s: Explain
    await page.evaluate(() => window.showText("It automatically takes you to a new game..."));
    await sleep(6000);

    // 18-24s: More explain
    await page.evaluate(() => window.showText("...right after you finish the last one!"));
    await page.evaluate(() => window.moveCursorTo('.shells-btn'));
    await page.hover('.shells-btn');
    await sleep(2000);
    await page.evaluate(() => window.moveCursorTo('.lightning-btn'));
    await page.hover('.lightning-btn');
    await sleep(2000);
    await page.evaluate(() => window.moveCursorTo('.budbud-btn'));
    await page.hover('.budbud-btn');
    await sleep(2000);

    // 24-32s: Outro
    await page.evaluate(() => window.showText("100% Free. No Downloads.<br>Play now at oops-games.com!"));
    await sleep(8000);

    await recorder.stop();
    await browser.close();
    server.kill();

    console.log("Converting to FINAL...");
    await new Promise((resolve, reject) => {
        ffmpeg(RAW_VIDEO)
        .outputOptions([
            '-y',
            '-c:v libx264',
            '-pix_fmt yuv420p',
            '-preset fast',
            '-crf 18'
        ])
        .save(FINAL_VIDEO)
        .on('end', resolve)
        .on('error', reject);
    });

    if (fs.existsSync(RAW_VIDEO)) fs.unlinkSync(RAW_VIDEO);
    console.log("Done: " + FINAL_VIDEO);
}

main().then(() => process.exit(0)).catch(err => {
    console.error(err);
    process.exit(1);
});
