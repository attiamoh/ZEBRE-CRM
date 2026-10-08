// Jeu de données de démonstration (déterministe, daté par rapport à `now`), réparti entre les membres de l'équipe.
export function makeDemo(nowInput, ownerIds) {
  const now = new Date(nowInput);
  let s = 20261008;
  const rnd = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const day = (offset, h = 9, m = 0) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset, h, m);
    return d;
  };
  // décale samedi/dimanche au lundi suivant (agenda réaliste)
  const workday = (offset, h, m) => {
    const d = day(offset, h, m);
    const w = d.getDay();
    if (w === 6) d.setDate(d.getDate() + 2);
    if (w === 0) d.setDate(d.getDate() + 1);
    return d;
  };
  const isoDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const isoDT = (d) => `${isoDate(d)}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const month = (offset) => {
    const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  };

  const R = ownerIds.length ? ownerIds : ['?'];

  const companies = [
    ['Boulangerie Le Fournil', 'Fatou Diallo', 'Gérante', 'Cocody', 'WhatsApp', 'client'],
    ['Transports Diallo & Fils', 'Ibrahim Diallo', 'Directeur', 'Yopougon', 'Appel entrant', 'prospect'],
    ['Clinique Sainte-Anne', 'Dr Aline Yao', 'Directrice administrative', 'Plateau', 'Recommandation', 'client'],
    ['Hôtel Les Palmiers', 'Serge N’Guessan', 'Directeur général', 'Grand-Bassam', 'Salon', 'prospect'],
    ['Agro Savane SARL', 'Kader Ouattara', 'Responsable achats', 'Bouaké', 'Site web', 'prospect'],
    ['Imprimerie Express', 'Nadia Camara', 'Co-fondatrice', 'Treichville', 'WhatsApp', 'client'],
    ['Cabinet Kané Avocats', 'Me Moussa Kané', 'Associé', 'Plateau', 'Recommandation', 'prospect'],
    ['BTP Horizon', 'Paul Ehui', 'Directeur des opérations', 'Marcory', 'Prospection terrain', 'prospect'],
    ['Pharmacie du Plateau', 'Christelle Aka', 'Pharmacienne titulaire', 'Plateau', 'Appel entrant', 'client'],
    ['École Les Lauréats', 'Bernard Kouamé', 'Fondateur', 'Angré', 'Salon', 'prospect'],
    ['Garage Auto Plus', 'Rachid Sylla', 'Gérant', 'Abobo', 'Prospection terrain', 'prospect'],
    ['Supermarché Bon Prix', 'Henriette Gnagne', 'Directrice de magasin', 'Riviera', 'Site web', 'client'],
    ['Restaurant Chez Tantie', 'Odette Brou', 'Propriétaire', 'Zone 4', 'WhatsApp', 'prospect'],
    ['Cosmétiques Nala', 'Nala Touré', 'Fondatrice', 'Cocody', 'Réseaux sociaux', 'prospect'],
    ['Logistique Atlantique', 'Eric Konan', 'Directeur logistique', 'Port-Bouët', 'Recommandation', 'client'],
    ['Groupe Scolaire Excellence', 'Agnès Tanoh', 'Directrice des études', 'Bingerville', 'Appel entrant', 'prospect'],
    ['Menuiserie Moderne', 'Lamine Coulibaly', 'Gérant', 'Koumassi', 'Prospection terrain', 'prospect'],
    ['Assurances Sécurité Plus', 'Sandrine Kacou', 'Responsable agence', 'Plateau', 'Salon', 'prospect'],
  ];
  const contacts = companies.map((c, i) => {
    const [company, name, title, city, source, type] = c;
    const slug = name.toLowerCase().normalize('NFD').replace(/[^a-z ]/g, '').trim().split(' ');
    const dom = company.toLowerCase().normalize('NFD').replace(/[^a-z]/g, '').slice(0, 14);
    return {
      id: `ct-${String(i + 1).padStart(2, '0')}`,
      type,
      company,
      name,
      title,
      city,
      source,
      phone: `+225 07 ${String(10 + Math.floor(rnd() * 89))} ${String(10 + Math.floor(rnd() * 89))} ${String(10 + Math.floor(rnd() * 89))} ${String(10 + Math.floor(rnd() * 89))}`,
      email: `${slug[slug.length - 1]}@${dom}.ci`,
      ownerId: R[i % R.length],
      notes: '',
      createdAt: isoDate(day(-Math.floor(20 + rnd() * 140))),
    };
  });
  contacts[1].notes = 'Premier contact sur WhatsApp, flotte de 12 camions. Veut un devis avant fin du mois.';
  contacts[3].notes = 'Rencontré au salon de l’hôtellerie. Intéressé par une offre groupée pour 3 établissements.';
  contacts[12].notes = 'A demandé une démo. Rappeler en fin de matinée, jamais le lundi.';

  const titles = ['Équipement caisse + logiciel', 'Contrat maintenance annuel', 'Formation équipe de vente', 'Licence 10 postes', 'Pack démarrage PME', 'Extension multi-sites', 'Renouvellement contrat', 'Audit et accompagnement', 'Abonnement premium 12 mois', 'Installation réseau'];
  const stageSpec = [
    ['nouveau', 5], ['qualifie', 5], ['proposition', 4], ['negociation', 3], ['gagne', 9], ['perdu', 2],
  ];
  const deals = [];
  let k = 0;
  stageSpec.forEach(([stage, n]) => {
    for (let j = 0; j < n; j++) {
      const ct = contacts[(k * 7 + 3) % contacts.length];
      const amount = Math.round((300 + rnd() * 5200) / 50) * 50 * 1000;
      const won = stage === 'gagne' || stage === 'perdu';
      // gagnés répartis sur les 6 derniers mois, dont 3 ce mois-ci
      const wonOffsets = [-1, -3, -6, -20, -38, -55, -75, -100, -130];
      const closeOffset = stage === 'gagne' ? wonOffsets[j] : stage === 'perdu' ? [-10, -45][j] : Math.floor(5 + rnd() * 60);
      deals.push({
        id: `op-${String(k + 1).padStart(2, '0')}`,
        title: `${pick(titles)}`,
        contactId: ct.id,
        amount,
        stage,
        ownerId: ct.ownerId,
        closeDate: isoDate(day(closeOffset)),
        createdAt: isoDate(day(Math.min(closeOffset, 0) - Math.floor(15 + rnd() * 40))),
        lostReason: stage === 'perdu' ? pick(['Prix trop élevé', 'Choix d’un concurrent', 'Projet reporté']) : '',
      });
      k++;
    }
  });

  const actTypes = [
    ['appel', 'Rappeler'], ['whatsapp', 'Message WhatsApp à'], ['email', 'Envoyer le devis à'], ['relance', 'Relancer'], ['visite', 'Passer voir'],
  ];
  const actions = [];
  const offsets = [-6, -4, -3, -2, -1, -1, 0, 0, 0, 0, 1, 1, 2, 2, 3, 4, 5, 6, 8, 10, -9, -8, -7, -5, -5, -3, -2, -2, -1, -12, -14, -15];
  offsets.forEach((off, i) => {
    const ct = contacts[(i * 5 + 1) % contacts.length];
    const [type, verb] = actTypes[i % actTypes.length];
    const deal = deals.find((d) => d.contactId === ct.id && !['gagne', 'perdu'].includes(d.stage));
    // passées : la plupart réalisées, quelques-unes en retard
    const done = off < 0 ? i >= 20 || i % 3 === 0 : false;
    const due = off >= 0 ? workday(off, 9 + (i % 8)) : day(off, 9 + (i % 8));
    actions.push({
      id: `ac-${String(i + 1).padStart(2, '0')}`,
      type,
      title: `${verb} ${ct.name}`,
      contactId: ct.id,
      dealId: deal ? deal.id : '',
      ownerId: ct.ownerId,
      due: isoDate(due),
      done,
      doneAt: done ? isoDate(due) : '',
      notes: '',
    });
  });

  const meetings = [];
  const mt = [
    [0, 10, 0, 60, 'Démo produit', 'Visio'], [0, 15, 30, 45, 'Point devis', 'Sur site'], [1, 9, 0, 60, 'Présentation offre', 'Sur site'],
    [1, 14, 0, 90, 'Négociation contrat', 'Bureau ZEBRE'], [2, 11, 0, 30, 'Appel découverte', 'Téléphone'], [3, 10, 30, 60, 'Visite magasin', 'Sur site'],
    [3, 16, 0, 60, 'Démo produit', 'Visio'], [4, 9, 30, 120, 'Atelier de formation', 'Sur site'], [-1, 11, 0, 60, 'Signature', 'Bureau ZEBRE'],
    [-2, 15, 0, 45, 'Point mensuel client', 'Visio'], [6, 10, 0, 60, 'Présentation offre', 'Sur site'], [8, 14, 30, 60, 'Démo produit', 'Visio'],
    [-3, 9, 0, 60, 'Visite magasin', 'Sur site'], [2, 16, 30, 30, 'Appel découverte', 'Téléphone'],
  ];
  mt.forEach(([off, h, m, dur, label, loc], i) => {
    const ct = contacts[(i * 3 + 2) % contacts.length];
    meetings.push({
      id: `rv-${String(i + 1).padStart(2, '0')}`,
      title: `${label} · ${ct.company}`,
      contactId: ct.id,
      ownerId: R[i % R.length],
      start: isoDT(workday(off, h, m)),
      durationMin: dur,
      location: loc,
      notes: '',
    });
  });

  const objectives = [];
  [0, -1].forEach((mo) => {
    R.forEach((repId, i) => {
      objectives.push({
        id: `${month(mo)}_${repId}`,
        month: month(mo),
        repId,
        targetRevenue: [9000000, 6000000, 5000000, 12000000][i % 4],
        targetDeals: [3, 2, 2, 2][i % 4],
        targetActions: [20, 25, 30, 15][i % 4],
      });
    });
  });

  const all = { contacts, deals, actions, meetings, objectives };
  Object.values(all).forEach((list) => list.forEach((x) => { x.demo = true; x.id = `demo-${x.id}`; }));
  // les liens entre fiches suivent le préfixe
  const pre = (v) => (v ? `demo-${v}` : '');
  deals.forEach((d) => { d.contactId = pre(d.contactId); });
  actions.forEach((a) => { a.contactId = pre(a.contactId); a.dealId = pre(a.dealId); });
  meetings.forEach((m) => { m.contactId = pre(m.contactId); });
  objectives.forEach((o) => { o.id = o.id.replace(/^demo-/, ''); });
  return all;
}
