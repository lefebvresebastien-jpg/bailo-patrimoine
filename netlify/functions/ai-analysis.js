// Proxy sécurisé vers l'API Anthropic pour l'analyse IA du patrimoine.
// Avant le 12/07/2026, le navigateur appelait directement
// api.anthropic.com sans clé ni protection — ça ne pouvait pas
// fonctionner (pas de clé, et l'API n'autorise pas les appels directs
// depuis un navigateur). Cette fonction sécurise l'appel côté serveur et
// exige une session Chantier/Finance valide avant d'accepter la requête.
const https = require('https');

const CHANTIER_URL = 'https://hvkguyddmhqbvarujlyr.supabase.co';
const CHANTIER_ANON_KEY = process.env.SUPABASE_CHANTIER_ANON_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

function request(method, url, headers, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const payload = body ? JSON.stringify(body) : null;
    const req = https.request({
      hostname: u.hostname,
      path: u.pathname + u.search,
      method,
      headers: payload ? { ...headers, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : headers
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => { try { resolve({ status: res.statusCode, body: JSON.parse(data || 'null') }); } catch(e) { resolve({ status: res.statusCode, body: data }); } });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

exports.handler = async (event) => {
  const cors = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { ...cors, 'Access-Control-Allow-Headers': 'Content-Type, Authorization' } };
  }

  try {
    const authHeader = event.headers.authorization || event.headers.Authorization || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (!token || !CHANTIER_ANON_KEY) {
      return { statusCode: 401, headers: cors, body: JSON.stringify({ error: 'Authentification requise' }) };
    }
    const userRes = await request('GET', CHANTIER_URL + '/auth/v1/user', {
      apikey: CHANTIER_ANON_KEY, Authorization: 'Bearer ' + token
    });
    if (userRes.status !== 200) {
      return { statusCode: 401, headers: cors, body: JSON.stringify({ error: 'Session invalide' }) };
    }

    if (!ANTHROPIC_API_KEY) {
      return { statusCode: 500, headers: cors, body: JSON.stringify({ error: 'ANTHROPIC_API_KEY non configurée côté serveur' }) };
    }

    const { prompt } = JSON.parse(event.body || '{}');
    if (!prompt) {
      return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'Prompt manquant' }) };
    }

    const aiRes = await request('POST', 'https://api.anthropic.com/v1/messages', {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    }, {
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }]
    });

    return { statusCode: aiRes.status, headers: cors, body: JSON.stringify(aiRes.body) };
  } catch (e) {
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: e.message }) };
  }
};
