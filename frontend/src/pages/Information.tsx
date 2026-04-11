import { useEffect, useState, type ComponentType, type ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { PageShell } from '@/components/layout/page-shell';
import { TYPOGRAPHY, SPACING } from '@/lib/design-system';
import { cn } from '@/lib/utils';
import { infoApi } from '@/services/api';
import {
  Landmark,
  Clock,
  BookOpen,
  Flag,
  Users,
  Building2,
  TrendingUp,
  Heart,
  Briefcase,
  Map,
  GraduationCap,
  Wallet,
  Star,
  ArrowLeftRight,
  Scale,
  ShoppingBasket,
  Gamepad2,
  Sparkles,
  ShoppingCart,
  Swords,
  Trophy,
  Globe,
  MessageSquare,
} from 'lucide-react';

interface TaxBracket {
  id: string;
  threshold: number;
  rate: number;
}

// ─── Tax Brackets ──────────────────────────────────────────────────────────────

function TaxBracketsSection() {
  const [brackets, setBrackets] = useState<TaxBracket[]>([]);
  const [isDefault, setIsDefault] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    infoApi.getTaxBrackets()
      .then(({ data }) => {
        setBrackets(data.brackets);
        setIsDefault(data.isDefault);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Landmark className="h-4 w-4 text-muted-foreground" />
          <CardDescription>Fiscalité</CardDescription>
        </div>
        <CardTitle className={TYPOGRAPHY.H2}>Impôts journaliers</CardTitle>
      </CardHeader>
      <CardContent className={SPACING.SECTION_SPACING}>
        <p className={TYPOGRAPHY.SMALL}>
          Chaque jour à minuit (heure de Paris), un impôt est automatiquement prélevé sur les comptes
          dépassant un certain seuil de richesse. Le taux appliqué correspond au palier le plus élevé
          atteint par le solde du joueur. Les paliers sont configurés par les administrateurs et peuvent
          évoluer à tout moment.
        </p>

        <section className="space-y-3">
          <h3 className={TYPOGRAPHY.MUTED}>Paliers actuels</h3>

          {loading ? (
            <div className="divide-y divide-border/30">
              {[...Array(2)].map((_, i) => (
                <div key={i} className="flex items-center justify-between py-4 gap-4">
                  <div className="h-4 w-32 rounded bg-muted animate-pulse" />
                  <div className="h-5 w-16 rounded bg-muted animate-pulse" />
                </div>
              ))}
            </div>
          ) : (
            <div className="divide-y divide-border/30">
              {brackets.map((bracket) => (
                <div
                  key={bracket.id}
                  className="flex items-center justify-between py-4 gap-4"
                >
                  <div className="flex items-center gap-3">
                    <span className={cn(TYPOGRAPHY.SMALL, 'text-muted-foreground')}>
                      À partir de
                    </span>
                    <span className={cn(TYPOGRAPHY.SMALL, 'font-semibold tabular-nums')}>
                      {bracket.threshold.toLocaleString('fr-FR')} $
                    </span>
                  </div>
                  <Badge variant="outline" className="tabular-nums font-mono text-xs shrink-0">
                    {bracket.rate % 1 === 0 ? bracket.rate : bracket.rate.toFixed(2)} % / jour
                  </Badge>
                </div>
              ))}
            </div>
          )}

          {isDefault && !loading && (
            <p className={cn(TYPOGRAPHY.MUTED, 'text-xs italic')}>
              Palier par défaut — aucune configuration personnalisée en vigueur.
            </p>
          )}
        </section>

        <section className="space-y-3 border-t border-border/30 pt-6">
          <h3 className={TYPOGRAPHY.MUTED}>Comment fonctionne le calcul ?</h3>
          <div className="divide-y divide-border/30">
            {[
              {
                step: '1',
                text: 'Le système vérifie le solde de chaque joueur approuvé à minuit Paris.',
              },
              {
                step: '2',
                text: "Le palier le plus élevé atteint par le solde est identifié — c'est son taux qui s'applique sur la totalité du solde.",
              },
              {
                step: '3',
                text: "Le montant est arrondi à l'entier inférieur (minimum 1 $). Le joueur reçoit une notification avec le détail du prélèvement.",
              },
              {
                step: '4',
                text: 'Les joueurs dont le solde est inférieur au plus bas palier ne sont pas imposés.',
              },
            ].map(({ step, text }) => (
              <div key={step} className="grid grid-cols-[auto_1fr] items-start gap-x-3 py-4">
                <span className={cn(TYPOGRAPHY.SMALL, 'text-muted-foreground tabular-nums leading-5')}>
                  {step}.
                </span>
                <p className={cn(TYPOGRAPHY.SMALL, 'leading-5')}>{text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="flex items-start gap-3 border-t border-border/30 pt-6">
          <Clock className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
          <p className={cn(TYPOGRAPHY.SMALL, 'text-muted-foreground')}>
            Les paliers affichés ci-dessus sont mis à jour en temps réel depuis le tableau de bord
            administrateur. Toute modification est effective dès le prochain prélèvement de minuit.
          </p>
        </section>
      </CardContent>
    </Card>
  );
}

// ─── Guide du jeu You — contenu interne (accordion imbriqué) ──────────────────

const BUSINESS_TYPES_DATA = [
  // Level 1
  { key: 'Limonade',           level: 1, fee: 500,    minCap: 0,      revenue: 300,  npc: 150,  cooldown: 6 },
  { key: 'Épicerie',           level: 1, fee: 1500,   minCap: 0,      revenue: 600,  npc: 300,  cooldown: 6 },
  { key: 'Restaurant',         level: 1, fee: 2000,   minCap: 0,      revenue: 800,  npc: 350,  cooldown: 6 },
  // Level 2
  { key: 'Coffee Shop',        level: 2, fee: 3000,   minCap: 1000,   revenue: 1200, npc: null, cooldown: null },
  { key: 'Startup Tech',       level: 2, fee: 10000,  minCap: 10000,  revenue: 0,    npc: null, cooldown: null, note: 'Revenus via produits R&D' },
  { key: 'Agence Immobilière', level: 2, fee: 5000,   minCap: 5000,   revenue: 6800, npc: null, cooldown: null },
  { key: 'Centre de formation',level: 2, fee: 1500,   minCap: 2000,   revenue: 800,  npc: null, cooldown: null },
  { key: 'Service de transfert',level: 2, fee: 3000,  minCap: 5000,   revenue: 0,    npc: null, cooldown: null, note: 'Revenus via frais de transfert' },
  { key: 'Chaîne YouTube',     level: 2, fee: 2500,   minCap: 1500,   revenue: 450,  npc: 220,  cooldown: 6 },
  { key: 'Cabinet de médecins',level: 2, fee: 3500,   minCap: 3000,   revenue: 600,  npc: null, cooldown: null },
  { key: "Cabinet d'avocats",  level: 2, fee: 2000,   minCap: 2000,   revenue: 1500, npc: null, cooldown: null },
  // Level 3
  { key: 'Banque',             level: 3, fee: 10000,  minCap: 0,      revenue: 0,    npc: null, cooldown: null, note: 'Revenus via intérêts et prêts' },
];

const SKILLS_DATA = [
  { label: 'Affaires',     color: 'text-emerald-400 bg-emerald-400/15', cost: 2500, how: 'Gérer et faire tourner ses entreprises', unlocks: '1 slot business par niveau' },
  { label: 'Social',       color: 'text-purple-400 bg-purple-400/15',   cost: 1800, how: "Acheter des biens immobiliers via une agence", unlocks: 'Réseau social étendu' },
  { label: 'Intelligence', color: 'text-sky-400 bg-sky-400/15',         cost: 2200, how: 'Acheter des formations dans un Centre de formation', unlocks: 'Accès aux opportunités avancées' },
  { label: 'Charisme',     color: 'text-pink-400 bg-pink-400/15',       cost: 2000, how: 'Recevoir de l\'Aura sur le site', unlocks: 'Négociation renforcée' },
  { label: 'Finance',      color: 'text-amber-400 bg-amber-400/15',     cost: 3000, how: 'Déposer de l\'argent en banque', unlocks: 'Meilleur rendement sur les investissements' },
  { label: 'Illégalité',   color: 'text-rose-400 bg-rose-400/15',       cost: 0,    how: 'Activités illégales (non entraînable manuellement)', unlocks: 'Accès au marché noir' },
];

function GuideSection({ title, children }: { title: string; children: import('react').ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className={TYPOGRAPHY.MUTED}>{title}</h3>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5 border-b border-border/20 last:border-0">
      <span className={cn(TYPOGRAPHY.SMALL, 'text-muted-foreground')}>{label}</span>
      <span className={cn(TYPOGRAPHY.SMALL, 'font-medium tabular-nums text-right')}>{value}</span>
    </div>
  );
}

function YouGameGuideContent() {
  return (
        <Accordion type="multiple" className="border-t border-border/20 mt-2 mb-4">

          {/* ── 1. Présentation ── */}
          <AccordionItem value="presentation">
            <AccordionTrigger className="py-5 hover:no-underline">
              <div className="flex items-center gap-3 text-left">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-sky-400/15">
                  <Star className="h-3.5 w-3.5 text-sky-400" />
                </div>
                <span className="text-sm font-semibold">Présentation</span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="pb-6 space-y-5">
                <p className={cn(TYPOGRAPHY.SMALL, 'leading-relaxed')}>
                  <strong>You</strong> est une simulation économique multijoueur intégrée à AuraTracker.
                  Tu y construis un empire d'entreprises, investis dans celles des autres joueurs, formes des alliances,
                  crées des relations — et tentes de t'enrichir sans te faire imposer toute ta fortune.
                </p>
                <GuideSection title="Les 8 onglets du jeu">
                  <div className="divide-y divide-border/20 rounded-xl border border-border/40 overflow-hidden">
                    {[
                      { icon: Star,           label: 'Vue d\'ensemble', desc: 'Dashboard : statistiques, fil d\'activité, notifications, guide de démarrage.' },
                      { icon: Briefcase,      label: 'Travail',         desc: 'Créer et gérer tes entreprises, consulter les offres d\'emploi reçues, voir tes participations.' },
                      { icon: TrendingUp,     label: 'Explorer',        desc: 'Parcourir tous les businesses des autres joueurs. Investir, emprunter, transférer, acheter des formations.' },
                      { icon: Heart,          label: 'Social',          desc: 'Gérer tes relations avec les autres joueurs (amitié, amour, mariage, liaison).' },
                      { icon: Wallet,         label: 'Finance',         desc: 'Vue financière globale : comptes bancaires, transactions, AuraCoin, historique.' },
                      { icon: Landmark,       label: 'Banques',         desc: 'Résumé de tous tes comptes courants et livrets d\'épargne dans les banques du jeu.' },
                      { icon: Map,            label: 'Carte',           desc: 'Carte de la ville avec les entreprises réparties par quartier (Commerce, Finance, Tech, Formation, Justice).' },
                      { icon: Star,           label: 'Publicités',      desc: 'Créer et gérer des annonces publicitaires pour tes propres entreprises.' },
                    ].map(({ icon: Icon, label, desc }) => (
                      <div key={label} className="flex items-start gap-3 px-4 py-3 bg-card/30">
                        <Icon className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                        <div>
                          <p className="text-xs font-semibold">{label}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </GuideSection>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* ── 2. Premiers pas ── */}
          <AccordionItem value="premiers-pas">
            <AccordionTrigger className="py-5 hover:no-underline">
              <div className="flex items-center gap-3 text-left">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-emerald-400/15">
                  <ShoppingBasket className="h-3.5 w-3.5 text-emerald-400" />
                </div>
                <span className="text-sm font-semibold">Premiers pas — créer son business</span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="pb-6 space-y-5">
                <p className={cn(TYPOGRAPHY.SMALL, 'leading-relaxed')}>
                  Au départ tu disposes d'<strong>1 slot business</strong>. Ce slot te permet de posséder une entreprise.
                  Pour en débloquer d'autres, tu dois monter le skill <strong>Affaires</strong> (1 slot supplémentaire par niveau).
                </p>
                <GuideSection title="Étapes pour créer sa première entreprise">
                  <div className="divide-y divide-border/20">
                    {[
                      { n: '1', t: 'Va dans l\'onglet Travail', d: 'Clique sur "Créer une entreprise". Le bouton indique ton ratio actuel de slots (ex. 0/1).' },
                      { n: '2', t: 'Choisis un type de niveau 1', d: 'Limonade (500 $), Épicerie (1 500 $) ou Restaurant (2 000 $). Ces trois types ne nécessitent aucun capital minimum — juste les frais de création.' },
                      { n: '3', t: 'Donne-lui un nom', d: 'Le nom doit être unique sur tout le jeu. Il sera visible par tous les autres joueurs dans Explorer.' },
                      { n: '4', t: 'Commence à collecter', d: 'Ouvre ton entreprise depuis Travail → Ouvrir, puis clique "Collecter les recettes". Des clients NPC visitent ton shop toutes les 6 heures.' },
                      { n: '5', t: 'Dépose de l\'argent en trésorerie', d: 'La trésorerie est le compte de l\'entreprise. Déposer ou retirer n\'affecte que toi (propriétaire).' },
                    ].map(({ n, t, d }) => (
                      <div key={n} className="grid grid-cols-[auto_1fr] items-start gap-x-3 py-3">
                        <span className={cn(TYPOGRAPHY.SMALL, 'text-muted-foreground tabular-nums leading-5 pt-0.5')}>{n}.</span>
                        <div>
                          <p className="text-sm font-medium">{t}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{d}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </GuideSection>
                <GuideSection title="Slots business et compétence Affaires">
                  <p className={cn(TYPOGRAPHY.SMALL, 'leading-relaxed')}>
                    Le nombre de slots dépend directement de ton niveau de compétence <strong>Affaires</strong> :
                    niveau 1 = 1 slot, niveau 2 = 2 slots, etc. jusqu'au niveau 10 maximum.
                    Chaque session d'entraînement Affaires coûte <strong>2 500 $</strong> et rapporte 25 XP.
                    Il faut 100 XP pour passer un niveau. Tu gagnes aussi de l'XP Affaires automatiquement en faisant tourner tes entreprises.
                  </p>
                  <p className={cn(TYPOGRAPHY.SMALL, 'text-muted-foreground')}>
                    Note : les entreprises où tu es employé(e) ne comptent pas dans ton quota de slots.
                  </p>
                </GuideSection>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* ── 3. Types d'entreprises ── */}
          <AccordionItem value="types">
            <AccordionTrigger className="py-5 hover:no-underline">
              <div className="flex items-center gap-3 text-left">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-violet-400/15">
                  <Building2 className="h-3.5 w-3.5 text-violet-400" />
                </div>
                <span className="text-sm font-semibold">Types d'entreprises</span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="pb-6 space-y-5">
                <p className={cn(TYPOGRAPHY.SMALL, 'leading-relaxed')}>
                  Les entreprises sont réparties en <strong>3 niveaux</strong>. Pour débloquer un niveau supérieur,
                  tu dois d'abord avoir possédé (ou posséder) une entreprise du niveau précédent — et ton niveau de
                  compétence Affaires doit correspondre.
                </p>

                {/* Level 1 */}
                <GuideSection title="Niveau 1 — Commerce de base">
                  <p className={cn(TYPOGRAPHY.SMALL, 'text-muted-foreground mb-2')}>
                    Accessibles dès le départ. Génèrent des recettes NPC collectables toutes les 6 heures.
                  </p>
                  <div className="space-y-2">
                    {BUSINESS_TYPES_DATA.filter(b => b.level === 1).map(b => (
                      <div key={b.key} className="rounded-xl border border-border/40 bg-muted/5 px-4 py-3 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold">{b.key}</p>
                          <Badge variant="outline" className="text-xs">Niveau 1</Badge>
                        </div>
                        <div className="grid grid-cols-3 gap-x-4 text-xs text-muted-foreground">
                          <span>Frais : <strong className="text-foreground">{b.fee.toLocaleString('fr-FR')} $</strong></span>
                          <span>Revenu/mois : <strong className="text-emerald-400">{b.revenue.toLocaleString('fr-FR')} $</strong></span>
                          {b.npc ? <span>Collect NPC : <strong className="text-lime-400">{b.npc} $ / 6 h</strong></span> : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </GuideSection>

                {/* Level 2 */}
                <GuideSection title="Niveau 2 — Entreprises intermédiaires">
                  <p className={cn(TYPOGRAPHY.SMALL, 'text-muted-foreground mb-2')}>
                    Nécessitent d'avoir déjà un business de niveau 1 et un capital minimum en trésorerie.
                  </p>
                  <div className="space-y-2">
                    {BUSINESS_TYPES_DATA.filter(b => b.level === 2).map(b => (
                      <div key={b.key} className="rounded-xl border border-border/40 bg-muted/5 px-4 py-3 space-y-1">
                        <div className="flex items-center justify-between gap-2 flex-wrap gap-y-1">
                          <p className="text-sm font-semibold">{b.key}</p>
                          <Badge variant="outline" className="text-xs">Niveau 2</Badge>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                          <span>Frais : <strong className="text-foreground">{b.fee.toLocaleString('fr-FR')} $</strong></span>
                          <span>Capital min : <strong className="text-amber-400">{b.minCap.toLocaleString('fr-FR')} $</strong></span>
                          {b.revenue > 0
                            ? <span>Revenu/mois : <strong className="text-emerald-400">{b.revenue.toLocaleString('fr-FR')} $</strong></span>
                            : b.note ? <span className="text-muted-foreground/70 italic">{b.note}</span> : null
                          }
                          {b.npc ? <span className="col-span-2 sm:col-span-1">Collect NPC : <strong className="text-lime-400">{b.npc} $ / 6 h</strong></span> : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </GuideSection>

                {/* Level 3 */}
                <GuideSection title="Niveau 3 — Banque">
                  <div className="rounded-xl border border-emerald-400/30 bg-emerald-400/5 px-4 py-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold">Banque</p>
                      <Badge variant="outline" className="text-xs border-emerald-400/40 text-emerald-400">Niveau 3</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Frais de création : <strong className="text-foreground">10 000 $</strong> · Capital minimum : <strong className="text-foreground">0 $</strong>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Revenu passif nul à l'ouverture. Les bénéfices viennent des <strong className="text-foreground">intérêts sur les prêts accordés</strong> et
                      des <strong className="text-foreground">dépôts des clients</strong>. Permet aussi d'ouvrir des livrets d'épargne.
                    </p>
                  </div>
                </GuideSection>

                <GuideSection title="Spécial — Startup Tech">
                  <p className={cn(TYPOGRAPHY.SMALL, 'leading-relaxed')}>
                    La Startup est unique : elle ne génère aucun revenu mensuel de base. Pour gagner de l'argent,
                    il faut <strong>lancer des recherches</strong> (R&D) sur chacun des 3 produits disponibles,
                    puis les <strong>déployer</strong>. Chaque déploiement augmente le niveau du produit et donc son revenu quotidien.
                    Les recherches prennent du temps réel et sont lancées depuis l'onglet Travail ou le panneau de gestion.
                  </p>
                </GuideSection>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* ── 4. Recettes et revenus ── */}
          <AccordionItem value="revenus">
            <AccordionTrigger className="py-5 hover:no-underline">
              <div className="flex items-center gap-3 text-left">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-lime-400/15">
                  <TrendingUp className="h-3.5 w-3.5 text-lime-400" />
                </div>
                <span className="text-sm font-semibold">Recettes et revenus</span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="pb-6 space-y-5">
                <GuideSection title="Revenu mensuel → quotidien">
                  <p className={cn(TYPOGRAPHY.SMALL, 'leading-relaxed')}>
                    Chaque entreprise a un revenu mensuel défini. Ce revenu est <strong>divisé par 30</strong> pour
                    calculer le revenu journalier (minimum 1 $), qui est automatiquement versé dans la trésorerie chaque jour à minuit.
                    Il apparaît dans le journal de transactions comme <em>Revenu quotidien</em>.
                  </p>
                </GuideSection>

                <GuideSection title="Collecte NPC (clients virtuels)">
                  <p className={cn(TYPOGRAPHY.SMALL, 'leading-relaxed')}>
                    Certaines entreprises — Limonade, Épicerie, Restaurant, Chaîne YouTube — ont des clients NPC
                    qui paient directement. Tu dois <strong>collecter manuellement</strong> ces recettes depuis l'onglet
                    de gestion de ton business. Le cooldown est de <strong>6 heures</strong> entre deux collectes.
                  </p>
                  <div className="rounded-xl border border-border/40 overflow-hidden mt-2">
                    <Row label="Limonade"    value="150 $ / 6 h" />
                    <Row label="Épicerie"    value="300 $ / 6 h" />
                    <Row label="Restaurant"  value="350 $ / 6 h" />
                    <Row label="YouTube"     value="220 $ / 6 h" />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Si tu ne collectes pas, l'argent attend sans se perdre — mais tu perds du temps de génération.
                  </p>
                </GuideSection>

                <GuideSection title="Ventes d'articles (items)">
                  <p className={cn(TYPOGRAPHY.SMALL, 'leading-relaxed')}>
                    Les Épiceries, Restaurants, Limonades et Cabinets de médecins peuvent aussi vendre des articles
                    spécifiques (boissons, plats, soins…). Ces articles apparaissent dans le panneau de l'entreprise
                    depuis Explorer. Chaque vente est enregistrée dans le journal de transactions.
                  </p>
                </GuideSection>

                <GuideSection title="Trésorerie">
                  <p className={cn(TYPOGRAPHY.SMALL, 'leading-relaxed')}>
                    Tous les revenus (collectes NPC, revenu quotidien, ventes, remboursements de prêts) arrivent dans
                    la <strong>trésorerie</strong> de l'entreprise — pas directement dans ton argent personnel.
                    Pour récupérer l'argent, tu dois faire un <strong>retrait</strong> depuis le panneau de gestion.
                    À l'inverse, tu peux <strong>déposer</strong> depuis ton argent personnel vers la trésorerie.
                  </p>
                </GuideSection>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* ── 5. Compétences ── */}
          <AccordionItem value="skills">
            <AccordionTrigger className="py-5 hover:no-underline">
              <div className="flex items-center gap-3 text-left">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-amber-400/15">
                  <Star className="h-3.5 w-3.5 text-amber-400" />
                </div>
                <span className="text-sm font-semibold">Compétences (Skills)</span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="pb-6 space-y-5">
                <p className={cn(TYPOGRAPHY.SMALL, 'leading-relaxed')}>
                  Il existe <strong>6 compétences</strong>, chacune allant de niveau 1 à 10.
                  Chaque compétence se monte de deux façons : en jouant naturellement (XP automatique selon les actions)
                  ou en payant une session d'entraînement manuel (coût en $ par session, +25 XP).
                  Il faut <strong>100 XP</strong> pour passer un niveau.
                </p>
                <div className="space-y-2">
                  {SKILLS_DATA.map((skill) => (
                    <div key={skill.label} className="rounded-xl border border-border/40 bg-muted/5 px-4 py-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold', skill.color)}>
                          {skill.label}
                        </span>
                        {skill.cost > 0
                          ? <span className="text-xs text-muted-foreground">{skill.cost.toLocaleString('fr-FR')} $ / entraînement</span>
                          : <span className="text-xs text-muted-foreground italic">Non entraînable</span>
                        }
                      </div>
                      <p className="text-xs text-muted-foreground">
                        <strong className="text-foreground/80">XP auto :</strong> {skill.how}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        <strong className="text-foreground/80">Débloque :</strong> {skill.unlocks}
                      </p>
                    </div>
                  ))}
                </div>
                <p className={cn(TYPOGRAPHY.SMALL, 'text-muted-foreground')}>
                  La compétence <strong>Illégalité</strong> se gagne uniquement via des actions spécifiques dans le jeu.
                  Elle n'est pas entraînable manuellement et donne accès à des mécaniques risquées.
                </p>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* ── 6. Explorer ── */}
          <AccordionItem value="explorer">
            <AccordionTrigger className="py-5 hover:no-underline">
              <div className="flex items-center gap-3 text-left">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-sky-400/15">
                  <TrendingUp className="h-3.5 w-3.5 text-sky-400" />
                </div>
                <span className="text-sm font-semibold">Investir et Explorer</span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="pb-6 space-y-5">
                <p className={cn(TYPOGRAPHY.SMALL, 'leading-relaxed')}>
                  L'onglet <strong>Explorer</strong> liste tous les businesses de tous les joueurs. Tu peux cliquer
                  sur n'importe lequel pour interagir — même si tu n'en es pas propriétaire.
                </p>

                <GuideSection title="Investir dans un business">
                  <p className={cn(TYPOGRAPHY.SMALL, 'leading-relaxed')}>
                    Tu peux investir une somme dans le business d'un autre joueur. Le propriétaire choisit un
                    <strong> niveau de risque</strong> (faible, moyen, élevé), ce qui détermine le rendement possible :
                  </p>
                  <div className="rounded-xl border border-border/40 overflow-hidden mt-2">
                    <Row label="Risque faible"  value="2 % – 5 % de rendement" />
                    <Row label="Risque moyen"   value="5 % – 15 % de rendement" />
                    <Row label="Risque élevé"   value="10 % – 40 % de rendement" />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Le rendement est aléatoire dans la plage correspondante, appliqué à ton montant investi.
                    Résultat visible dans le fil d'activité.
                  </p>
                </GuideSection>

                <GuideSection title="Demander un prêt (banques)">
                  <p className={cn(TYPOGRAPHY.SMALL, 'leading-relaxed')}>
                    Depuis une <strong>Banque</strong> en Explorer, tu peux envoyer une demande de prêt au propriétaire.
                    Si accepté, le montant est versé directement sur ton argent personnel.
                    Le taux d'emprunt est affiché sur la fiche de chaque banque.
                    Le remboursement se fait manuellement depuis le fil d'activité (Vue d'ensemble) :
                    tu choisis de rembourser 25 %, 50 %, 75 % ou 100 % du montant restant.
                  </p>
                </GuideSection>

                <GuideSection title="Transfert d'argent (Service de transfert)">
                  <p className={cn(TYPOGRAPHY.SMALL, 'leading-relaxed')}>
                    Pour envoyer de l'argent à un autre joueur, tu dois passer par un <strong>Service de transfert</strong>.
                    Le propriétaire du service applique des frais (taux visible sur la fiche). Le montant net arrive dans
                    l'argent personnel du destinataire, et les frais restent dans la trésorerie du service.
                  </p>
                </GuideSection>

                <GuideSection title="Formations (Centre de formation)">
                  <p className={cn(TYPOGRAPHY.SMALL, 'leading-relaxed')}>
                    Acheter une formation dans un <strong>Centre de formation</strong> t'offre de l'XP en compétence
                    <strong> Intelligence</strong>. Le prix de chaque formation est défini par le propriétaire du centre.
                    Si tu possèdes toi-même un centre, tu peux y créer des produits de formation et percevoir ces revenus.
                  </p>
                </GuideSection>

                <GuideSection title="Postuler comme employé">
                  <p className={cn(TYPOGRAPHY.SMALL, 'leading-relaxed')}>
                    Depuis la fiche d'un business en Explorer, si le recrutement est ouvert, tu peux envoyer une candidature.
                    L'employeur peut aussi t'envoyer une offre directement. Si acceptée, tu reçois un <strong>salaire journalier</strong>
                    versé automatiquement dans ton argent personnel.
                  </p>
                </GuideSection>

                <GuideSection title="Rachat et actionnariat">
                  <p className={cn(TYPOGRAPHY.SMALL, 'leading-relaxed')}>
                    Tu peux proposer de <strong>racheter</strong> entièrement un business à son propriétaire, ou lui
                    soumettre une <strong>proposition d'actionnariat</strong> (tu prends un % du business en échange
                    d'un investissement). Ces transactions sont négociées entre joueurs et les parts actionnaires sont
                    visibles dans l'onglet Travail.
                  </p>
                </GuideSection>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* ── 7. Banques ── */}
          <AccordionItem value="banques">
            <AccordionTrigger className="py-5 hover:no-underline">
              <div className="flex items-center gap-3 text-left">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-emerald-400/15">
                  <Landmark className="h-3.5 w-3.5 text-emerald-400" />
                </div>
                <span className="text-sm font-semibold">Banques et épargne</span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="pb-6 space-y-5">
                <p className={cn(TYPOGRAPHY.SMALL, 'leading-relaxed')}>
                  Les banques sont des enterprises de <strong>niveau 3</strong> créées par des joueurs.
                  Elles proposent deux types de comptes, accessibles depuis l'onglet Banques ou depuis Explorer.
                </p>
                <GuideSection title="Types de comptes">
                  <div className="rounded-xl border border-border/40 overflow-hidden">
                    <div className="px-4 py-3 space-y-1 border-b border-border/30">
                      <p className="text-xs font-semibold text-sky-400">Compte courant</p>
                      <p className="text-xs text-muted-foreground">Dépôt et retrait libres. Sert à stocker de l'argent hors de ton portefeuille principal. Les intérêts dépendent du taux de la banque.</p>
                    </div>
                    <div className="px-4 py-3 space-y-1">
                      <p className="text-xs font-semibold text-amber-400">Livret épargne</p>
                      <p className="text-xs text-muted-foreground">Disponible uniquement si le propriétaire de la banque l'a activé. Fonctionne comme un compte courant mais avec un taux d'intérêt potentiellement différent.</p>
                    </div>
                  </div>
                </GuideSection>
                <GuideSection title="Intérêts et prêts">
                  <p className={cn(TYPOGRAPHY.SMALL, 'leading-relaxed')}>
                    Chaque banque affiche son taux d'emprunt. Ce taux s'applique aux prêts que le propriétaire accorde.
                    Les intérêts sur les prêts accordés sont la principale source de revenus d'une banque —
                    raison pour laquelle les banques affichent un revenu mensuel de base nul.
                  </p>
                  <p className={cn(TYPOGRAPHY.SMALL, 'text-muted-foreground')}>
                    Monter la compétence <strong>Finance</strong> en déposant de l'argent en banque ouvre des
                    optimisations financières futures.
                  </p>
                </GuideSection>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* ── 8. Social ── */}
          <AccordionItem value="social">
            <AccordionTrigger className="py-5 hover:no-underline">
              <div className="flex items-center gap-3 text-left">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-pink-400/15">
                  <Heart className="h-3.5 w-3.5 text-pink-400" />
                </div>
                <span className="text-sm font-semibold">Relations sociales</span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="pb-6 space-y-5">
                <p className={cn(TYPOGRAPHY.SMALL, 'leading-relaxed')}>
                  L'onglet <strong>Social</strong> te permet de tisser des liens avec d'autres joueurs.
                  Les relations évoluent et ouvrent des fonctionnalités progressives.
                </p>

                <GuideSection title="Statuts de relation">
                  <div className="rounded-xl border border-border/40 overflow-hidden">
                    <Row label="Ami(e)"       value="Relation de base, pas de compte commun" />
                    <Row label="En couple"    value="Lien amoureux, option de mariage disponible" />
                    <Row label="Marié(e)"     value="Compte commun partagé entre les deux joueurs" />
                    <Row label="Liaison"      value="Relation parallèle risquée (voir ci-dessous)" />
                  </div>
                </GuideSection>

                <GuideSection title="Mariage et compte commun">
                  <p className={cn(TYPOGRAPHY.SMALL, 'leading-relaxed')}>
                    Lorsque deux joueurs se marient, un <strong>compte commun</strong> est créé. Chaque conjoint peut
                    y déposer ou retirer librement. En cas de <strong>divorce</strong>, le solde du compte commun
                    est divisé en deux parts égales, chacune reversée à son propriétaire.
                  </p>
                </GuideSection>

                <GuideSection title="Liaison et suspicion de tricherie">
                  <p className={cn(TYPOGRAPHY.SMALL, 'leading-relaxed')}>
                    Un joueur marié peut initier une <strong>liaison</strong> avec un tiers. C'est risqué :
                    le/la conjoint(e) peut activer une <strong>suspicion de tricherie</strong>.
                  </p>
                  <div className="rounded-xl border border-amber-400/25 bg-amber-400/10 px-4 py-3 space-y-2 mt-2">
                    <p className="text-xs font-semibold text-amber-300">Suspicion — deux issues possibles</p>
                    <p className="text-xs text-muted-foreground">
                      · Si la suspicion est <strong className="text-foreground">fondée</strong> (liaison réelle) :
                      le/la conjoint(e) récupère <strong>tout l'argent du foyer</strong> et vous divorcez automatiquement.
                    </p>
                    <p className="text-xs text-muted-foreground">
                      · Si la suspicion est <strong className="text-foreground">infondée</strong> :
                      le joueur accusé peut <strong>aller en justice</strong>. S'il choisit cette option, il récupère
                      tout l'argent de l'accusateur. S'il ignore, rien ne se passe.
                    </p>
                  </div>
                </GuideSection>

                <GuideSection title="Procès en justice">
                  <p className={cn(TYPOGRAPHY.SMALL, 'leading-relaxed')}>
                    Si tu es accusé(e) de tricherie à tort, tu reçois une notification de dossier judiciaire.
                    Tu as deux options : <strong>aller en justice</strong> (et potentiellement récupérer tout l'argent
                    de l'accusateur) ou <strong>ignorer</strong> (la situation se résout sans conséquences financières).
                    Les procès formels peuvent aussi passer par la <strong>Cour Suprême</strong> ou un
                    <strong> Cabinet d'avocats</strong> en Explorer.
                  </p>
                </GuideSection>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* ── 9. Emploi ── */}
          <AccordionItem value="emploi">
            <AccordionTrigger className="py-5 hover:no-underline">
              <div className="flex items-center gap-3 text-left">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-purple-400/15">
                  <Briefcase className="h-3.5 w-3.5 text-purple-400" />
                </div>
                <span className="text-sm font-semibold">Emplois et contrats</span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="pb-6 space-y-5">
                <p className={cn(TYPOGRAPHY.SMALL, 'leading-relaxed')}>
                  En dehors de tes propres businesses, tu peux être <strong>employé(e)</strong> dans ceux d'autres
                  joueurs. Ces postes sont distincts de tes slots business.
                </p>
                <GuideSection title="Comment ça marche">
                  <div className="divide-y divide-border/20">
                    {[
                      { t: 'Offre reçue',   d: "Un propriétaire de business t'invite via l'onglet Travail ou Explorer. L'offre affiche le rôle proposé, le salaire journalier et un message optionnel." },
                      { t: 'Candidature',   d: "Tu postules depuis la fiche d'un business en Explorer (si le recrutement est ouvert). L'employeur reçoit ta candidature et peut accepter ou refuser." },
                      { t: 'Salaire',       d: "Une fois accepté(e), tu reçois un salaire en $ chaque jour automatiquement dans ton argent personnel. Le montant est défini par l'employeur." },
                      { t: 'Actionnariat', d: "Si le propriétaire te propose un % du business en échange d'un investissement, la part te revient en tant qu'actionnaire. Visible dans Travail > Participations actionnaires." },
                    ].map(({ t, d }) => (
                      <div key={t} className="py-3">
                        <p className="text-sm font-medium">{t}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{d}</p>
                      </div>
                    ))}
                  </div>
                </GuideSection>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* ── 10. Carte ── */}
          <AccordionItem value="carte">
            <AccordionTrigger className="py-5 hover:no-underline">
              <div className="flex items-center gap-3 text-left">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-cyan-400/15">
                  <Map className="h-3.5 w-3.5 text-cyan-400" />
                </div>
                <span className="text-sm font-semibold">La carte de la ville</span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="pb-6 space-y-5">
                <p className={cn(TYPOGRAPHY.SMALL, 'leading-relaxed')}>
                  L'onglet <strong>Carte</strong> affiche une vue de la ville divisée en quartiers.
                  Chaque quartier regroupe les businesses d'un secteur. Tu peux cliquer sur les épingles
                  pour accéder directement à la fiche d'une entreprise.
                </p>
                <GuideSection title="Quartiers">
                  <div className="rounded-xl border border-border/40 overflow-hidden">
                    <Row label="Commerce"   value="Limonade, Épicerie, Restaurant, Coffee Shop" />
                    <Row label="Finance"    value="Banque, Service de transfert" />
                    <Row label="Tech"       value="Startup Tech, Agence Immobilière" />
                    <Row label="Formation"  value="Centre de formation" />
                    <Row label="Justice"    value="Cabinet d'avocats, Cour Suprême" />
                  </div>
                </GuideSection>
              </div>
            </AccordionContent>
          </AccordionItem>

        </Accordion>
  );
}

// ─── Guide du nouvel arrivant ─────────────────────────────────────────────────

function NewcomerGuideContent() {
  return (
    <Accordion type="multiple" className="border-t border-border/20 mt-2 mb-4">

      {/* ── 1. Présentation ── */}
      <AccordionItem value="newcomer-presentation">
        <AccordionTrigger className="py-5 hover:no-underline">
          <div className="flex items-center gap-3 text-left">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-sky-400/15">
              <Star className="h-3.5 w-3.5 text-sky-400" />
            </div>
            <span className="text-sm font-semibold">Bienvenue sur AuraTracker</span>
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <div className="pb-6 space-y-5">
            <p className={cn(TYPOGRAPHY.SMALL, 'leading-relaxed')}>
              AuraTracker est une plateforme communautaire centrée autour d'un système de <strong>double monnaie</strong> :
              l'<strong>Aura</strong> (prestige, notoriété) et l'<strong>Argent $</strong> (économie in-game).
              La plateforme intègre des jeux, une simulation économique multijoueur (You), un système social complet, des boutiques, des clans et bien plus.
            </p>
            <GuideSection title="Deux monnaies, deux rôles">
              <div className="rounded-xl border border-border/40 overflow-hidden">
                <div className="px-4 py-3 space-y-1 border-b border-border/30">
                  <p className="text-xs font-semibold text-amber-400">Aura ✦</p>
                  <p className="text-xs text-muted-foreground">
                    Monnaie de prestige. Elle reflète ta réputation sur la plateforme. Tu peux en recevoir de la part d'autres joueurs,
                    en gagner via les jeux ou les quêtes. Tu peux en donner jusqu'à <strong className="text-foreground">100 par jour</strong>.
                  </p>
                </div>
                <div className="px-4 py-3 space-y-1">
                  <p className="text-xs font-semibold text-emerald-400">Argent $</p>
                  <p className="text-xs text-muted-foreground">
                    Monnaie in-game. Sert à acheter, investir, créer des entreprises dans You, jouer au casino.
                    Tu démarres avec <strong className="text-foreground">1 000 $</strong> sur ton compte.
                  </p>
                </div>
              </div>
            </GuideSection>
            <GuideSection title="Comment s'inscrire et être approuvé ?">
              <p className={cn(TYPOGRAPHY.SMALL, 'leading-relaxed')}>
                La plateforme est réservée à une communauté restreinte. Après inscription, ton compte doit être
                <strong> approuvé par un administrateur</strong> avant de pouvoir accéder à toutes les fonctionnalités.
                Tant qu'il ne l'est pas, certaines pages et actions restent bloquées.
              </p>
            </GuideSection>
          </div>
        </AccordionContent>
      </AccordionItem>

      {/* ── 2. Gagner de l'argent ── */}
      <AccordionItem value="newcomer-money">
        <AccordionTrigger className="py-5 hover:no-underline">
          <div className="flex items-center gap-3 text-left">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-emerald-400/15">
              <Wallet className="h-3.5 w-3.5 text-emerald-400" />
            </div>
            <span className="text-sm font-semibold">Gagner de l'argent ($)</span>
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <div className="pb-6 space-y-5">
            <p className={cn(TYPOGRAPHY.SMALL, 'leading-relaxed')}>
              L'argent s'obtient via plusieurs sources. Certaines ont un <strong>plafond journalier de 1 000 $</strong> (jeux + quêtes combinés).
            </p>
            <GuideSection title="Sources de revenus">
              <div className="divide-y divide-border/20 rounded-xl border border-border/40 overflow-hidden">
                {[
                  { src: 'Jeux', detail: 'Doodle Jump, Flappy Bird, 2048, Solitaire et autres rapportent de l\'argent à chaque partie. Plafond commun : 1 000 $ / jour (toutes activités confondues).', cap: true },
                  { src: 'Quêtes quotidiennes', detail: '3 quêtes sont assignées chaque jour. Les compléter rapporte de l\'argent et de l\'Aura. Leur récompense compte dans le plafond journalier.', cap: true },
                  { src: 'Pass (claim journalier)', detail: 'Réclamer son pass chaque jour octroie une récompense aléatoire (argent, Aura, items). Un bonus de streak s\'applique si tu ne rates pas de jour.', cap: false },
                  { src: 'Jeu You', detail: 'Revenus d\'entreprises, salaires, remboursements de prêts, investissements. Aucun plafond — mais soumis aux impôts journaliers.', cap: false },
                  { src: 'Emploi (jeu You)', detail: 'Être employé dans le business d\'un autre joueur génère un salaire journalier automatique.', cap: false },
                  { src: 'Marché & Marketplace', detail: 'Vendre des items ou faire du commerce avec d\'autres joueurs.', cap: false },
                ].map(({ src, detail, cap }) => (
                  <div key={src} className="flex items-start gap-3 px-4 py-3 bg-card/30">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-xs font-semibold">{src}</p>
                        {cap && <span className="text-[10px] text-amber-400 border border-amber-400/30 rounded px-1">Plafonné</span>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </GuideSection>
          </div>
        </AccordionContent>
      </AccordionItem>

      {/* ── 3. L'Aura ── */}
      <AccordionItem value="newcomer-aura">
        <AccordionTrigger className="py-5 hover:no-underline">
          <div className="flex items-center gap-3 text-left">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-amber-400/15">
              <Sparkles className="h-3.5 w-3.5 text-amber-400" />
            </div>
            <span className="text-sm font-semibold">L'Aura — prestige et réputation</span>
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <div className="pb-6 space-y-5">
            <p className={cn(TYPOGRAPHY.SMALL, 'leading-relaxed')}>
              L'Aura est la mesure de ton prestige sur la plateforme. Contrairement à l'argent, elle ne sert pas à acheter directement des
              choses dans la boutique — elle reflète ta notoriété et débloque des avantages passifs (ex. : la compétence Charisme dans You).
            </p>
            <GuideSection title="Comment recevoir de l'Aura">
              <div className="divide-y divide-border/20">
                {[
                  { t: 'Don d\'un autre joueur', d: "N'importe quel joueur peut t'envoyer de l'Aura depuis ton profil. Chaque joueur est limité à 100 Aura données par jour (toutes cibles confondues)." },
                  { t: 'Jeux', d: 'Doodle Jump et certains autres jeux rapportent de l\'Aura. Plafond : 500 Aura / jour via les jeux.' },
                  { t: 'Quêtes quotidiennes', d: 'Certaines quêtes récompensent directement en Aura.' },
                  { t: 'Pass journalier', d: 'Les récompenses du pass peuvent inclure de l\'Aura selon la rareté tirée.' },
                ].map(({ t, d }) => (
                  <div key={t} className="py-3">
                    <p className="text-sm font-medium">{t}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{d}</p>
                  </div>
                ))}
              </div>
            </GuideSection>
            <GuideSection title="Donner de l'Aura">
              <p className={cn(TYPOGRAPHY.SMALL, 'leading-relaxed')}>
                Depuis le profil d'un autre joueur, tu peux lui envoyer de l'Aura avec un message optionnel.
                Tu peux donner au maximum <strong>100 Aura par jour</strong>, répartis comme tu le souhaites entre plusieurs joueurs.
                Ce compteur se remet à zéro chaque nuit à minuit (heure de Paris).
              </p>
            </GuideSection>
          </div>
        </AccordionContent>
      </AccordionItem>

      {/* ── 4. Systèmes quotidiens ── */}
      <AccordionItem value="newcomer-daily">
        <AccordionTrigger className="py-5 hover:no-underline">
          <div className="flex items-center gap-3 text-left">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-violet-400/15">
              <GraduationCap className="h-3.5 w-3.5 text-violet-400" />
            </div>
            <span className="text-sm font-semibold">Systèmes quotidiens</span>
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <div className="pb-6 space-y-5">
            <GuideSection title="Quêtes (3 par jour)">
              <p className={cn(TYPOGRAPHY.SMALL, 'leading-relaxed')}>
                Chaque jour, <strong>3 quêtes</strong> sont automatiquement assignées depuis un pool de missions disponibles.
                Elles peuvent porter sur les jeux, la vie sociale, l'économie, etc.
                Une fois les 3 complétées, c'est terminé pour la journée — elles se renouvellent à minuit.
                Les récompenses varient : argent $, Aura, ou items.
              </p>
            </GuideSection>
            <GuideSection title="Pass journalier">
              <p className={cn(TYPOGRAPHY.SMALL, 'leading-relaxed')}>
                Le <strong>Pass</strong> te permet de réclamer une récompense une fois par jour. Plus tu maintiens ton
                <strong> streak</strong> (jours consécutifs), plus les récompenses sont bonnes.
              </p>
              <div className="rounded-xl border border-border/40 overflow-hidden mt-2">
                <Row label="Commun"     value="Récompenses légères (argent / Aura de base)" />
                <Row label="Rare"       value="Récompenses intermédiaires" />
                <Row label="Épique"     value="Récompenses significatives" />
                <Row label="Légendaire" value="Récompenses rares et élevées" />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                La rareté est tirée aléatoirement. Ne pas réclamer son pass un jour remet le streak à zéro.
              </p>
            </GuideSection>
            <GuideSection title="AuraScroll">
              <p className={cn(TYPOGRAPHY.SMALL, 'leading-relaxed')}>
                L'<strong>AuraScroll</strong> est le fil d'actualité de la plateforme. Tu peux y publier des posts,
                commenter et interagir avec la communauté. Accessible depuis la sidebar ou le dashboard.
              </p>
            </GuideSection>
          </div>
        </AccordionContent>
      </AccordionItem>

      {/* ── 5. Les jeux ── */}
      <AccordionItem value="newcomer-games">
        <AccordionTrigger className="py-5 hover:no-underline">
          <div className="flex items-center gap-3 text-left">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-lime-400/15">
              <Gamepad2 className="h-3.5 w-3.5 text-lime-400" />
            </div>
            <span className="text-sm font-semibold">Les jeux</span>
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <div className="pb-6 space-y-5">
            <p className={cn(TYPOGRAPHY.SMALL, 'leading-relaxed')}>
              La plateforme propose plus de 30 jeux accessibles depuis la sidebar. Certains rapportent de l'argent et/ou de l'Aura,
              d'autres sont purement récréatifs. Deux plafonds journaliers s'appliquent aux gains via les jeux :
            </p>
            <div className="rounded-xl border border-border/40 overflow-hidden">
              <Row label="Plafond argent"    value="1 000 $ / jour (jeux + quêtes)" />
              <Row label="Plafond Aura"      value="500 Aura / jour (jeux)" />
            </div>
            <GuideSection title="Jeux avec récompenses">
              <div className="divide-y divide-border/20 rounded-xl border border-border/40 overflow-hidden">
                {[
                  { name: 'Doodle Jump', detail: 'Récompenses progressives selon le score. Bonus score élevé : jusqu\'à +100 Aura supplémentaire. Bon rapport Aura/partie.' },
                  { name: 'Flappy Bird', detail: 'Récompense à chaque partie, montant variable selon les performances.' },
                  { name: '2048', detail: 'Récompense à la fin de la partie.' },
                  { name: 'Solitaire', detail: 'Récompense pour les parties complétées.' },
                ].map(({ name, detail }) => (
                  <div key={name} className="flex items-start gap-3 px-4 py-3 bg-card/30">
                    <div>
                      <p className="text-xs font-semibold">{name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{detail}</p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Les autres jeux (Casino, Russian Roulette, Poker…) fonctionnent avec ton argent personnel : tu peux gagner ou perdre — ils n'entrent pas dans le plafond journalier de gains.
              </p>
            </GuideSection>
          </div>
        </AccordionContent>
      </AccordionItem>

      {/* ── 6. Social ── */}
      <AccordionItem value="newcomer-social">
        <AccordionTrigger className="py-5 hover:no-underline">
          <div className="flex items-center gap-3 text-left">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-purple-400/15">
              <Users className="h-3.5 w-3.5 text-purple-400" />
            </div>
            <span className="text-sm font-semibold">Fonctionnalités sociales</span>
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <div className="pb-6 space-y-5">
            <GuideSection title="Groupe (Party)">
              <p className={cn(TYPOGRAPHY.SMALL, 'leading-relaxed')}>
                Tu peux rejoindre ou créer un <strong>groupe</strong> avec d'autres joueurs. Le groupe permet de
                coordonner des activités communes, notamment pour les jeux multijoueurs comme Bomb Party, Poker ou Bataille Navale.
              </p>
            </GuideSection>
            <GuideSection title="Clans">
              <p className={cn(TYPOGRAPHY.SMALL, 'leading-relaxed')}>
                Les <strong>clans</strong> sont des organisations permanentes avec un nom, une hiérarchie et des
                membres. Rejoindre un clan te permet de participer à des guerres inter-clans et de bénéficier
                d'éventuels boosts achetés par le clan (ex. : bonus d'argent dans les jeux).
              </p>
            </GuideSection>
            <GuideSection title="Messages">
              <p className={cn(TYPOGRAPHY.SMALL, 'leading-relaxed')}>
                Tu peux envoyer des messages privés à n'importe quel autre joueur approuvé.
                Les conversations sont accessibles depuis le header (icône message).
              </p>
            </GuideSection>
            <GuideSection title="Profil et personnalisation">
              <p className={cn(TYPOGRAPHY.SMALL, 'leading-relaxed')}>
                Ton profil affiche ton Aura, ton argent, ton rang, et ta bio. Tu peux le personnaliser avec des items
                achetés en boutique : couleur de pseudo, photo de profil, bannière, etc.
              </p>
            </GuideSection>
          </div>
        </AccordionContent>
      </AccordionItem>

      {/* ── 7. Boutique & Marketplace ── */}
      <AccordionItem value="newcomer-shop">
        <AccordionTrigger className="py-5 hover:no-underline">
          <div className="flex items-center gap-3 text-left">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-pink-400/15">
              <ShoppingCart className="h-3.5 w-3.5 text-pink-400" />
            </div>
            <span className="text-sm font-semibold">Boutique & Marketplace</span>
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <div className="pb-6 space-y-5">
            <GuideSection title="Boutique (Market)">
              <p className={cn(TYPOGRAPHY.SMALL, 'leading-relaxed')}>
                La boutique officielle vend des items cosmétiques et des boosts, achetables en argent $ ou en Aura.
              </p>
              <div className="divide-y divide-border/20 rounded-xl border border-border/40 overflow-hidden mt-2">
                {[
                  { name: 'Couleur de pseudo',     detail: 'Change la couleur affichée de ton nom.' },
                  { name: 'Photo de profil',        detail: 'Personnalise ton avatar.' },
                  { name: 'Bannière de profil',     detail: 'Ajoute une bannière à la fiche de ton profil.' },
                  { name: 'Skin Doodle Jump',       detail: 'Change l\'apparence de ton personnage dans le jeu.' },
                  { name: 'Boosts de clan',         detail: 'Boost d\'argent en jeu ou visuel (photo/bannière de clan) — achetables pour bénéficier tout le clan.' },
                  { name: 'Bonus Aura / Argent',    detail: 'Multiplicateurs temporaires sur les gains.' },
                ].map(({ name, detail }) => (
                  <div key={name} className="flex items-start gap-3 px-4 py-3 bg-card/30">
                    <div>
                      <p className="text-xs font-semibold">{name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </GuideSection>
            <GuideSection title="Marketplace (joueur à joueur)">
              <p className={cn(TYPOGRAPHY.SMALL, 'leading-relaxed')}>
                La <strong>Marketplace</strong> permet aux joueurs de vendre ou acheter des items entre eux.
                Tu peux y proposer un item de ton inventaire à un prix librement fixé. Les transactions sont directes et en $.
              </p>
            </GuideSection>
          </div>
        </AccordionContent>
      </AccordionItem>

      {/* ── 8. Le jeu You (intro) ── */}
      <AccordionItem value="newcomer-you">
        <AccordionTrigger className="py-5 hover:no-underline">
          <div className="flex items-center gap-3 text-left">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-sky-400/15">
              <Building2 className="h-3.5 w-3.5 text-sky-400" />
            </div>
            <span className="text-sm font-semibold">Le jeu You — simulation économique</span>
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <div className="pb-6 space-y-5">
            <p className={cn(TYPOGRAPHY.SMALL, 'leading-relaxed')}>
              <strong>You</strong> est le coeur économique d'AuraTracker. C'est une simulation où tu crées et gères
              des entreprises, investis dans celles des autres, embauches, empruntes, te maries, et bien plus.
              C'est la principale façon de gagner des sommes importantes en $.
            </p>
            <GuideSection title="Par où commencer dans You ?">
              <div className="divide-y divide-border/20">
                {[
                  { n: '1', t: 'Crée ta première entreprise', d: 'Va dans You → Travail → Créer. Tu démarres avec 1 slot. Choisis entre Limonade (500 $), Épicerie (1 500 $) ou Restaurant (2 000 $).' },
                  { n: '2', t: 'Collecte régulièrement', d: 'Les clients NPC paient toutes les 6 heures. Reviens régulièrement pour collecter et renflouer ta trésorerie.' },
                  { n: '3', t: 'Explore les autres joueurs', d: 'Dans Explorer, tu vois tous les businesses actifs. Tu peux y investir, postuler comme employé, emprunter.' },
                  { n: '4', t: 'Monte tes compétences', d: '6 compétences évolutives. La plus utile au départ : Affaires (déblocage de slots supplémentaires).' },
                ].map(({ n, t, d }) => (
                  <div key={n} className="grid grid-cols-[auto_1fr] items-start gap-x-3 py-3">
                    <span className={cn(TYPOGRAPHY.SMALL, 'text-muted-foreground tabular-nums leading-5 pt-0.5')}>{n}.</span>
                    <div>
                      <p className="text-sm font-medium">{t}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{d}</p>
                    </div>
                  </div>
                ))}
              </div>
            </GuideSection>
            <p className={cn(TYPOGRAPHY.SMALL, 'text-muted-foreground')}>
              Pour les détails complets (entreprises, investissements, banques, mariage, emploi…), consulte le <strong className="text-foreground">Guide du jeu You</strong> dans cet onglet Tutoriels.
            </p>
          </div>
        </AccordionContent>
      </AccordionItem>

      {/* ── 9. Impôts ── */}
      <AccordionItem value="newcomer-taxes">
        <AccordionTrigger className="py-5 hover:no-underline">
          <div className="flex items-center gap-3 text-left">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-rose-400/15">
              <Landmark className="h-3.5 w-3.5 text-rose-400" />
            </div>
            <span className="text-sm font-semibold">Impôts journaliers — attention !</span>
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <div className="pb-6 space-y-5">
            <div className="rounded-xl border border-amber-400/25 bg-amber-400/10 px-4 py-3 space-y-2">
              <p className="text-xs font-semibold text-amber-300">À savoir avant de t'enrichir</p>
              <p className="text-xs text-muted-foreground">
                Chaque nuit à <strong className="text-foreground">minuit (Paris)</strong>, si ton solde dépasse un certain seuil,
                un impôt est automatiquement prélevé. Par défaut, le seuil est à <strong className="text-foreground">10 000 $</strong> avec un taux de <strong className="text-foreground">1 % / jour</strong>.
                Les administrateurs peuvent ajuster ces paliers à tout moment.
              </p>
            </div>
            <GuideSection title="Ce que ça change pour toi">
              <div className="divide-y divide-border/20">
                {[
                  { t: 'Sous le seuil', d: 'Aucun impôt prélevé. Tu accumules librement.' },
                  { t: 'Au-dessus du seuil', d: 'Un pourcentage est déduit chaque jour sur la totalité de ton solde. Plus tu es riche, plus les montants sont significatifs.' },
                  { t: 'Stratégie', d: 'Beaucoup de joueurs investissent en banque, dépensent en boutique ou dans You pour éviter de dépasser le seuil. Garde un œil sur les paliers en vigueur dans l\'onglet Informations.' },
                ].map(({ t, d }) => (
                  <div key={t} className="py-3">
                    <p className="text-sm font-medium">{t}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{d}</p>
                  </div>
                ))}
              </div>
            </GuideSection>
          </div>
        </AccordionContent>
      </AccordionItem>

    </Accordion>
  );
}

// ─── Guide des Clans ──────────────────────────────────────────────────────────

function ClanGuideContent() {
  return (
    <Accordion type="multiple" className="border-t border-border/20 mt-2 mb-4">

      {/* ── 1. Présentation ── */}
      <AccordionItem value="clan-presentation">
        <AccordionTrigger className="py-5 hover:no-underline">
          <div className="flex items-center gap-3 text-left">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-sky-400/15">
              <Flag className="h-3.5 w-3.5 text-sky-400" />
            </div>
            <span className="text-sm font-semibold">Présentation</span>
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <div className="pb-6 space-y-5">
            <p className={cn(TYPOGRAPHY.SMALL, 'leading-relaxed')}>
              Un <strong>clan</strong> est un groupe permanent de joueurs qui partagent une identité commune,
              coopèrent lors de guerres et d'événements, et gèrent ensemble une banque de clan et une Nation.
              Rejoindre ou créer un clan est l'une des façons les plus efficaces de progresser et de peser dans l'économie de la plateforme.
            </p>
            <GuideSection title="Ce qu'un clan apporte">
              <div className="rounded-xl border border-border/40 overflow-hidden">
                {[
                  { label: 'Guerres de clans',    desc: 'Affronte d\'autres clans sur 7 jours via des mini-jeux. Victoire = trophées + argent + Aura pour tous les membres.' },
                  { label: 'Banque commune',      desc: 'Les membres alimentent une caisse collective qui finance les boosts Nation et les récompenses de guerre.' },
                  { label: 'Nation',              desc: 'Chaque clan possède une Nation avec un territoire mondial, des alliances, un marché noir et des stats d\'influence.' },
                  { label: 'Événements',          desc: 'Des défis communautaires ponctuels avec classement interne et mini-jeux exclusifs.' },
                  { label: 'Chat privé',          desc: 'Canal de communication réservé aux membres du clan.' },
                  { label: 'Items & effets',      desc: 'Boosts d\'argent en jeu, cosmétiques de clan (photo, bannière), tag personnalisé affiché sur le profil.' },
                ].map(({ label, desc }) => (
                  <div key={label} className="flex items-start gap-3 px-4 py-3 bg-card/30 border-b border-border/20 last:border-0">
                    <div>
                      <p className="text-xs font-semibold">{label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </GuideSection>
          </div>
        </AccordionContent>
      </AccordionItem>

      {/* ── 2. Créer un clan ── */}
      <AccordionItem value="clan-create">
        <AccordionTrigger className="py-5 hover:no-underline">
          <div className="flex items-center gap-3 text-left">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-emerald-400/15">
              <Wallet className="h-3.5 w-3.5 text-emerald-400" />
            </div>
            <span className="text-sm font-semibold">Créer un clan</span>
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <div className="pb-6 space-y-5">
            <p className={cn(TYPOGRAPHY.SMALL, 'leading-relaxed')}>
              N'importe quel joueur approuvé, sans clan actuel, peut créer le sien. La création coûte <strong>100 $</strong>.
            </p>
            <div className="rounded-xl border border-border/40 overflow-hidden">
              <Row label="Coût de création"   value="100 $" />
              <Row label="Longueur du nom"    value="3 à 32 caractères" />
              <Row label="Description"        value="Jusqu'à 300 caractères" />
              <Row label="Membres max"        value="5 (extensible via items)" />
              <Row label="Visibilité"         value="Public (rejoindre librement) ou privé (sur demande)" />
            </div>
            <GuideSection title="Public vs privé">
              <div className="rounded-xl border border-border/40 overflow-hidden">
                <div className="px-4 py-3 space-y-1 border-b border-border/30">
                  <p className="text-xs font-semibold text-emerald-400">Public</p>
                  <p className="text-xs text-muted-foreground">N'importe qui peut rejoindre directement sans accord du chef.</p>
                </div>
                <div className="px-4 py-3 space-y-1">
                  <p className="text-xs font-semibold text-amber-400">Privé</p>
                  <p className="text-xs text-muted-foreground">Les candidats envoient une demande. Le chef peut accepter ou refuser. Une notification est envoyée au chef à chaque nouvelle demande.</p>
                </div>
              </div>
            </GuideSection>
            <p className={cn(TYPOGRAPHY.SMALL, 'text-muted-foreground')}>
              Un joueur ne peut appartenir qu'à <strong className="text-foreground">un seul clan à la fois</strong>. Quitter un clan est définitif — tu perds l'accès au chat, à la banque et aux guerres en cours.
            </p>
          </div>
        </AccordionContent>
      </AccordionItem>

      {/* ── 3. Rejoindre un clan ── */}
      <AccordionItem value="clan-join">
        <AccordionTrigger className="py-5 hover:no-underline">
          <div className="flex items-center gap-3 text-left">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-purple-400/15">
              <Users className="h-3.5 w-3.5 text-purple-400" />
            </div>
            <span className="text-sm font-semibold">Rejoindre un clan</span>
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <div className="pb-6 space-y-5">
            <GuideSection title="Étapes pour rejoindre">
              <div className="divide-y divide-border/20">
                {[
                  { n: '1', t: 'Parcourir les clans', d: 'La page Clans liste tous les clans avec leur Aura totale, nombre de membres, trophées de guerre et statut.' },
                  { n: '2', t: 'Rejoindre ou candidater', d: 'Clan public → rejoins directement. Clan privé → envoie une demande. Le chef sera notifié et pourra l\'accepter ou la refuser.' },
                  { n: '3', t: 'Accès aux fonctionnalités', d: 'Une fois membre, tu accèdes au chat, à la banque de clan, aux guerres et aux événements.' },
                ].map(({ n, t, d }) => (
                  <div key={n} className="grid grid-cols-[auto_1fr] items-start gap-x-3 py-3">
                    <span className={cn(TYPOGRAPHY.SMALL, 'text-muted-foreground tabular-nums leading-5 pt-0.5')}>{n}.</span>
                    <div>
                      <p className="text-sm font-medium">{t}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{d}</p>
                    </div>
                  </div>
                ))}
              </div>
            </GuideSection>
          </div>
        </AccordionContent>
      </AccordionItem>

      {/* ── 4. Hiérarchie ── */}
      <AccordionItem value="clan-hierarchy">
        <AccordionTrigger className="py-5 hover:no-underline">
          <div className="flex items-center gap-3 text-left">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-amber-400/15">
              <Trophy className="h-3.5 w-3.5 text-amber-400" />
            </div>
            <span className="text-sm font-semibold">Hiérarchie et rôles</span>
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <div className="pb-6 space-y-5">
            <div className="rounded-xl border border-border/40 overflow-hidden">
              <div className="px-4 py-3 space-y-2 border-b border-border/30">
                <p className="text-xs font-semibold text-amber-400">Chef (Leader)</p>
                <div className="space-y-0.5 text-xs text-muted-foreground">
                  <p>· Déclarer les guerres de clans</p>
                  <p>· Accepter / refuser les demandes d'adhésion</p>
                  <p>· Promouvoir / rétrograder des membres</p>
                  <p>· Expulser un membre</p>
                  <p>· Transférer le leadership à un autre membre</p>
                  <p>· Modifier le nom, la description, l'image du clan</p>
                  <p>· Configurer le tag, la Nation et le drapeau</p>
                  <p>· Gérer les messages d'encouragement (pump-up)</p>
                </div>
              </div>
              <div className="px-4 py-3 space-y-1">
                <p className="text-xs font-semibold text-muted-foreground">Membre</p>
                <p className="text-xs text-muted-foreground">Participer aux guerres, aux événements, déposer dans la banque, utiliser le chat, utiliser les items de clan.</p>
              </div>
            </div>
            <p className={cn(TYPOGRAPHY.SMALL, 'text-muted-foreground')}>
              Le chef peut transférer son rôle à un autre membre à tout moment depuis la fiche du clan. L'ancien chef devient un membre ordinaire.
            </p>
          </div>
        </AccordionContent>
      </AccordionItem>

      {/* ── 5. Banque de clan ── */}
      <AccordionItem value="clan-bank">
        <AccordionTrigger className="py-5 hover:no-underline">
          <div className="flex items-center gap-3 text-left">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-sky-400/15">
              <Landmark className="h-3.5 w-3.5 text-sky-400" />
            </div>
            <span className="text-sm font-semibold">Banque de clan</span>
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <div className="pb-6 space-y-5">
            <p className={cn(TYPOGRAPHY.SMALL, 'leading-relaxed')}>
              La <strong>banque de clan</strong> est une caisse collective alimentée par les dépôts volontaires des membres.
              Elle sert à financer les boosts Nation (achat de boost hebdomadaire, marché noir) et peut contribuer aux ressources de guerre.
            </p>
            <GuideSection title="Comment ça marche">
              <div className="divide-y divide-border/20">
                {[
                  { t: 'Déposer', d: 'Depuis l\'onglet Banque du clan, tout membre peut verser de l\'argent dans la caisse. Le dépôt est irreversible — l\'argent appartient au clan, pas à toi personnellement.' },
                  { t: 'Historique', d: 'Chaque contribution est tracée avec le nom du membre, la date et le montant. Accessible depuis la liste des contributions.' },
                  { t: 'Utilisation', d: 'Le chef utilise la caisse pour acheter des boosts hebdomadaires Nation (150 000 $) ou des armes au marché noir.' },
                ].map(({ t, d }) => (
                  <div key={t} className="py-3">
                    <p className="text-sm font-medium">{t}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{d}</p>
                  </div>
                ))}
              </div>
            </GuideSection>
          </div>
        </AccordionContent>
      </AccordionItem>

      {/* ── 6. Guerres de clans ── */}
      <AccordionItem value="clan-war">
        <AccordionTrigger className="py-5 hover:no-underline">
          <div className="flex items-center gap-3 text-left">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-rose-400/15">
              <Swords className="h-3.5 w-3.5 text-rose-400" />
            </div>
            <span className="text-sm font-semibold">Guerres de clans</span>
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <div className="pb-6 space-y-5">
            <p className={cn(TYPOGRAPHY.SMALL, 'leading-relaxed')}>
              Une guerre oppose deux clans sur <strong>7 jours</strong>. Le clan qui accumule le plus de points de combat remporte la victoire.
              Tous les membres reçoivent une récompense en argent et en Aura à la fin, gagnants comme perdants.
            </p>

            <GuideSection title="Conditions et règles">
              <div className="rounded-xl border border-border/40 overflow-hidden">
                <Row label="Déclencheur"          value="Le chef déclare la guerre (onglet Guerre)" />
                <Row label="Membres minimum"      value="3 par clan" />
                <Row label="Durée"                value="7 jours" />
                <Row label="Score cible"          value="180 points" />
                <Row label="Stamina / joueur"     value="3 par tranche de 24 h" />
                <Row label="Fortifications"       value="2 par membre sur toute la guerre" />
                <Row label="Matchmaking"          value="Par trophées — adversaire le plus proche disponible" />
              </div>
            </GuideSection>

            <GuideSection title="3 mini-jeux de guerre">
              <div className="space-y-2">
                {[
                  {
                    icon: GraduationCap,
                    color: 'text-sky-400 bg-sky-400/15',
                    title: 'Jeu mémoire (Support)',
                    desc: 'Résous des paires de cartes. Chaque partie réussie renforce les structures défensives de ton clan.',
                    limit: '1 partie / jour',
                  },
                  {
                    icon: Swords,
                    color: 'text-rose-400 bg-rose-400/15',
                    title: 'Bombardement (Attaque)',
                    desc: 'Fais tomber des bombes sur la grille ennemie pour marquer des points de combat. Les défenses adverses réduisent les dégâts.',
                    limit: '1 attaque / jour',
                  },
                  {
                    icon: TrendingUp,
                    color: 'text-amber-400 bg-amber-400/15',
                    title: 'Guerre navale (Attaque)',
                    desc: 'Tire sur la grille adverse pour toucher des cibles cachées. Chaque touche rapporte des points. Le stock de tirs se reconstitue chaque jour.',
                    limit: 'Tirs limités par période',
                  },
                ].map(({ icon: Icon, color, title, desc, limit }) => (
                  <div key={title} className="rounded-xl border border-border/40 bg-muted/5 px-4 py-3 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className={cn('flex h-6 w-6 items-center justify-center rounded-md text-[11px]', color)}>
                        <Icon className="h-3 w-3" />
                      </span>
                      <p className="text-xs font-semibold">{title}</p>
                      <span className="ml-auto text-[10px] text-muted-foreground/60 border border-border/40 rounded px-1.5">{limit}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                ))}
              </div>
            </GuideSection>

            <GuideSection title="Types d'attaque">
              <div className="rounded-xl border border-border/40 overflow-hidden">
                <Row label="Raid éclair (1 stamina)"   value="18 – 28 pts · dégâts structures : 10" />
                <Row label="Siège lourd (2 stamina)"   value="30 – 44 pts · dégâts structures : 18" />
                <Row label="Sabotage (1 stamina)"      value="16 – 24 pts · dégâts structures : 22" />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Le Sabotage inflige le plus de dégâts sur les structures (Armurerie, Bannière). Le Siège est le plus puissant en points bruts mais consomme 2 stamina.
              </p>
            </GuideSection>

            <GuideSection title="Structures défensives (3 niveaux max chacune)">
              <div className="rounded-xl border border-border/40 overflow-hidden">
                <Row label="🏰 Forteresse"   value="−4 pts/niveau sur les bombardements ennemis" />
                <Row label="⚔️ Armurerie"    value="+3 pts/niveau sur vos propres bombardements" />
                <Row label="🚩 Bannière"      value="+2 pts/niveau sur vos tirs navals" />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Les défenses se renforcent via le jeu mémoire. Chaque membre contribue jusqu'à 2 fois. Elles ont une durabilité qui décroît sous les attaques ennemies.
              </p>
            </GuideSection>

            <GuideSection title="Trophées et récompenses">
              <p className={cn(TYPOGRAPHY.SMALL, 'leading-relaxed')}>
                Chaque clan démarre avec <strong>1 000 trophées</strong>. Victoire → le gagnant en gagne, le perdant en perd (barème basé sur l'écart de score et de trophées).
                En cas d'égalité parfaite et d'écart de trophées faible, aucun échange. Tous les membres reçoivent argent $ et Aura à la fin de la guerre,
                indépendamment du résultat.
              </p>
            </GuideSection>
          </div>
        </AccordionContent>
      </AccordionItem>

      {/* ── 7. Nation ── */}
      <AccordionItem value="clan-nation">
        <AccordionTrigger className="py-5 hover:no-underline">
          <div className="flex items-center gap-3 text-left">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-violet-400/15">
              <Globe className="h-3.5 w-3.5 text-violet-400" />
            </div>
            <span className="text-sm font-semibold">Nation</span>
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <div className="pb-6 space-y-5">
            <p className={cn(TYPOGRAPHY.SMALL, 'leading-relaxed')}>
              Chaque clan possède une <strong>Nation</strong> : une entité géopolitique fictive avec un territoire sur la carte mondiale,
              des stats d'influence, un drapeau personnalisé, des alliances et un marché noir d'armes.
            </p>

            <GuideSection title="Stats de Nation">
              <div className="rounded-xl border border-border/40 overflow-hidden">
                <Row label="Influence"       value="Augmente via les victoires de guerre (+6 par victoire)" />
                <Row label="Intimidation"    value="Augmente sur le clan perdant après une défaite (+4)" />
                <Row label="Contrôle marché" value="Augmente via les victoires de guerre (+5 par victoire)" />
              </div>
            </GuideSection>

            <GuideSection title="Territoires">
              <p className={cn(TYPOGRAPHY.SMALL, 'leading-relaxed')}>
                Plus de 30 villes réparties dans le monde (Paris, Tokyo, New York, Dubaï…). Chaque territoire a un bonus thématique
                (ex. Paris → «&nbsp;Influence commerciale&nbsp;», Tokyo → «&nbsp;Puissance technologique&nbsp;»).
                Un seul clan peut occuper un territoire à la fois. Le chef choisit le territoire depuis l'onglet Tag/Nation.
              </p>
            </GuideSection>

            <GuideSection title="Alliances">
              <p className={cn(TYPOGRAPHY.SMALL, 'leading-relaxed')}>
                Le chef peut envoyer des demandes d'alliance à d'autres clans. Une alliance active empêche les deux clans de se déclarer la guerre.
                Il est possible de <strong>trahir</strong> une alliance (l'autre clan en est notifié, statut passe à «&nbsp;Rompue&nbsp;»).
              </p>
            </GuideSection>

            <GuideSection title="Marché noir (armes)">
              <div className="rounded-xl border border-border/40 overflow-hidden">
                <Row label="Pistolet"   value="500 000 $ · −1 slot adverse · −12 pts de pénalité" />
                <Row label="AK"         value="1 000 000 $ · −2 slots adverses · −24 pts de pénalité" />
                <Row label="Sniper"     value="1 500 000 $ · −3 slots adverses · −36 pts de pénalité" />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Achetées depuis la banque de clan. Les armes infligent des pénalités de points au score adverse et bloquent certains slots pendant la guerre en cours.
                Coût prélevé sur la banque du clan.
              </p>
            </GuideSection>

            <GuideSection title="Boost hebdomadaire">
              <p className={cn(TYPOGRAPHY.SMALL, 'leading-relaxed')}>
                Le chef peut activer un <strong>boost hebdomadaire</strong> depuis la Nation (coût : <strong>150 000 $</strong> depuis la banque de clan).
                Ce boost ajoute des points bonus au score de la prochaine guerre de la semaine.
              </p>
            </GuideSection>
          </div>
        </AccordionContent>
      </AccordionItem>

      {/* ── 8. Événements ── */}
      <AccordionItem value="clan-events">
        <AccordionTrigger className="py-5 hover:no-underline">
          <div className="flex items-center gap-3 text-left">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-indigo-400/15">
              <Star className="h-3.5 w-3.5 text-indigo-400" />
            </div>
            <span className="text-sm font-semibold">Événements de clan</span>
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <div className="pb-6 space-y-5">
            <p className={cn(TYPOGRAPHY.SMALL, 'leading-relaxed')}>
              Des <strong>événements</strong> ponctuels peuvent être activés par les administrateurs sur un ou plusieurs clans.
              Chaque événement a des objectifs précis et un classement interne. Les membres participent en accomplissant des activités
              ou en jouant à des mini-jeux exclusifs.
            </p>
            <GuideSection title="Types d'activités suivies">
              <div className="divide-y divide-border/20 rounded-xl border border-border/40 overflow-hidden">
                {[
                  { label: 'Parties jouées',          desc: "N'importe quel jeu de la plateforme." },
                  { label: 'Victoires',               desc: 'Parties gagnées sur les jeux.' },
                  { label: 'Messages de clan',        desc: 'Messages envoyés dans le chat du clan.' },
                  { label: 'Dépôts en banque',        desc: 'Argent déposé dans la banque de clan.' },
                  { label: 'Actions de guerre',       desc: 'Attaques et actions de support pendant une guerre.' },
                  { label: 'Mini-jeux d\'événement',  desc: 'Parties ou points accumulés dans les mini-jeux de l\'événement (réflexe, tap frenzy…).' },
                ].map(({ label, desc }) => (
                  <div key={label} className="flex items-start gap-3 px-4 py-3 bg-card/30">
                    <div>
                      <p className="text-xs font-semibold">{label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </GuideSection>
          </div>
        </AccordionContent>
      </AccordionItem>

      {/* ── 9. Chat et communication ── */}
      <AccordionItem value="clan-chat">
        <AccordionTrigger className="py-5 hover:no-underline">
          <div className="flex items-center gap-3 text-left">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-cyan-400/15">
              <MessageSquare className="h-3.5 w-3.5 text-cyan-400" />
            </div>
            <span className="text-sm font-semibold">Chat et communication</span>
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <div className="pb-6 space-y-5">
            <GuideSection title="Chat de clan">
              <p className={cn(TYPOGRAPHY.SMALL, 'leading-relaxed')}>
                Le <strong>chat</strong> est un canal privé accessible uniquement aux membres. Les messages s'affichent en temps réel (actualisation toutes les 10 secondes).
                Les 60 derniers messages sont visibles. Un joueur non-membre ne peut pas lire ni envoyer de messages.
              </p>
            </GuideSection>
            <GuideSection title="Messages d'encouragement (pump-up)">
              <p className={cn(TYPOGRAPHY.SMALL, 'leading-relaxed')}>
                Le chef peut créer des <strong>messages d'encouragement</strong> colorés (pump-up messages) affichés en haut du chat.
                Ils servent à motiver les membres avant ou pendant une guerre. Le chef peut en ajouter, modifier ou supprimer à tout moment.
              </p>
            </GuideSection>
          </div>
        </AccordionContent>
      </AccordionItem>

      {/* ── 10. Items et effets ── */}
      <AccordionItem value="clan-items">
        <AccordionTrigger className="py-5 hover:no-underline">
          <div className="flex items-center gap-3 text-left">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-pink-400/15">
              <ShoppingCart className="h-3.5 w-3.5 text-pink-400" />
            </div>
            <span className="text-sm font-semibold">Items et effets de clan</span>
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <div className="pb-6 space-y-5">
            <p className={cn(TYPOGRAPHY.SMALL, 'leading-relaxed')}>
              Certains items achetés à la boutique ont un effet collectif sur l'ensemble du clan.
              Le chef ou les membres autorisés peuvent les activer depuis l'onglet Inventaire du clan.
            </p>
            <div className="rounded-xl border border-border/40 overflow-hidden">
              {[
                { name: 'Boost argent en jeux',    desc: 'Augmente les gains $ en jeux pour tous les membres pendant une durée limitée. Visible dans la barre d\'effets actifs.' },
                { name: 'Photo de clan',            desc: 'Remplace l\'avatar du clan par une image personnalisée (via l\'item CLAN_PROFILE_PICTURE).' },
                { name: 'Bannière de clan',         desc: 'Ajoute une bannière sur la fiche du clan (via l\'item CLAN_BANNER).' },
                { name: 'Tag débloqué',             desc: 'Affiche un tag personnalisé (texte + couleurs) à côté du nom de chaque membre. Configurable depuis l\'onglet Tag.' },
              ].map(({ name, desc }) => (
                <div key={name} className="flex items-start gap-3 px-4 py-3 bg-card/30 border-b border-border/20 last:border-0">
                  <div>
                    <p className="text-xs font-semibold">{name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>

    </Accordion>
  );
}

// ─── Tutoriels placeholder pour les autres sections ───────────────────────────

interface TutorialSection {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
  tag?: string;
}

const placeholderSections: TutorialSection[] = [
  {
    icon: Users,
    title: 'Économie & monnaies',
    description:
      "Comprendre l'Aura et l'argent ($), comment les gagner, les dépenser et les protéger des impôts.",
    tag: 'Économie',
  },
  {
    icon: BookOpen,
    title: 'Marché & marketplace',
    description:
      "Acheter, vendre, négocier sur le marché. Comment fonctionne le Market Room et les enchères.",
    tag: 'Économie',
  },
  {
    icon: GraduationCap,
    title: 'Quêtes & pass',
    description:
      "Comment progresser via les quêtes quotidiennes et le pass de saison. Récompenses et stratégie.",
    tag: 'Progression',
  },
  {
    icon: Scale,
    title: 'Justice et litiges',
    description:
      "Comment déposer une plainte, le rôle des juges, les cabinets d'avocats et la Cour Suprême.",
    tag: 'Avancé',
  },
  {
    icon: ArrowLeftRight,
    title: 'Casino & jeux de hasard',
    description:
      "Crash, Mines, Roulette russe — comprendre les mécaniques, les risques et les limites de mise.",
    tag: 'Jeux',
  },
];

interface TutorialSubsection {
  id: string;
  title: string;
  content: ReactNode;
}

interface TutorialGuide {
  id: string;
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
  subsections?: TutorialSubsection[];
  content?: ReactNode | null;
}

const youGuideSubsections: TutorialSubsection[] = [
  {
    id: 'presentation',
    title: 'Présentation',
    content: (
      <div className="space-y-5">
        <p className={cn(TYPOGRAPHY.SMALL, 'leading-relaxed')}>
          <strong>You</strong> est une simulation économique multijoueur intégrée à AuraTracker.
          Tu y construis un empire d'entreprises, investis dans celles des autres joueurs, formes des alliances,
          crées des relations, et tentes de t'enrichir sans te faire imposer toute ta fortune.
        </p>
        <GuideSection title="Les 8 onglets du jeu">
          <div className="divide-y divide-border/20 rounded-xl border border-border/40 overflow-hidden">
            {[
              { icon: Star, label: 'Vue d\'ensemble', desc: 'Dashboard : statistiques, fil d\'activité, notifications, guide de démarrage.' },
              { icon: Briefcase, label: 'Travail', desc: 'Créer et gérer tes entreprises, consulter les offres d\'emploi reçues, voir tes participations.' },
              { icon: TrendingUp, label: 'Explorer', desc: 'Parcourir tous les businesses des autres joueurs. Investir, emprunter, transférer, acheter des formations.' },
              { icon: Heart, label: 'Social', desc: 'Gérer tes relations avec les autres joueurs (amitié, amour, mariage, liaison).' },
              { icon: Wallet, label: 'Finance', desc: 'Vue financière globale : comptes bancaires, transactions, AuraCoin, historique.' },
              { icon: Landmark, label: 'Banques', desc: 'Résumé de tous tes comptes courants et livrets d\'épargne dans les banques du jeu.' },
              { icon: Map, label: 'Carte', desc: 'Carte de la ville avec les entreprises réparties par quartier (Commerce, Finance, Tech, Formation, Justice).' },
              { icon: Star, label: 'Publicités', desc: 'Créer et gérer des annonces publicitaires pour tes propres entreprises.' },
            ].map(({ icon: Icon, label, desc }) => (
              <div key={label} className="flex items-start gap-3 px-4 py-3 bg-card/30">
                <Icon className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-semibold">{label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </GuideSection>
      </div>
    ),
  },
  {
    id: 'premiers-pas',
    title: 'Premiers pas — créer son business',
    content: (
      <div className="space-y-5">
        <p className={cn(TYPOGRAPHY.SMALL, 'leading-relaxed')}>
          Au départ tu disposes d'<strong>1 slot business</strong>. Pour en débloquer d'autres, monte le skill <strong>Affaires</strong>.
        </p>
        <GuideSection title="Étapes pour créer sa première entreprise">
          <div className="divide-y divide-border/20">
            {[
              { n: '1', t: 'Va dans l\'onglet Travail', d: 'Clique sur "Créer une entreprise".' },
              { n: '2', t: 'Choisis un type de niveau 1', d: 'Limonade, Épicerie ou Restaurant.' },
              { n: '3', t: 'Donne-lui un nom', d: 'Le nom doit être unique sur tout le jeu.' },
              { n: '4', t: 'Commence à collecter', d: 'Les clients NPC visitent ton business toutes les 6 heures.' },
              { n: '5', t: 'Gère la trésorerie', d: 'Déposer ou retirer n\'affecte que toi en tant que propriétaire.' },
            ].map(({ n, t, d }) => (
              <div key={n} className="grid grid-cols-[auto_1fr] items-start gap-x-3 py-3">
                <span className={cn(TYPOGRAPHY.SMALL, 'text-muted-foreground tabular-nums leading-5 pt-0.5')}>{n}.</span>
                <div>
                  <p className="text-sm font-medium">{t}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{d}</p>
                </div>
              </div>
            ))}
          </div>
        </GuideSection>
        <GuideSection title="Slots business et compétence Affaires">
          <p className={cn(TYPOGRAPHY.SMALL, 'leading-relaxed')}>
            Le niveau de compétence <strong>Affaires</strong> détermine ton nombre de slots. Chaque niveau débloque un slot supplémentaire.
          </p>
        </GuideSection>
      </div>
    ),
  },
  {
    id: 'types-entreprises',
    title: "Types d'entreprises",
    content: (
      <div className="space-y-5">
        <p className={cn(TYPOGRAPHY.SMALL, 'leading-relaxed')}>
          Les entreprises sont réparties en <strong>3 niveaux</strong>. Les niveaux supérieurs demandent un capital minimum et une progression adaptée.
        </p>
        <GuideSection title="Niveau 1 — Commerce de base">
          <div className="space-y-2">
            {BUSINESS_TYPES_DATA.filter((b) => b.level === 1).map((b) => (
              <div key={b.key} className="rounded-xl border border-border/40 bg-muted/5 px-4 py-3 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold">{b.key}</p>
                </div>
                <div className="grid grid-cols-3 gap-x-4 text-xs text-muted-foreground">
                  <span>Frais : <strong className="text-foreground">{b.fee.toLocaleString('fr-FR')} $</strong></span>
                  <span>Revenu/mois : <strong className="text-emerald-400">{b.revenue.toLocaleString('fr-FR')} $</strong></span>
                  {b.npc ? <span>Collect NPC : <strong className="text-lime-400">{b.npc} $ / 6 h</strong></span> : null}
                </div>
              </div>
            ))}
          </div>
        </GuideSection>
        <GuideSection title="Niveau 2 — Entreprises intermédiaires">
          <div className="space-y-2">
            {BUSINESS_TYPES_DATA.filter((b) => b.level === 2).map((b) => (
              <div key={b.key} className="rounded-xl border border-border/40 bg-muted/5 px-4 py-3 space-y-1">
                <p className="text-sm font-semibold">{b.key}</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                  <span>Frais : <strong className="text-foreground">{b.fee.toLocaleString('fr-FR')} $</strong></span>
                  <span>Capital min : <strong className="text-amber-400">{b.minCap.toLocaleString('fr-FR')} $</strong></span>
                  {b.revenue > 0 ? <span>Revenu/mois : <strong className="text-emerald-400">{b.revenue.toLocaleString('fr-FR')} $</strong></span> : null}
                </div>
              </div>
            ))}
          </div>
        </GuideSection>
        <GuideSection title="Niveau 3 — Banque">
          <div className="rounded-xl border border-emerald-400/30 bg-emerald-400/5 px-4 py-3 space-y-2">
            <p className="text-sm font-semibold">Banque</p>
            <p className="text-xs text-muted-foreground">Les bénéfices viennent des intérêts sur les prêts accordés et des dépôts des clients.</p>
          </div>
        </GuideSection>
      </div>
    ),
  },
  {
    id: 'recettes-revenus',
    title: 'Recettes et revenus',
    content: (
      <div className="space-y-5">
        <GuideSection title="Revenu mensuel → quotidien">
          <p className={cn(TYPOGRAPHY.SMALL, 'leading-relaxed')}>
            Le revenu mensuel d'une entreprise est divisé par 30 pour calculer le revenu journalier, versé automatiquement à minuit.
          </p>
        </GuideSection>
        <GuideSection title="Collecte NPC (clients virtuels)">
          <div className="rounded-xl border border-border/40 overflow-hidden mt-2">
            <Row label="Limonade" value="150 $ / 6 h" />
            <Row label="Épicerie" value="300 $ / 6 h" />
            <Row label="Restaurant" value="350 $ / 6 h" />
            <Row label="YouTube" value="220 $ / 6 h" />
          </div>
        </GuideSection>
        <GuideSection title="Trésorerie">
          <p className={cn(TYPOGRAPHY.SMALL, 'leading-relaxed')}>
            Tous les revenus arrivent dans la trésorerie du business, puis tu peux les retirer vers ton argent personnel.
          </p>
        </GuideSection>
      </div>
    ),
  },
  {
    id: 'skills',
    title: 'Compétences (Skills)',
    content: (
      <div className="space-y-5">
        <p className={cn(TYPOGRAPHY.SMALL, 'leading-relaxed')}>
          Il existe <strong>6 compétences</strong>, chacune allant de niveau 1 à 10.
        </p>
        <div className="space-y-2">
          {SKILLS_DATA.map((skill) => (
            <div key={skill.label} className="rounded-xl border border-border/40 bg-muted/5 px-4 py-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold', skill.color)}>
                  {skill.label}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                <strong className="text-foreground/80">XP auto :</strong> {skill.how}
              </p>
              <p className="text-xs text-muted-foreground">
                <strong className="text-foreground/80">Débloque :</strong> {skill.unlocks}
              </p>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: 'investir-explorer',
    title: 'Investir et Explorer',
    content: (
      <div className="space-y-5">
        <p className={cn(TYPOGRAPHY.SMALL, 'leading-relaxed')}>
          L'onglet Explorer liste les businesses des autres joueurs. Tu peux investir, emprunter, transférer de l'argent, acheter des formations ou postuler.
        </p>
        <GuideSection title="Investir dans un business">
          <div className="rounded-xl border border-border/40 overflow-hidden">
            <Row label="Risque faible" value="2 % – 5 % de rendement" />
            <Row label="Risque moyen" value="5 % – 15 % de rendement" />
            <Row label="Risque élevé" value="10 % – 40 % de rendement" />
          </div>
        </GuideSection>
        <GuideSection title="Postuler comme employé">
          <p className={cn(TYPOGRAPHY.SMALL, 'leading-relaxed')}>
            Si le recrutement est ouvert, tu peux postuler depuis la fiche d'un business et recevoir un salaire journalier si tu es accepté.
          </p>
        </GuideSection>
      </div>
    ),
  },
  {
    id: 'banques-epargne',
    title: 'Banques et épargne',
    content: (
      <div className="space-y-5">
        <p className={cn(TYPOGRAPHY.SMALL, 'leading-relaxed')}>
          Les banques sont des businesses de niveau 3. Elles proposent des comptes courants et des livrets d'épargne.
        </p>
        <GuideSection title="Types de comptes">
          <div className="rounded-xl border border-border/40 overflow-hidden">
            <div className="px-4 py-3 space-y-1 border-b border-border/30">
              <p className="text-xs font-semibold text-sky-400">Compte courant</p>
              <p className="text-xs text-muted-foreground">Dépôt et retrait libres.</p>
            </div>
            <div className="px-4 py-3 space-y-1">
              <p className="text-xs font-semibold text-amber-400">Livret épargne</p>
              <p className="text-xs text-muted-foreground">Fonctionne comme un compte courant avec un taux différent.</p>
            </div>
          </div>
        </GuideSection>
      </div>
    ),
  },
  {
    id: 'relations-sociales',
    title: 'Relations sociales',
    content: (
      <div className="space-y-5">
        <p className={cn(TYPOGRAPHY.SMALL, 'leading-relaxed')}>
          L'onglet Social te permet de tisser des liens avec d'autres joueurs.
        </p>
        <GuideSection title="Statuts de relation">
          <div className="rounded-xl border border-border/40 overflow-hidden">
            <Row label="Ami(e)" value="Relation de base" />
            <Row label="En couple" value="Lien amoureux" />
            <Row label="Marié(e)" value="Compte commun partagé" />
            <Row label="Liaison" value="Relation parallèle risquée" />
          </div>
        </GuideSection>
      </div>
    ),
  },
];

const tutorialGuides: TutorialGuide[] = [
  {
    id: 'guide-you',
    icon: Building2,
    title: 'Guide du jeu You',
    description: 'Entreprises, compétences, investissements, relations — tout le système économique.',
    subsections: youGuideSubsections,
  },
  {
    id: 'guide-newcomer',
    icon: Star,
    title: 'Guide du nouvel arrivant',
    description: 'Monnaies, jeux, systèmes quotidiens, social, boutique et impôts — tout pour bien démarrer.',
    content: <NewcomerGuideContent />,
  },
  {
    id: 'guide-clans',
    icon: Flag,
    title: 'Clans',
    description: 'Créer, rejoindre, guerres de clans, Nation, banque, événements et items.',
    content: <ClanGuideContent />,
  },
  ...placeholderSections.map((section) => ({
    id: `coming-soon-${section.title}`,
    icon: section.icon,
    title: section.title,
    description: section.description,
    content: null,
  })),
];

function GuideDetail({ guide, subsectionId }: { guide: TutorialGuide; subsectionId?: string }) {
  const subsection = guide.subsections?.find((item) => item.id === subsectionId) ?? guide.subsections?.[0];

  return (
    <Card className="border-border/60 bg-card shadow-sm">
      <CardHeader className="border-b border-border/30 pb-4">
        <CardTitle className={TYPOGRAPHY.H2}>{subsection?.title ?? guide.title}</CardTitle>
      </CardHeader>
      <CardContent className="px-6 py-6">
        {subsection ? (
          subsection.content
        ) : guide.content ? (
          guide.content
        ) : (
          <div className="rounded-xl border border-dashed border-border/40 bg-muted/20 px-4 py-6 text-sm text-muted-foreground">
            Ce guide arrive bientôt. Le contenu sera ajouté dans une prochaine mise à jour.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TutorialsTab() {
  const [selectedGuideId, setSelectedGuideId] = useState(tutorialGuides[0].id);
  const [selectedSubsectionId, setSelectedSubsectionId] = useState(youGuideSubsections[0].id);

  const selectedGuide = tutorialGuides.find((guide) => guide.id === selectedGuideId) ?? tutorialGuides[0];

  const selectGuide = (guideId: string) => {
    const guide = tutorialGuides.find((item) => item.id === guideId);
    setSelectedGuideId(guideId);
    if (guide?.subsections?.length) {
      setSelectedSubsectionId(guide.subsections[0].id);
    }
  };

  const selectSubsection = (guideId: string, subsectionId: string) => {
    setSelectedGuideId(guideId);
    setSelectedSubsectionId(subsectionId);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
      <Card className="border-border/60 bg-card/80 shadow-sm lg:sticky lg:top-6 lg:self-start">
        <CardContent className="p-2">
          <Accordion type="single" collapsible value={selectedGuide.id} onValueChange={selectGuide} className="space-y-2">
            {tutorialGuides.map((guide) => {
              const Icon = guide.icon;

              return (
                <AccordionItem
                  key={guide.id}
                  value={guide.id}
                  className={cn(
                    'overflow-hidden rounded-xl border bg-background/70',
                    selectedGuide.id === guide.id ? 'border-primary/30' : 'border-border/50',
                  )}
                >
                  <AccordionTrigger className={cn('px-3 py-2 text-left hover:no-underline', selectedGuide.id === guide.id && 'bg-primary/5')}>
                    <div className="flex min-w-0 items-center gap-3">
                      <span className={cn(
                        'flex h-7 w-7 shrink-0 items-center justify-center rounded-md border',
                        selectedGuide.id === guide.id ? 'border-primary/20 bg-primary/10' : 'border-border/40 bg-muted/30',
                      )}>
                        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium leading-5">{guide.title}</p>
                      </div>
                    </div>
                  </AccordionTrigger>

                  {guide.subsections?.length ? (
                    <AccordionContent className="px-2 pb-2 pt-0">
                      <div className="space-y-1">
                        {guide.subsections.map((subsection) => (
                          <button
                            key={subsection.id}
                            type="button"
                            onClick={() => selectSubsection(guide.id, subsection.id)}
                            className={cn(
                              'flex w-full items-center rounded-lg border px-3 py-2 text-left text-xs transition-colors',
                              selectedGuide.id === guide.id && selectedSubsectionId === subsection.id
                                ? 'border-primary/30 bg-primary/5 text-foreground'
                                : 'border-transparent bg-transparent text-muted-foreground hover:border-border hover:bg-muted/40',
                            )}
                          >
                            <span className="truncate font-medium">{subsection.title}</span>
                          </button>
                        ))}
                      </div>
                    </AccordionContent>
                  ) : null}
                </AccordionItem>
              );
            })}
          </Accordion>
        </CardContent>
      </Card>

      <GuideDetail guide={selectedGuide} subsectionId={selectedSubsectionId} />
    </div>
  );
}

void TaxBracketsSection;
void YouGameGuideContent;

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function Information() {
  return (
    <PageShell>
      <TutorialsTab />
    </PageShell>
  );
}
