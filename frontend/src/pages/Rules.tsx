import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { bugReportApi } from '../services/api';
import { Loader2 } from 'lucide-react';
import PageLayout from '@/components/layout/PageLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { TYPOGRAPHY, SPACING } from '@/lib/design-system';
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
    <PageLayout variant="compact">
      {/* Header */}
      <p className={cn(TYPOGRAPHY.SMALL, "max-w-2xl")}>
        Tout est rassemblé ici : règlement, notes de version et signalement de bugs.
      </p>

      <Separator />

      {/* Bug report */}
      <Card className="border-border/40">
        <CardHeader>
          <CardDescription>Signalement</CardDescription>
          <CardTitle className={TYPOGRAPHY.H2}>Reporter un bug</CardTitle>
        </CardHeader>
        <CardContent className={SPACING.SECTION_SPACING}>

          {submitted ? (
            <div className={SPACING.SECTION_SPACING}>
              <div className={SPACING.CARD_SPACING}>
                <h3 className={TYPOGRAPHY.BODY}>Rapport envoyé</h3>
                <p className={TYPOGRAPHY.SMALL}>
                  Votre rapport de bug a été envoyé aux administrateurs.
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setSubmitted(false)}
                >
                  Signaler un autre bug
                </Button>
                <Button
                  onClick={() => navigate('/')}
                >
                  Retour au tableau de bord
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className={SPACING.SECTION_SPACING}>
              {error && (
                <div className={cn("px-4 py-3 border border-border/30", TYPOGRAPHY.SMALL)}>
                  {error}
                </div>
              )}

              <div className={SPACING.CARD_SPACING}>
                <label className={TYPOGRAPHY.SMALL}>
                  Titre du bug
                </label>
                <Input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: Le bouton ne fonctionne pas sur la page..."
                  maxLength={100}
                  disabled={submitting}
                />
                <p className={cn(TYPOGRAPHY.XS, "text-right")}>
                  {title.length}/100
                </p>
              </div>

              <div className={SPACING.CARD_SPACING}>
                <label className={TYPOGRAPHY.SMALL}>
                  Description détaillée
                </label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Décrivez le bug en détail : que faisiez-vous, qu'est-ce qui s'est passé, qu'est-ce qui aurait dû se passer..."
                  className="min-h-[200px]"
                  maxLength={2000}
                  disabled={submitting}
                />
                <p className={cn(TYPOGRAPHY.XS, "text-right")}>
                  {description.length}/2000
                </p>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate(-1)}
                  disabled={submitting}
                >
                  Annuler
                </Button>
                
                <Button
                  type="submit"
                  disabled={submitting || !title.trim() || !description.trim()}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Envoi...
                    </>
                  ) : (
                    "Envoyer"
                  )}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      <Separator />

      {/* Changelog */}
      <Card className="border-border/40">
        <CardHeader>
          <CardDescription>Notes de version</CardDescription>
          <CardTitle className={TYPOGRAPHY.H2}>Changelog 1.0.0</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="divide-y divide-border/30">
            {highlights.map((card, index) => (
              <div
                key={index}
                className="py-4 space-y-1"
              >
                <h3 className={TYPOGRAPHY.BODY}>{card.title}</h3>
                <p className={TYPOGRAPHY.SMALL}>{card.description}</p>
              </div>
            ))}
          </div>
          <div className={SPACING.SECTION_SPACING}>
            {featureGroups.map((group) => (
              <div key={group.title} className={SPACING.CARD_SPACING}>
                <h3 className={TYPOGRAPHY.BODY}>{group.title}</h3>
                <ul className="divide-y divide-border/30">
                  {group.items.map((item, itemIndex) => (
                    <li
                      key={itemIndex}
                      className={cn("py-2", TYPOGRAPHY.SMALL)}
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="divide-y divide-border/30">
            {v1Notes.map((note) => (
              <div
                key={note.title}
                className="py-4 space-y-1"
              >
                <h3 className={TYPOGRAPHY.BODY}>{note.title}</h3>
                <p className={TYPOGRAPHY.SMALL}>{note.description}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Rules Sections */}
      <Card className="border-border/40">
        <CardHeader>
          <CardDescription>Règlement</CardDescription>
          <CardTitle className={TYPOGRAPHY.H2}>Règles de la communauté</CardTitle>
        </CardHeader>
        <CardContent>
          {sections.map((section, index) => (
            <div key={index} className={index > 0 ? "mt-6" : ""}>
              <h3 className={TYPOGRAPHY.MUTED}>
                {section.title}
              </h3>
              
              <div className="divide-y divide-border/30 mt-4">
                {section.rules.map((rule, ruleIndex) => (
                  <div
                    key={ruleIndex}
                    className="flex items-start gap-6 py-4"
                  >
                    <span className={cn(TYPOGRAPHY.SMALL, "text-muted-foreground w-6 tabular-nums shrink-0")}>
                      {ruleIndex + 1}
                    </span>
                    <p className={TYPOGRAPHY.SMALL}>{rule}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Separator />

      {/* Sanctions */}
      <Card className="border-border/40">
        <CardHeader>
          <CardDescription>Modération</CardDescription>
          <CardTitle className={TYPOGRAPHY.H2}>Sanctions</CardTitle>
        </CardHeader>
        <CardContent className={SPACING.CARD_SPACING}>
          <p className={TYPOGRAPHY.SMALL}>
            Le non-respect du règlement entraîne des sanctions proportionnelles à la gravité de l'infraction.
          </p>
          
          <div className="divide-y divide-border/30">
            {sanctions.map((item, index) => (
              <div
                key={index}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-4"
              >
                <span className={TYPOGRAPHY.SMALL}>{item.offense}</span>
                <span className={cn(TYPOGRAPHY.SMALL, "sm:text-right")}>
                  {item.sanction}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Footer note */}
      <Card className="border-border/40">
        <CardHeader>
          <CardDescription>Informations</CardDescription>
          <CardTitle className={TYPOGRAPHY.H2}>Contact & mise à jour</CardTitle>
        </CardHeader>
        <CardContent className={SPACING.CARD_SPACING}>
          <p className={TYPOGRAPHY.SMALL}>
            Dernière mise à jour : Janvier 2026
          </p>
          <p className={TYPOGRAPHY.SMALL}>
            Pour toute question concernant ce règlement, contactez l'équipe d'administration.
          </p>
        </CardContent>
      </Card>
    </PageLayout>
  );
}
