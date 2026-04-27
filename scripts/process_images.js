import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';

const ARTIFACT_DIR = 'C:\\Users\\papil\\.gemini\\antigravity\\brain\\a4f8c529-d0f6-4408-9e02-5b6bd8c08e12';
const PUBLIC_ASSETS_DIR = path.join(process.cwd(), 'public', 'assets');

async function processImages() {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  const files = fs.readdirSync(ARTIFACT_DIR).filter(f => f.endsWith('.png'));

  await page.setContent(`
    <html>
      <body>
        <canvas id="canvas"></canvas>
      </body>
    </html>
  `);

  for (const file of files) {
    if (file.startsWith('bg_miro')) {
      fs.copyFileSync(path.join(ARTIFACT_DIR, file), path.join(PUBLIC_ASSETS_DIR, 'bg.png'));
      continue;
    }
    
    if (!file.startsWith('bud_') && !file.startsWith('emoji_') && !file.startsWith('miro_heart')) continue;

    console.log('Processing', file);
    
    let targetName = file;
    if (file.startsWith('bud_') && file.includes('_raw_')) {
      const match = file.match(/(bud_\d+)_raw_/);
      if (match) targetName = match[1] + '.png';
    } else if (file.startsWith('emoji_')) {
      const match = file.match(/(emoji_[^_]+)_/);
      if (match) targetName = match[1] + '.png';
    }

    const sourcePath = path.join(ARTIFACT_DIR, file);
    const targetPath = path.join(PUBLIC_ASSETS_DIR, targetName);
    
    const base64Img = fs.readFileSync(sourcePath, { encoding: 'base64' });
    const dataUrl = 'data:image/png;base64,' + base64Img;
    
    const outBase64 = await page.evaluate(async (src) => {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.getElementById('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          
          const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imgData.data;
          const w = canvas.width;
          const h = canvas.height;
          
          function isMagenta(x, y) {
            if (x < 0 || x >= w || y < 0 || y >= h) return false;
            const idx = (y * w + x) * 4;
            const r = data[idx];
            const g = data[idx+1];
            const b = data[idx+2];
            const dist = Math.sqrt(Math.pow(r - 255, 2) + Math.pow(g - 0, 2) + Math.pow(b - 255, 2));
            return dist < 220; // very loose tolerance for noisy magenta
          }
          
          const visited = new Uint8Array(w * h);
          const queue = [];
          
          for (let x = 0; x < w; x++) {
            if (isMagenta(x, 0)) queue.push([x, 0]);
            if (isMagenta(x, h - 1)) queue.push([x, h - 1]);
          }
          for (let y = 0; y < h; y++) {
            if (isMagenta(0, y)) queue.push([0, y]);
            if (isMagenta(w - 1, y)) queue.push([w - 1, y]);
          }
          
          let head = 0;
          while (head < queue.length) {
            const pt = queue[head++];
            const x = pt[0];
            const y = pt[1];
            const idx = y * w + x;
            
            if (visited[idx]) continue;
            visited[idx] = 1;
            
            const dataIdx = idx * 4;
            data[dataIdx + 3] = 0;
            
            if (x > 0 && !visited[y * w + x - 1] && isMagenta(x - 1, y)) queue.push([x - 1, y]);
            if (x < w - 1 && !visited[y * w + x + 1] && isMagenta(x + 1, y)) queue.push([x + 1, y]);
            if (y > 0 && !visited[(y - 1) * w + x] && isMagenta(x, y - 1)) queue.push([x, y - 1]);
            if (y < h - 1 && !visited[(y + 1) * w + x] && isMagenta(x, y + 1)) queue.push([x, y + 1]);
          }
          
          // Anti-aliasing fringe removal
          for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
              const idx = y * w + x;
              if (visited[idx]) continue;
              
              const dataIdx = idx * 4;
              const r = data[dataIdx];
              const g = data[dataIdx+1];
              const b = data[dataIdx+2];
              const dist = Math.sqrt(Math.pow(r - 255, 2) + Math.pow(g - 0, 2) + Math.pow(b - 255, 2));
              
              if (dist < 260) {
                 const alphaFactor = (dist - 150) / 110;
                 const a = Math.max(0, Math.min(1, alphaFactor));
                 data[dataIdx+3] = Math.min(data[dataIdx+3], Math.floor(255 * Math.pow(a, 1.5)));
                 data[dataIdx] = Math.min(r, g * 1.5);
                 data[dataIdx+2] = Math.min(b, g * 1.5);
              }
            }
          }
          
          ctx.putImageData(imgData, 0, 0);
          resolve(canvas.toDataURL());
        };
        img.src = src;
      });
    }, dataUrl);

    const outputData = outBase64.replace(/^data:image\/png;base64,/, "");
    fs.writeFileSync(targetPath, Buffer.from(outputData, 'base64'));
    console.log('Saved', targetName);
  }

  await browser.close();
}

processImages().catch(console.error);
