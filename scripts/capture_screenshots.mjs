import puppeteer from 'puppeteer-core';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const targetUrl = 'https://rag-project-nu.vercel.app';
const outputDir = path.resolve(__dirname, '../docs/screenshots');

(async () => {
  try {
    console.log('Launching browser with Chrome at:', chromePath);
    const browser = await puppeteer.launch({
      executablePath: chromePath,
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });

    console.log('Navigating to', targetUrl);
    await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 35000 });

    // Ensure dark mode by default
    await page.evaluate(() => {
      localStorage.setItem('nexus_theme', 'dark');
      document.documentElement.classList.add('dark');
    });
    await new Promise(r => setTimeout(r, 1500));

    // 1. Workspace Dark
    await page.screenshot({ path: path.join(outputDir, '01_workspace_dark.png') });
    console.log('Captured 01_workspace_dark.png');

    // 2. Chat query with answer
    const inputSelector = 'input[placeholder*="Ask a question"], textarea[placeholder*="Ask a question"]';
    await page.waitForSelector(inputSelector);
    await page.type(inputSelector, 'What is the waggle dance and who decoded it?');
    await page.keyboard.press('Enter');

    console.log('Waiting for query response...');
    await page.waitForFunction(() => {
      const text = document.body.innerText;
      return text.includes('Frisch') || text.includes('waggle') || text.includes('dance') || text.includes('Source');
    }, { timeout: 30000 }).catch(() => console.log('Timeout waiting for text; continuing...'));

    await new Promise(r => setTimeout(r, 3000));
    await page.screenshot({ path: path.join(outputDir, '02_chat_query_dark.png') });
    console.log('Captured 02_chat_query_dark.png');

    // 3. Documents Tab
    console.log('Switching to Documents tab...');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const dBtn = btns.find(b => b.innerText.includes('Documents'));
      if (dBtn) dBtn.click();
    });
    await new Promise(r => setTimeout(r, 2500));
    await page.screenshot({ path: path.join(outputDir, '03_documents_manager.png') });
    console.log('Captured 03_documents_manager.png');

    // 4. Settings Modal
    console.log('Opening Settings modal...');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const sBtn = btns.find(b => b.innerText.includes('Settings'));
      if (sBtn) sBtn.click();
    });
    await new Promise(r => setTimeout(r, 2000));
    await page.screenshot({ path: path.join(outputDir, '04_settings_modal.png') });
    console.log('Captured 04_settings_modal.png');

    // 5. Light Mode Workspace
    console.log('Switching to Light Mode Workspace...');
    await page.evaluate(() => {
      const closeButtons = Array.from(document.querySelectorAll('button'));
      const cancelBtn = closeButtons.find(b => b.innerText.trim() === 'Cancel');
      if (cancelBtn) cancelBtn.click();
    });
    await new Promise(r => setTimeout(r, 800));

    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const wBtn = btns.find(b => b.innerText.includes('Workspace'));
      if (wBtn) wBtn.click();

      localStorage.setItem('nexus_theme', 'light');
      document.documentElement.classList.remove('dark');
    });
    await new Promise(r => setTimeout(r, 1500));
    await page.screenshot({ path: path.join(outputDir, '05_workspace_light.png') });
    console.log('Captured 05_workspace_light.png');

    await browser.close();
    console.log('All screenshots captured successfully!');
  } catch (err) {
    console.error('Error taking screenshots:', err);
    process.exit(1);
  }
})();

