import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default async function Home() {
  const { data, error } = await supabase
    .from('vue_dashboard_super_admin')
    .select('*')
    .single()

  const d: any = data || {}

  const menus = [
    '🏠 Vue générale',
    '👤 Comptes Solo',
    '🏢 Structures',
    '🌍 Pays / Ministères',
    '🏭 Employeurs',
    '👨‍🏫 Utilisateurs & Personnel',
    '👥 Bénéficiaires',
    '🧩 Centre des modules',
    '💳 Licences & Abonnements',
    '💰 Finances',
    '📬 Communication / WhatsApp',
    '📊 Statistiques mondiales',
    '🤖 Centre IA',
    '🆘 Support',
    '📜 Journal d’audit',
    '⚙️ Paramètres'
  ]

  const cards = [
    ['👤', 'Comptes Solo', d.total_solo || 0, '+0 ce mois', 'Formateurs, coachs, consultants'],
    ['🏢', 'Structures', d.total_structures_inscrites || 0, '+0 ce mois', 'Centres, ONG, écoles'],
    ['🌍', 'Ministères / Pays', d.total_ministeres || 0, '+0 ce mois', 'Instances nationales'],
    ['🏭', 'Employeurs', d.total_employeurs || 0, '+0 ce mois', 'Entreprises recruteuses'],
    ['👥', 'Bénéficiaires', d.total_beneficiaires || 0, '+0 ce mois', 'Personnes suivies'],
    ['👨‍🏫', 'Personnel', d.total_personnel || 0, '+0 ce mois', 'Éducateurs / formateurs'],
    ['💳', 'Abonnements', d.abonnements_actifs || 0, 'Licences actives', 'Clients payants'],
    ['💰', 'Revenus', `${d.revenus || 0} FCFA`, 'Paiements validés', 'Revenus mensuels']
  ]

  const soloStats = [
    ['Total Solo', d.total_solo || 0],
    ['Actifs', d.solo_actifs || 0],
    ['En attente', d.solo_en_attente || 0],
    ['Suspendus', d.solo_suspendus || 0],
    ['Refusés', d.solo_refuses || 0],
    ['Archivés', d.solo_archives || 0]
  ]

  const structureStats = [
    ['Total structures', d.total_structures_inscrites || 0],
    ['Actives', d.total_structures_actives || 0],
    ['En attente', d.total_demandes || 0],
    ['Suspendues', d.total_suspendues || 0],
    ['Refusées', d.total_refusees || 0],
    ['Archivées', d.total_archivees || 0]
  ]

  const ministereStats = [
    ['Total ministères / pays', d.total_ministeres || 0],
    ['Actifs', d.ministeres_actifs || 0],
    ['En attente', d.ministeres_en_attente || 0],
    ['Suspendus', d.ministeres_suspendus || 0],
    ['Refusés', d.ministeres_refuses || 0],
    ['Archivés', d.ministeres_archives || 0]
  ]

  const employeurStats = [
    ['Total employeurs', d.total_employeurs || 0],
    ['Actifs', d.employeurs_actifs || 0],
    ['En attente', d.employeurs_en_attente || 0],
    ['Suspendus', d.employeurs_suspendus || 0],
    ['Offres publiées', d.offres_publiees || 0],
    ['Recrutements', d.recrutements_realises || 0]
  ]

  const modules = [
    ['🎯 Projet de vie', 'Objectifs, plan d’action, orientation'],
    ['📚 Formations & Classes', 'Cours, quiz, documents, vidéos, audios'],
    ['📋 Présences & Assiduité', 'Présences, absences, retards, alertes'],
    ['📊 IGA', `${d.total_scores_iga || 0} scores enregistrés`],
    ['🤝 Capital social', `${d.capital_social_actif || 0} soutiens actifs`],
    ['📈 Intelligence économique', `${d.opportunites_actives || 0} opportunités`],
    ['💼 Insertion professionnelle', `${d.total_insertions || 0} insertions suivies`],
    ['🏭 Employeurs & Recrutement', 'Offres, stages, candidats, recrutements'],
    ['🚀 Financement participatif', `${d.total_projets_financement || 0} projets`],
    ['🤖 IA PsychoÉduc', `${d.agents_ia_actifs || 0} agents actifs`],
    ['📬 Communication / WhatsApp', 'Messages, notifications, annonces'],
    ['📜 Traçabilité', `${d.total_logs || 0} actions suivies`]
  ]

  const activities = [
    ['10:12', 'Création d’un compte Solo', 'En attente'],
    ['11:05', 'Nouvelle demande structure', 'À vérifier'],
    ['12:20', 'Paiement reçu', 'Licence active'],
    ['13:40', 'Message WhatsApp préparé', 'Communication'],
    ['14:05', 'Journal d’audit mis à jour', 'Traçabilité']
  ]

  return (
    <main style={styles.main}>
      <aside style={styles.sidebar}>
        <div style={styles.logo}>PM</div>
        <h2 style={styles.brand}>PsychoÉduc</h2>
        <h3 style={{ margin: '4px 0' }}>Manager</h3>
        <p style={styles.muted}>Fondateur Super Admin</p>

        <div style={{ marginTop: 28 }}>
          {menus.map((item) => (
            <div
              key={item}
              style={{
                ...styles.menuItem,
                background: item.includes('Vue générale') ? '#fbbf24' : 'transparent',
                color: item.includes('Vue générale') ? '#071527' : '#dbeafe'
              }}
            >
              {item}
            </div>
          ))}
        </div>
      </aside>

      <section style={styles.content}>
        <div style={styles.topbar}>
          <div style={styles.search}>
            🔍 Rechercher un client, une structure, un bénéficiaire, une licence...
          </div>
          <div style={styles.topBtn}>🔔 0</div>
          <div style={styles.topBtn}>💬 0</div>
          <div style={styles.topBtn}>📅 Agenda</div>
          <div style={styles.topBtn}>🌙</div>
          <div style={styles.profile}>👤 Fondateur</div>
        </div>

        <header style={styles.header}>
          <div>
            <p style={styles.gold}>👑 Cockpit Fondateur</p>
            <h1 style={styles.title}>Tableau de bord général</h1>
            <p style={styles.subtitle}>
              Bonjour Aka 👋 — voici la situation globale de PsychoÉduc Manager aujourd’hui.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <button style={styles.btnSecondary}>📬 Message global</button>
            <button style={styles.btnPrimary}>➕ Ajouter une organisation</button>
          </div>
        </header>

        {error && (
          <div style={styles.error}>
            Erreur Supabase : {error.message}
          </div>
        )}

        <section style={styles.commandGrid}>
          <div style={styles.panel}>
            <h2 style={styles.panelTitle}>🟢 Centre de commandement</h2>
            <div style={styles.healthGrid}>
              <Health title="Santé plateforme" value="98%" />
              <Health title="Base de données" value="OK" />
              <Health title="Serveur" value="OK" />
              <Health title="Sauvegarde" value="OK" />
            </div>
          </div>

          <div style={styles.panel}>
            <h2 style={styles.panelTitle}>🚨 Alertes prioritaires</h2>
            <p style={styles.muted}>Licences expirées : 0</p>
            <p style={styles.muted}>Tickets urgents : 0</p>
            <p style={styles.muted}>Demandes en attente : {d.total_demandes || 0}</p>
          </div>
        </section>

        <section style={styles.panel}>
          <h2 style={styles.panelTitle}>📅 Aujourd’hui</h2>
          <div style={styles.todayGrid}>
            <Mini title="Nouveaux utilisateurs" value="0" icon="🟢" />
            <Mini title="Nouvelles structures" value="0" icon="🏢" />
            <Mini title="Nouvelles offres employeurs" value="0" icon="🏭" />
            <Mini title="Présences enregistrées" value={d.total_presences || 0} icon="📋" />
            <Mini title="Paiements reçus" value={`${d.revenus || 0} FCFA`} icon="💰" />
            <Mini title="Alertes importantes" value={d.total_alertes || 0} icon="🚨" />
          </div>
        </section>

        <section style={styles.cardsGrid}>
          {cards.map((c) => (
            <div key={c[1]} style={styles.card}>
              <div style={styles.cardIcon}>{c[0]}</div>
              <h3 style={styles.cardTitle}>{c[1]}</h3>
              <div style={styles.bigNumber}>{c[2]}</div>
              <p style={styles.growth}>{c[3]}</p>
              <p style={styles.muted}>{c[4]}</p>
            </div>
          ))}
        </section>

        <section style={styles.statusGrid}>
          <StatusBox title="👤 Comptes Solo" stats={soloStats} />
          <StatusBox title="🏢 Structures" stats={structureStats} />
          <StatusBox title="🌍 Pays / Ministères" stats={ministereStats} />
          <StatusBox title="🏭 Employeurs" stats={employeurStats} />
        </section>

        <section style={styles.twoCols}>
          <div style={styles.panel}>
            <h2 style={styles.panelTitle}>🧩 Centre des modules</h2>
            <p style={styles.muted}>
              Tous les modules stratégiques. Chaque module aura ensuite son propre tableau de bord.
            </p>

            <div style={styles.modulesGrid}>
              {modules.map((m) => (
                <div key={m[0]} style={styles.moduleCard}>
                  <strong>{m[0]}</strong>
                  <p style={styles.muted}>{m[1]}</p>
                </div>
              ))}
            </div>
          </div>

          <div style={styles.panel}>
            <h2 style={styles.panelTitle}>⚡ Actions rapides</h2>
            {[
              '➕ Ajouter un compte Solo',
              '🏢 Ajouter une structure',
              '🌍 Ajouter un ministère / pays',
              '🏭 Ajouter un employeur',
              '💳 Créer une licence',
              '🎁 Créer un code promo',
              '📬 Envoyer un message WhatsApp',
              '📜 Voir le journal d’audit'
            ].map((a) => (
              <button key={a} style={styles.actionBtn}>{a}</button>
            ))}
          </div>
        </section>

        <section style={styles.cardsGrid3}>
          <div style={styles.panel}>
            <h2>📋 Présences & Assiduité</h2>
            <p style={styles.muted}>Présences, absences, retards, listes journalières et hebdomadaires.</p>
            <h3 style={styles.gold}>{d.total_presences || 0} présences enregistrées</h3>
          </div>

          <div style={styles.panel}>
            <h2>🏆 Top 100 IGA</h2>
            <p style={styles.muted}>Classements mensuels et annuels de l’autonomie.</p>
            <h3 style={styles.gold}>{d.total_scores_iga || 0} scores IGA</h3>
          </div>

          <div style={styles.panel}>
            <h2>🌍 Carte d’implantation</h2>
            <p style={styles.muted}>Pays, structures, employeurs et ministères actifs.</p>
            <h3 style={styles.gold}>{d.total_ministeres || 0} pays suivis</h3>
          </div>
        </section>

        <section style={{ ...styles.panel, marginTop: 25 }}>
          <h2 style={styles.panelTitle}>🕒 Activité récente</h2>
          {activities.map((a) => (
            <div key={a[0]} style={styles.activityRow}>
              <strong style={styles.gold}>{a[0]}</strong>
              <span>{a[1]}</span>
              <span style={styles.muted}>{a[2]}</span>
            </div>
          ))}
        </section>

        <footer style={styles.footer}>
          PsychoÉduc Manager — Transformer les potentiels en réussites durables.
        </footer>
      </section>
    </main>
  )
}

function Health({ title, value }: any) {
  return (
    <div style={styles.healthCard}>
      <strong>🟢 {title}</strong>
      <h3 style={styles.gold}>{value}</h3>
    </div>
  )
}

function Mini({ title, value, icon }: any) {
  return (
    <div style={styles.miniCard}>
      <div style={{ fontSize: 28 }}>{icon}</div>
      <p style={styles.muted}>{title}</p>
      <strong style={styles.bigMini}>{value}</strong>
    </div>
  )
}

function StatusBox({ title, stats }: { title: string; stats: any[] }) {
  return (
    <div style={styles.panel}>
      <h2 style={styles.panelTitle}>{title}</h2>
      {stats.map((s) => (
        <div key={s[0]} style={styles.statusRow}>
          <span>{s[0]}</span>
          <strong style={styles.gold}>{s[1]}</strong>
        </div>
      ))}
    </div>
  )
}

const styles: any = {
  main: {
    minHeight: '100vh',
    background: 'radial-gradient(circle at top left, #12305a 0, #07111f 36%, #050b14 100%)',
    color: 'white',
    fontFamily: 'Arial, sans-serif',
    display: 'flex'
  },
  sidebar: {
    width: 300,
    background: 'rgba(7, 21, 39, 0.97)',
    padding: 25,
    borderRight: '1px solid #223656',
    position: 'sticky',
    top: 0,
    height: '100vh',
    overflowY: 'auto'
  },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 18,
    background: 'linear-gradient(135deg, #fbbf24, #f97316)',
    color: '#071527',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 15
  },
  brand: { color: '#fbbf24', margin: 0 },
  muted: { color: '#94a3b8', marginTop: 6 },
  menuItem: {
    padding: 13,
    marginTop: 9,
    borderRadius: 14,
    fontWeight: 'bold'
  },
  content: { flex: 1, padding: 35 },
  topbar: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 28
  },
  search: {
    flex: 1,
    background: '#0b1628',
    border: '1px solid #223656',
    borderRadius: 18,
    padding: '15px 18px',
    color: '#94a3b8'
  },
  topBtn: {
    background: '#0b1628',
    border: '1px solid #223656',
    borderRadius: 16,
    padding: '14px 16px',
    fontWeight: 'bold'
  },
  profile: {
    background: '#12213a',
    border: '1px solid #223656',
    borderRadius: 16,
    padding: '14px 16px',
    fontWeight: 'bold'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 25
  },
  gold: { color: '#fbbf24', fontWeight: 'bold' },
  title: { fontSize: 44, margin: 0 },
  subtitle: { color: '#bfdbfe', fontSize: 18 },
  btnPrimary: {
    background: '#fbbf24',
    color: '#071527',
    border: 'none',
    padding: '16px 24px',
    borderRadius: 16,
    fontWeight: 'bold'
  },
  btnSecondary: {
    background: '#12213a',
    color: 'white',
    border: '1px solid #223656',
    padding: '16px 22px',
    borderRadius: 16,
    fontWeight: 'bold'
  },
  error: {
    background: '#3b0d0d',
    color: '#fecaca',
    padding: 18,
    borderRadius: 16,
    marginBottom: 25
  },
  panel: {
    background: 'rgba(11,22,40,0.96)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 24,
    padding: 24,
    boxShadow: '0 18px 45px rgba(0,0,0,0.30)'
  },
  panelTitle: { marginTop: 0 },
  commandGrid: {
    display: 'grid',
    gridTemplateColumns: '2fr 1fr',
    gap: 20,
    marginBottom: 25
  },
  healthGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 12
  },
  healthCard: {
    background: '#12213a',
    border: '1px solid #223656',
    borderRadius: 16,
    padding: 15
  },
  todayGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(6, 1fr)',
    gap: 14
  },
  miniCard: {
    background: '#12213a',
    border: '1px solid #223656',
    borderRadius: 18,
    padding: 16
  },
  bigMini: {
    color: '#fbbf24',
    fontSize: 24
  },
  cardsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 20,
    marginTop: 25
  },
  card: {
    background: 'linear-gradient(180deg, #12213a, #0b1628)',
    border: '1px solid #223656',
    borderRadius: 24,
    padding: 24,
    boxShadow: '0 18px 45px rgba(0,0,0,0.35)'
  },
  cardIcon: { fontSize: 36 },
  cardTitle: { color: '#dbeafe' },
  bigNumber: {
    fontSize: 42,
    color: '#fbbf24',
    fontWeight: 'bold'
  },
  growth: {
    color: '#34d399',
    fontWeight: 'bold'
  },
  statusGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 20,
    marginTop: 30
  },
  statusRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '12px 0',
    borderBottom: '1px solid #223656'
  },
  twoCols: {
    display: 'grid',
    gridTemplateColumns: '2fr 1fr',
    gap: 20,
    marginTop: 30
  },
  modulesGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: 14,
    marginTop: 20
  },
  moduleCard: {
    background: '#12213a',
    border: '1px solid #223656',
    borderRadius: 18,
    padding: 18
  },
  actionBtn: {
    width: '100%',
    marginTop: 12,
    padding: 15,
    borderRadius: 14,
    border: '1px solid #223656',
    background: '#12213a',
    color: 'white',
    textAlign: 'left',
    fontWeight: 'bold'
  },
  cardsGrid3: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 20,
    marginTop: 30
  },
  activityRow: {
    display: 'grid',
    gridTemplateColumns: '90px 1fr 200px',
    gap: 15,
    padding: '14px 0',
    borderBottom: '1px solid #223656'
  },
  footer: {
    marginTop: 35,
    color: '#64748b',
    fontSize: 14
  }
}