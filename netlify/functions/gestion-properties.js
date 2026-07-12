// Récupère la liste des biens du bailleur connecté, depuis la base
// Gestion — nécessaire car Bailo Patrimoine se connecte avec la session
// Chantier/Finance (hvkguyddmhqbvarujlyr), qui est un système Auth
// SÉPARÉ de Gestion (nltuysmnxsomlhgvbtwz). Même principe de pont que
// check-plan.js et sync-quittance.js (bailo-gestion-v2) : on identifie
// l'appelant via son token Chantier, on récupère son email, puis on
// retrouve son compte Gestion correspondant via ce même email.
const https = require('https');

const CHANTIER_URL = 'https://hvkguyddmhqbvarujlyr.supabase.co';
const CHANTIER_ANON_KEY = process.env.SUPABASE_CHANTIER_ANON_KEY;
const GESTION_URL = 'https://nltuysmnxsomlhgvbtwz.supabase.co';
const GESTION_SERVICE_KEY = process.env.SUPABASE_GESTION_SERVICE_KEY;

function request(method, url, headers) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request({ hostname: u.hostname, path: u.pathname + u.search, method, headers }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => { try { resolve({ status: res.statusCode, body: JSON.parse(data || 'null') }); } catch(e) { resolve({ status: res.statusCode, body: data }); } });
    });
    req.on('error', reject);
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
      return { statusCode: 200, headers: cors, body: JSON.stringify({ properties: [] }) };
    }

    const userRes = await request('GET', CHANTIER_URL + '/auth/v1/user', {
      apikey: CHANTIER_ANON_KEY, Authorization: 'Bearer ' + token
    });
    const email = userRes.status === 200 ? userRes.body?.email : null;
    if (!email || !GESTION_SERVICE_KEY) {
      return { statusCode: 200, headers: cors, body: JSON.stringify({ properties: [] }) };
    }

    const svcHeaders = { apikey: GESTION_SERVICE_KEY, Authorization: 'Bearer ' + GESTION_SERVICE_KEY };
    const listRes = await request('GET', GESTION_URL + '/auth/v1/admin/users?email=' + encodeURIComponent(email), svcHeaders);
    const gestionUser = listRes.body?.users?.[0] || (Array.isArray(listRes.body) ? listRes.body[0] : null);
    if (!gestionUser?.id) {
      return { statusCode: 200, headers: cors, body: JSON.stringify({ properties: [] }) };
    }

    const propsRes = await request('GET',
      GESTION_URL + '/rest/v1/properties?bailleur_id=eq.' + encodeURIComponent(gestionUser.id) + '&select=id,name,type,address,city,postal_code',
      svcHeaders
    );

    return { statusCode: 200, headers: cors, body: JSON.stringify({ properties: Array.isArray(propsRes.body) ? propsRes.body : [] }) };
  } catch (e) {
    return { statusCode: 200, headers: cors, body: JSON.stringify({ properties: [], error: e.message }) };
  }
};
