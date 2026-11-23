// ============================================================
// 晓星 XIAOXING — 本地 CORS 代理（可选）
// 用途：转发 OpenAI 兼容接口请求，解决浏览器跨域限制
//
// 用法：
//   node proxy.mjs                      # 默认端口 8787，转发到 http://localhost:11434 (Ollama)
//   node proxy.mjs 8787 https://api.deepseek.com   # 转发到云端 API
//   node proxy.mjs 8787 http://localhost:1234      # 转发到 LM Studio
//
// 启动后，在网站「AI 模型」设置里把 Base URL 填成：
//   http://localhost:8787/v1
// ============================================================
import http from 'node:http';

const PORT = Number(process.argv[2] || 8787);
const TARGET = String(process.argv[3] || 'http://localhost:11434').replace(/\/+$/, '');

http.createServer(async (req, res) => {
  // 允许所有来源的跨域请求
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  try {
    const url = TARGET + req.url;
    const headers = { ...req.headers };
    delete headers.host;
    delete headers.origin;
    delete headers.referer;

    const chunks = [];
    for await (const c of req) chunks.push(c);

    const resp = await fetch(url, {
      method: req.method,
      headers,
      body: req.method === 'GET' || req.method === 'HEAD' ? undefined : Buffer.concat(chunks)
    });

    res.writeHead(resp.status, Object.fromEntries(resp.headers));
    for await (const c of resp.body) res.write(c);
    res.end();
  } catch (err) {
    res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: { message: '代理转发失败: ' + err.message, type: 'proxy_error' } }));
  }
}).listen(PORT, () => {
  console.log('┌─────────────────────────────────────────────┐');
  console.log('│  晓星 XIAOXING · CORS 代理已启动            │');
  console.log('│  监听: http://localhost:' + String(PORT).padEnd(18) + '│');
  console.log('│  上游: ' + TARGET.padEnd(36) + '│');
  console.log('│  网站 Base URL 请填: http://localhost:' + PORT + '/v1    │');
  console.log('└─────────────────────────────────────────────┘');
});
