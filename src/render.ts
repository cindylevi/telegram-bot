// HTML → PNG con Browser Rendering. Espera la marca que pone megaHtml cuando cargan las tipografías.
export async function renderPng(browser: BrowserRun, html: string): Promise<ArrayBuffer> {
  const response = await browser.quickAction("screenshot", {
    html,
    viewport: { width: 1080, height: 1080 },
    gotoOptions: { waitUntil: "networkidle0" },
    waitForSelector: { selector: "#fonts-ready", timeout: 10000 },
    screenshotOptions: { type: "png" },
  });
  if (!response.ok) throw new Error(`screenshot ${response.status}: ${await response.text()}`);
  return response.arrayBuffer();
}
