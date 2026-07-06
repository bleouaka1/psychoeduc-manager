import { createClient } from '../lib/supabase/server'
import { logout } from './login/actions'

export default async function Home() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('vue_dashboard_fondateur')
    .select('*')
    .single()

  const d: any = data || {}

  const cards = [
    ['🏢', 'Organisations', d.total_organisations ?? 0, 'Solo, structures, employeurs'],
    ['👥', 'Bénéficiaires', d.total_beneficiaires ?? 0, 'Personnes suivies'],
    ['📊', 'Évaluations IGA', d.total_evaluations_iga ?? 0, 'Indice Général d’Autonomie'],
    ['📈', 'Score IGA moyen', d.score_iga_moyen ?? '—', 'Sur 100'],
    ['💳', 'Licences actives', d.licences_actives ?? 0, 'Abonnements en cours'],
    ['🎁', 'Essais gratuits en cours', d.essais_gratuits_en_cours ?? 0, 'Non convertis, non expirés'],
    ['🏬', 'Structures', d.total_structures ?? 0, 'Écoles, ONG, centres'],
    ['🏭', 'Employeurs', d.total_employeurs ?? 0, 'Entreprises partenaires'],
    ['👨‍🏫', 'Personnel', d.total_personnel ?? 0, 'Éducateurs, formateurs, coachs'],
    ['💰', 'Revenus confirmés', `${d.revenus_confirmes_total ?? 0} FCFA`, 'Paiements validés'],
    ['🏆', 'Réussites confirmées', d.total_reussites_confirmees ?? 0, 'Parcours validés par un humain'],
  ] as const

  return (
    <main style={styles.main}>
      <aside style={styles.sidebar}>
        <div style={styles.logo}>PM</div>
        <h2 style={styles.brand}>PsychoÉduc</h2>
        <h3 style={{ margin: '4px 0' }}>Manager</h3>
        <p style={styles.muted}>Fondateur — Cockpit</p>

        <div style={styles.profileBox}>
          <p style={styles.profileEmail}>{user?.email}</p>
          <form action={logout}>
            <button type="submit" style={styles.logoutBtn}>Déconnexion</button>
          </form>
        </div>
      </aside>

      <section style={styles.content}>
        <header style={styles.header}>
          <div>
            <p style={styles.gold}>👑 Cockpit Fondateur</p>
            <h1 style={styles.title}>Tableau de bord</h1>
            <p style={styles.subtitle}>Vue d’ensemble de PsychoÉduc Manager.</p>
          </div>
        </header>

        {error && (
          <div style={styles.error}>
            Aucune donnée visible avec la session actuelle (RLS actif — normal si le compte n’a pas encore de rôle attribué).
          </div>
        )}

        <section style={styles.cardsGrid}>
          {cards.map((c) => (
            <div key={c[1]} style={styles.card}>
              <div style={styles.cardIcon}>{c[0]}</div>
              <h3 style={styles.cardTitle}>{c[1]}</h3>
              <div style={styles.bigNumber}>{c[2]}</div>
              <p style={styles.muted}>{c[3]}</p>
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

const styles: any = {
  main: {
    minHeight: '100vh',
    background: 'radial-gradient(circle at top left, #12305a 0, #07111f 36%, #050b14 100%)',
    color: 'white',
    fontFamily: 'Arial, sans-serif',
    display: 'flex',
  },
  sidebar: {
    width: 260,
    background: 'rgba(7, 21, 39, 0.97)',
    padding: 25,
    borderRight: '1px solid #223656',
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
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
    marginBottom: 15,
  },
  brand: { color: '#fbbf24', margin: 0 },
  muted: { color: '#94a3b8', marginTop: 6 },
  content: { flex: 1, padding: 35 },
  header: { marginBottom: 25 },
  gold: { color: '#fbbf24', fontWeight: 'bold' },
  title: { fontSize: 40, margin: 0 },
  subtitle: { color: '#bfdbfe', fontSize: 18 },
  error: {
    background: '#1e293b',
    color: '#bfdbfe',
    padding: 18,
    borderRadius: 16,
    marginBottom: 25,
    border: '1px solid #223656',
  },
  cardsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 20,
  },
  card: {
    background: 'linear-gradient(180deg, #12213a, #0b1628)',
    border: '1px solid #223656',
    borderRadius: 24,
    padding: 24,
    boxShadow: '0 18px 45px rgba(0,0,0,0.35)',
  },
  cardIcon: { fontSize: 36 },
  cardTitle: { color: '#dbeafe' },
  bigNumber: {
    fontSize: 42,
    color: '#fbbf24',
    fontWeight: 'bold',
  },
  footer: {
    marginTop: 35,
    color: '#64748b',
    fontSize: 14,
  },
  profileBox: {
    marginTop: 'auto',
    paddingTop: 20,
    borderTop: '1px solid #223656',
  },
  profileEmail: {
    color: '#dbeafe',
    fontSize: 13,
    marginBottom: 10,
    wordBreak: 'break-all',
  },
  logoutBtn: {
    width: '100%',
    background: '#12213a',
    color: '#fca5a5',
    border: '1px solid #223656',
    borderRadius: 12,
    padding: '10px 0',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
}
