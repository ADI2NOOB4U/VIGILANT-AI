import { chromium } from 'playwright'
import fs from 'node:fs/promises'

const viewports = [[320, 720], [360, 780], [375, 812], [390, 844], [430, 932], [768, 1024], [1024, 768], [1280, 800], [1366, 768]]
const browser = await chromium.launch({ headless: true })
const output = 'qa-output'
await fs.mkdir(output, { recursive: true })
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } })
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' })
await page.screenshot({ path: `${output}/scan-desktop.png`, fullPage: true })
if (!await page.getByRole('heading', { name: /Analyze a URL/ }).isVisible()) throw new Error('Scan page did not load')

await page.getByLabel('URL to analyze').fill('https://fast.com/')
await page.getByRole('button', { name: /Scan URL/ }).click()
await page.getByText('SAFE', { exact: true }).first().waitFor()
const probability = page.locator('.result-probability-card .prob-value')
if (!await probability.isVisible() || !/^\d+\.\d+%$/.test(await probability.textContent())) throw new Error('Fast.com probability did not render')
await page.getByRole('button', { name: /Inspect Technical Feature Matrix/ }).click()
if (!await page.getByText('URL length', { exact: true }).isVisible()) throw new Error('Technical feature grid did not render')
await page.screenshot({ path: `${output}/scan-result.png`, fullPage: true })

await page.getByLabel('URL to analyze').fill('ftp://example.com')
await page.getByRole('button', { name: /Scan URL/ }).click()
if (!await page.getByRole('alert').isVisible()) throw new Error('Invalid URL error did not render')

for (const suspicious of [
  'https://paypal-login.example.com/verify-account',
  'http://secure-bank-login.example.com/update-account',
  'http://microsoft-security.example.com/login',
  'http://free-iphone-winner.example.com/claim',
  'http://account-verify.example.com/signin/password',
]) {
  await page.getByLabel('URL to analyze').fill(suspicious)
  await page.getByRole('button', { name: /Scan URL/ }).click()
  await page.getByText('PHISHING', { exact: true }).first().waitFor()
}

await page.getByRole('button', { name: 'History' }).click()
await page.getByRole('heading', { name: 'Scan History' }).waitFor()
await page.screenshot({ path: `${output}/history.png`, fullPage: true })
await page.getByRole('button', { name: 'Analysis' }).click()
await page.getByRole('heading', { name: 'System Analysis' }).waitFor()
await page.getByRole('button', { name: 'About' }).click()
await page.getByRole('heading', { name: 'About VIGIL AI' }).waitFor()

for (const [width, height] of viewports) {
  await page.setViewportSize({ width, height })
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' })
  const assertNoHorizontalOverflow = async label => {
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
    if (overflow) throw new Error(`Horizontal overflow on ${label} at ${width}x${height}`)
  }
  await assertNoHorizontalOverflow('Scan')
  if (width <= 375) await page.screenshot({ path: `${output}/scan-${width}.png`, fullPage: true })
  if (width <= 1100) {
    const menuButton = page.getByRole('button', { name: 'Open navigation menu' })
    if (!await menuButton.isVisible()) throw new Error(`Mobile navigation button is not visible at ${width}px`)
    await menuButton.click()
    const mobileNavigation = page.getByRole('navigation', { name: 'Mobile navigation' })
    for (const label of ['Scan', 'ScamWatch Live', 'Scam Broadcasts', 'India Cyber Law', 'History', 'Analysis', 'About']) {
      if (!await mobileNavigation.getByRole('button', { name: label }).isVisible()) {
        throw new Error(`Mobile navigation is missing ${label} at ${width}px`)
      }
    }
    await page.keyboard.press('Escape')
    if (await mobileNavigation.count()) throw new Error(`Escape did not close mobile navigation at ${width}px`)

    if (width === 320 || width === 768) {
      for (const label of ['ScamWatch Live', 'Scam Broadcasts', 'India Cyber Law', 'History', 'Analysis', 'About']) {
        await page.getByRole('button', { name: 'Open navigation menu' }).click()
        await page.getByRole('navigation', { name: 'Mobile navigation' }).getByRole('button', { name: label }).click()
        await page.locator('main').waitFor()
        await page.waitForTimeout(100)
        await assertNoHorizontalOverflow(label)
        if (width === 320 && label === 'History') {
          const clearHistoryButton = page.getByRole('button', { name: 'Clear scan history' })
          if (await clearHistoryButton.isVisible()) {
            await clearHistoryButton.click()
            const dialog = page.getByRole('dialog')
            const bounds = await dialog.boundingBox()
            if (!bounds || bounds.x < 0 || bounds.y < 0 || bounds.x + bounds.width > width || bounds.y + bounds.height > height) {
              throw new Error(`History confirmation dialog does not fit within ${width}x${height}`)
            }
            await page.getByRole('button', { name: 'Keep History' }).click()
          }
        }
      }
    }
  }
}

await page.emulateMedia({ reducedMotion: 'reduce' })
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' })
if (await page.locator('.risk-meter__fill').count() !== 0) throw new Error('Unexpected result on reduced-motion idle page')
console.log(JSON.stringify({ viewports, screenshots: output, scan: 'SAFE result rendered', invalid_url: 'error rendered', reduced_motion: 'emulated', overflow: 'none' }, null, 2))
await browser.close()
