const { app, BrowserWindow } = require('electron');
const assert = require('node:assert/strict');
const { mkdtemp, rm, readFile } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');

app.whenReady().then(async () => {
  let server, window, directory;
  try {
    const { startRestaurantServer } = await import('../packages/capability-evals/fixtures/restaurant-server.mjs');
    directory = await mkdtemp(join(tmpdir(), 'restaurant-browser-'));
    const statePath = join(directory, 'state.json');
    server = await startRestaurantServer({ statePath });
    window = new BrowserWindow({ show: false, webPreferences: { contextIsolation: true, nodeIntegration: false } });
    await window.loadURL(server.origin);
    const evaluate = code => window.webContents.executeJavaScript(code);
    const wait = async expression => {
      const until = Date.now() + 10000;
      while (Date.now() < until) {
        if (await evaluate(expression)) return;
        await new Promise(resolve => setTimeout(resolve, 25));
      }
      throw new Error(`Browser condition timed out: ${expression}`);
    };
    await wait("document.querySelectorAll('#restaurant option').length === 3");
    await evaluate("document.querySelector('#search').value='Mediterranean';document.querySelector('#search').dispatchEvent(new Event('input'))");
    assert.equal(await evaluate("document.querySelectorAll('#restaurants article').length"), 1);
    await evaluate("document.querySelector('#guest').value='Alex';document.querySelector('#party').value='6';document.querySelector('#date').value='2026-11-12';document.querySelector('#time').value='19:00';document.querySelector('#availability').click()");
    await wait("document.querySelector('#status').textContent.includes('8 seats available')");
    await evaluate("document.querySelector('#booking button').click()");
    await wait("document.querySelector('#records').textContent.includes('confirmed')");
    await evaluate("document.querySelector('#records button').click();document.querySelector('#time').value='20:30';document.querySelector('#booking button').click()");
    await wait("document.querySelector('#records').textContent.includes('20:30')");
    await server.close(); server = await startRestaurantServer({ statePath });
    await window.loadURL(server.origin);
    await wait("document.querySelector('#records').textContent.includes('20:30')");
    await evaluate("[...document.querySelectorAll('#records button')].find(b=>b.textContent.startsWith('Cancel ')).click()");
    await wait("document.querySelector('#records').textContent.includes('cancelled')");
    const state = JSON.parse(await readFile(statePath, 'utf8'));
    assert.deepEqual(state.events.map(e=>e.kind), ['booked','modified','cancelled']);
    console.log('PASS restaurant browser: search, availability, booking, modification, restart, cancellation and durable event history');
  } catch (error) { console.error(error); process.exitCode = 1; }
  finally { window?.destroy(); if (server) await server.close(); if (directory) await rm(directory, { recursive: true, force: true }); app.exit(process.exitCode || 0); }
});
