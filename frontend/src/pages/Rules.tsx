import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { bugReportApi } from '../services/api';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RuleSection {
  title: string;
  rules: string[];
}

interface HighlightCard {
  title: string;
  description: string;
}

interface FeatureGroup {
  title: string;
  items: string[];
}

const sections: RuleSection[] = [
  {
    title: "Principes généraux",
    rules: [
      "L'aura est une monnaie virtuelle utilisée uniquement dans le cadre de cette application.",
      "Tout comportement visant à exploiter des failles ou bugs du système est interdit.",
      "Les administrateurs se réservent le droit de modifier ces règles à tout moment.",
      "L'utilisation de l'application implique l'acceptation de ce règlement.",
    ],
  },
  {
    title: "Comportement entre utilisateurs",
    rules: [
      "Le respect mutuel est obligatoire dans toutes les interactions.",
      "Tout harcèlement, insulte ou discrimination est strictement interdit.",
      "L'usurpation d'identité est prohibée.",
      "Les messages dans le chat doivent rester appropriés et respectueux.",
    ],
  },
  {
    title: "Système de dons",
    rules: [
      "Chaque utilisateur dispose d'une limite quotidienne de dons d'aura.",
      "Les dons sont définitifs et ne peuvent pas être annulés.",
      "Il est interdit de demander des dons en échange de faveurs réelles.",
      "Le farming d'aura via des comptes multiples est interdit.",
    ],
  },
  {
    title: "Jeux et compétitions",
    rules: [
      "L'utilisation de scripts, bots ou logiciels tiers est interdite.",
      "Les scores obtenus de manière frauduleuse seront supprimés.",
      "Les résultats des jeux sont finaux et non contestables.",
      "Le fair-play est attendu de tous les participants.",
    ],
  },
  {
    title: "Marché et économie",
    rules: [
      "Les transactions sur le marché sont définitives.",
      "Il est interdit de manipuler les prix artificiellement.",
      "Les objets achetés ne peuvent pas être échangés contre de l'argent réel.",
      "Tout abus du système économique entraînera des sanctions.",
    ],
  },
  {
    title: "Confidentialité et sécurité",
    rules: [
      "Ne partagez jamais vos identifiants de connexion.",
      "Chaque utilisateur est responsable de la sécurité de son compte.",
      "Les données personnelles sont traitées conformément à la législation en vigueur.",
      "Signaler tout comportement suspect aux administrateurs.",
    ],
  },
];

const sanctions = [
  { offense: "Première infraction mineure", sanction: "Avertissement" },
  { offense: "Récidive ou infraction modérée", sanction: "Suspension temporaire (1-7 jours)" },
  { offense: "Infraction grave", sanction: "Suspension longue (30 jours)" },
  { offense: "Infraction très grave ou récidive multiple", sanction: "Bannissement permanent" },
];

const highlights: HighlightCard[] = [
  {
    title: 'Lancement officiel',
    description: "La v1.0.0 marque l'ouverture publique d'Aura Tracker et pose les bases de la suite.",
  },
  {
    title: 'Ecosysteme Aura',
    description: "Une monnaie centrale, des gains en jeu et un suivi complet pour progresser.",
  },
  {
    title: 'Communautaire',
    description: "Classements, profil dynamique, party et interactions directes avec les autres joueurs.",
  },
];

const featureGroups: FeatureGroup[] = [
  {
    title: 'Jeux disponibles',
    items: [
      'Aura Coin pour gagner et depenser vos points',
      'Clash pour les duels rapides',
      'Doodle Jump pour les sessions chill',
      'Casino pour tenter votre chance',
      'Bomb Party pour les soirees collectives',
    ],
  },
  {
    title: 'Progression & social',
    items: [
      'Profils personnalises avec bio et couleurs',
      'Classements en temps reel',
      'Party system pour jouer en groupe',
      "Recherche rapide d'utilisateurs",
    ],
  },
  {
    title: 'Economie & contenu',
    items: [
      'Marketplace pour acheter et gerer vos objets',
      'Inventaire detaille et suivi de vos possessions',
      'Pass de progression pour des recompenses',
    ],
  },
  {
    title: 'Qualite & securite',
    items: [
      'Signalement de bugs integre',
      'Reglement accessible pour clarifier les regles',
      'Administration dediee pour la moderation',
    ],
  },
];

const v1Notes = [
  {
    title: 'Focus v1.0.0',
    description:
      "Cette version met l'accent sur la stabilite, l'experience utilisateur et la performance.",
  },
  {
    title: 'Equipe Aura Tracker',
    description:
      "Un lancement pense pour la communaute, avec une base solide pour les futures saisons.",
  },
];

export default function Rules() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim() || !description.trim()) {
      setError('Veuillez remplir tous les champs');
      return;
    }
    
    if (title.length > 100) {
      setError('Le titre doit faire moins de 100 caractères');
      return;
    }
    
    if (description.length > 2000) {
      setError('La description doit faire moins de 2000 caractères');
      return;
    }
    
    setSubmitting(true);
    setError(null);
    
    try {
      await bugReportApi.create({ title: title.trim(), description: description.trim() });
      setSubmitted(true);
      setTitle('');
      setDescription('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Une erreur est survenue');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-12 px-4 space-y-16">
      {/* Header */}
      <header className="space-y-2">
        <p className="text-sm text-muted-foreground tracking-wide uppercase">
          Infos & communauté
        </p>
        <h1 className="text-5xl md:text-7xl font-light tracking-tight">
          Règles, changelog, bugs
        </h1>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Tout est rassemblé ici : règlement, notes de version et signalement de bugs.
        </p>
      </header>

      {/* Divider */}
      <div className="h-px bg-border" />

      {/* Bug report */}
      <section className="space-y-6">
        <header className="space-y-2">
          <p className="text-sm text-muted-foreground tracking-wide uppercase">
            Signalement
          </p>
          <h2 className="text-3xl md:text-4xl font-light tracking-tight">
            Reporter un bug
          </h2>
        </header>

        {submitted ? (
          <div className="space-y-6">
            <div className="space-y-2">
              <h3 className="text-base font-medium">Rapport envoyé</h3>
              <p className="text-sm text-muted-foreground">
                Votre rapport de bug a été envoyé aux administrateurs.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setSubmitted(false)}
                className="px-4 py-2 text-sm border border-border/30 text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
              >
                Signaler un autre bug
              </button>
              <button
                onClick={() => navigate('/')}
                className="px-4 py-2 text-sm border border-foreground text-foreground hover:bg-foreground hover:text-background transition-colors"
              >
                Retour au tableau de bord
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="px-4 py-3 border border-border/30 text-sm text-muted-foreground">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">
                Titre du bug
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Le bouton ne fonctionne pas sur la page..."
                className="w-full h-12 bg-transparent border border-border/50 px-4 text-sm focus:outline-none focus:border-foreground/30"
                maxLength={100}
                disabled={submitting}
              />
              <p className="text-xs text-muted-foreground text-right">
                {title.length}/100
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">
                Description détaillée
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Décrivez le bug en détail : que faisiez-vous, qu'est-ce qui s'est passé, qu'est-ce qui aurait dû se passer..."
                className="w-full min-h-[200px] bg-transparent border border-border/50 px-4 py-3 text-sm resize-none focus:outline-none focus:border-foreground/30"
                maxLength={2000}
                disabled={submitting}
              />
              <p className="text-xs text-muted-foreground text-right">
                {description.length}/2000
              </p>
            </div>

            <div className="h-px bg-border" />

            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="px-4 py-2 text-sm border border-border/30 text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={submitting}
              >
                Annuler
              </button>
              
              <button
                type="submit"
                disabled={submitting || !title.trim() || !description.trim()}
                className={cn(
                  "px-4 py-2 text-sm border transition-colors min-w-[140px]",
                  !submitting && title.trim() && description.trim()
                    ? "border-foreground text-foreground hover:bg-foreground hover:text-background"
                    : "border-border/30 text-muted-foreground/50 cursor-not-allowed"
                )}
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Envoi...
                  </span>
                ) : (
                  "Envoyer"
                )}
              </button>
            </div>
          </form>
        )}
      </section>

      {/* Divider */}
      <div className="h-px bg-border" />

      {/* Changelog */}
      <section className="space-y-6">
        <header className="space-y-2">
          <p className="text-sm text-muted-foreground tracking-wide uppercase">
            Notes de version
          </p>
          <h2 className="text-3xl md:text-4xl font-light tracking-tight">
            Changelog 1.0.0
          </h2>
        </header>
        <div className="space-y-0">
          {highlights.map((card, index) => (
            <div
              key={index}
              className="py-4 border-b border-border/30 last:border-0 space-y-1"
            >
              <h3 className="text-base font-medium">{card.title}</h3>
              <p className="text-sm text-muted-foreground">{card.description}</p>
            </div>
          ))}
        </div>
        <div className="space-y-8">
          {featureGroups.map((group) => (
            <div key={group.title} className="space-y-4">
              <h3 className="text-base font-medium">{group.title}</h3>
              <ul className="space-y-0">
                {group.items.map((item, itemIndex) => (
                  <li
                    key={itemIndex}
                    className="py-2 border-b border-border/30 last:border-0 text-sm text-muted-foreground"
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="space-y-0">
          {v1Notes.map((note) => (
            <div
              key={note.title}
              className="py-4 border-b border-border/30 last:border-0 space-y-1"
            >
              <h3 className="text-base font-medium">{note.title}</h3>
              <p className="text-sm text-muted-foreground">{note.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Divider */}
      <div className="h-px bg-border" />

      {/* Rules Sections */}
      <section className="space-y-6">
        <header className="space-y-2">
          <p className="text-sm text-muted-foreground tracking-wide uppercase">
            Règlement
          </p>
          <h2 className="text-3xl md:text-4xl font-light tracking-tight">
            Règles de la communauté
          </h2>
        </header>
      </section>

      {sections.map((section, index) => (
        <section key={index} className="space-y-6">
          <h3 className="text-sm text-muted-foreground tracking-wide uppercase">
            {section.title}
          </h3>
          
          <div className="space-y-0">
            {section.rules.map((rule, ruleIndex) => (
              <div
                key={ruleIndex}
                className="flex items-start gap-6 py-4 border-b border-border/30 last:border-0"
              >
                <span className="text-muted-foreground text-sm w-6 tabular-nums shrink-0">
                  {ruleIndex + 1}
                </span>
                <p className="text-sm text-muted-foreground">{rule}</p>
              </div>
            ))}
          </div>
          
          {index < sections.length - 1 && (
            <div className="h-px bg-border" />
          )}
        </section>
      ))}

      {/* Divider */}
      <div className="h-px bg-border" />

      {/* Sanctions */}
      <section className="space-y-6">
        <header className="space-y-2">
          <p className="text-sm text-muted-foreground tracking-wide uppercase">
            Modération
          </p>
          <h2 className="text-3xl md:text-4xl font-light tracking-tight">
            Sanctions
          </h2>
        </header>
        
        <p className="text-sm text-muted-foreground">
          Le non-respect du règlement entraîne des sanctions proportionnelles à la gravité de l'infraction.
        </p>
        
        <div className="space-y-0">
          {sanctions.map((item, index) => (
            <div
              key={index}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-4 border-b border-border/30 last:border-0"
            >
              <span className="text-sm text-muted-foreground">{item.offense}</span>
              <span className="text-sm text-muted-foreground sm:text-right">
                {item.sanction}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Divider */}
      <div className="h-px bg-border" />

      {/* Footer note */}
      <section className="space-y-6">
        <header className="space-y-2">
          <p className="text-sm text-muted-foreground tracking-wide uppercase">
            Informations
          </p>
          <h2 className="text-3xl md:text-4xl font-light tracking-tight">
            Contact & mise à jour
          </h2>
        </header>
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Dernière mise à jour : Janvier 2026
          </p>
          <p className="text-sm text-muted-foreground">
            Pour toute question concernant ce règlement, contactez l'équipe d'administration.
          </p>
        </div>
      </section>
    </div>
  );
}
