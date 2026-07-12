// Protection temporaire par mot de passe HTTP Basic Auth. Bailo Patrimoine
// contient actuellement des données personnelles réelles (adresses, valeurs,
// crédits) codées en dur dans le JavaScript, servies à quiconque charge la
// page — l'écran de connexion Supabase ne protège que l'affichage, pas le
// fichier lui-même. En attendant que les données soient réellement chargées
// depuis Supabase et filtrées par utilisateur, on verrouille tout le site.

const USERNAME = 'bailo';
const PASSWORD = 'ChangeMoi2026!'; // À changer par Sébastien après activation

export default async (request, context) => {
  const url = new URL(request.url);

  if (url.pathname.startsWith('/.netlify/functions/')) {
    return context.next();
  }

  const auth = request.headers.get('authorization');
  const expected = 'Basic ' + btoa(`${USERNAME}:${PASSWORD}`);

  if (auth !== expected) {
    return new Response('Authentification requise — accès Bailo Patrimoine restreint.', {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="Bailo Patrimoine - Acces restreint"',
      },
    });
  }

  return context.next();
};

export const config = { path: '/*' };
