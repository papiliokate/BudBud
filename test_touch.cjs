const puppeteer = require('puppeteer');

(async () => {
  console.log("Launching browser...");
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  await page.emulate(puppeteer.KnownDevices['Pixel 5']);
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));
  
  console.log("Navigating to live site...");
  await page.goto('https://bud-bud-game.web.app', { waitUntil: 'networkidle0' });
  
  await page.waitForSelector('.emoji-btn.like');
  console.log("Buds rendered.");
  
  const btn = await page.$('.emoji-btn.like');
  const box = await btn.boundingBox();
  
  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;
  
  console.log(`Simulating Touch Drag starting at (${startX}, ${startY})...`);
  
  await page.touchscreen.touchStart(startX, startY);
  // Wait a bit to simulate human reaction
  await new Promise(r => setTimeout(r, 100));
  
  // Drag it out into the middle of nowhere to ensure we test the generic drop logic
  await page.touchscreen.touchMove(startX + 100, startY + 100);
  await new Promise(r => setTimeout(r, 100));
  
  await page.touchscreen.touchEnd();
  await new Promise(r => setTimeout(r, 100));
  
  const isDragging = await page.evaluate(() => typeof draggingState !== 'undefined' ? draggingState : 'NOT_EXPOSED');
  console.log("Dragging state after touchend:", isDragging);
  
  await browser.close();
  console.log("Test complete.");
})();
