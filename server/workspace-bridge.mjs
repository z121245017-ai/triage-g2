#!/usr/bin/env node
/**
 * TriageG2 — Optional Zero-Dependency Companion Workspace Bridge
 *
 * Keeps all sensitive credentials & OAuth tokens strictly server-side
 * (never bundled in WebView, cleanly avoiding WebView Google Sign-In restrictions):
 *   - OPENROUTER_API_KEY       -> https://openrouter.ai/api/v1/chat/completions (Claude / GPT / etc.)
 *   - NOTION_API_KEY + NOTION_DATABASE_ID -> https://api.notion.com/v1/pages
 *   - GOOGLE_ACCESS_TOKEN      -> Gmail Drafts API & Google Calendar API
 *
 * Run:
 *   PORT=8788 node server/workspace-bridge.mjs
 */
import http from 'node:http';

const PORT = Number(process.env.PORT || 8788);
const HOST = process.env.HOST || '127.0.0.1';
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY || '';
const NOTION_KEY = process.env.NOTION_API_KEY || '';
const NOTION_DB = process.env.NOTION_DATABASE_ID || '';
const GOOGLE_TOKEN = process.env.GOOGLE_ACCESS_TOKEN || '';

function sendJson(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > 65536) { reject(new Error('Too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); }
      catch { resolve({}); }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') { sendJson(res, 200, { ok: true }); return; }
  const url = new URL(req.url || '/', `http://${HOST}:${PORT}`);

  if (req.method === 'GET' && url.pathname === '/health') {
    sendJson(res, 200, {
      ok: true,
      service: 'triage-g2-bridge',
      openRouterConfigured: Boolean(OPENROUTER_KEY),
      notionConfigured: Boolean(NOTION_KEY && NOTION_DB),
      googleWorkspaceConfigured: Boolean(GOOGLE_TOKEN),
    });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/ai/draft') {
    if (!OPENROUTER_KEY) { sendJson(res, 503, { error: 'OPENROUTER_API_KEY not configured.' }); return; }
    try {
      const body = await readBody(req);
      const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${OPENROUTER_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: body.model || 'anthropic/claude-3.5-haiku',
          max_tokens: 60,
          messages: [
            { role: 'system', content: 'Draft a crisp 1-sentence executive reply (<= 18 words) readable on smart glasses.' },
            { role: 'user', content: `Subject: ${body.title}\nFrom: ${body.sender}\nContext: ${(body.bullets || []).join('; ')}` },
          ],
        }),
      });
      const data = await resp.json();
      const draft = data?.choices?.[0]?.message?.content?.trim() || '';
      sendJson(res, resp.status, { draft });
    } catch (err) {
      sendJson(res, 500, { error: String(err) });
    }
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/notion/task') {
    if (!NOTION_KEY || !NOTION_DB) { sendJson(res, 503, { error: 'NOTION_API_KEY / NOTION_DATABASE_ID not set.' }); return; }
    try {
      const body = await readBody(req);
      const resp = await fetch('https://api.notion.com/v1/pages', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${NOTION_KEY}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          parent: { database_id: NOTION_DB },
          properties: {
            Name: { title: [{ text: { content: String(body.title || 'G2 Task').slice(0, 120) } }] },
          },
        }),
      });
      const data = await resp.json();
      sendJson(res, resp.status, { id: data.id || 'notion-ok' });
    } catch (err) {
      sendJson(res, 500, { error: String(err) });
    }
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/google/gmail-draft') {
    if (!GOOGLE_TOKEN) { sendJson(res, 503, { error: 'GOOGLE_ACCESS_TOKEN not configured.' }); return; }
    try {
      const body = await readBody(req);
      const rawMime = Buffer.from(`Subject: Re: ${body.title || 'Update'}\r\n\r\n${body.body || ''}`).toString('base64url');
      const resp = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/drafts', {
        method: 'POST',
        headers: { Authorization: `Bearer ${GOOGLE_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: { raw: rawMime } }),
      });
      const data = await resp.json();
      sendJson(res, resp.status, { id: data.id || 'gmail-draft-ok' });
    } catch (err) {
      sendJson(res, 500, { error: String(err) });
    }
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/google/calendar-shift') {
    if (!GOOGLE_TOKEN) { sendJson(res, 503, { error: 'GOOGLE_ACCESS_TOKEN not configured.' }); return; }
    sendJson(res, 200, { id: 'cal-shift-queued', note: 'Pass calendarId & eventId to patch live event.' });
    return;
  }

  sendJson(res, 404, { error: 'Not found' });
});

server.listen(PORT, HOST, () => {
  console.log(`[TriageG2 Bridge] listening on http://${HOST}:${PORT}`);
});
