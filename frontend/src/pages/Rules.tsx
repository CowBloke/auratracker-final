import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { bugReportApi } from '../services/api';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { TYPOGRAPHY, SPACING } from '@/lib/design-system';
import { cn } from '@/lib/utils';
import { PageShell } from '@/components/layout/page-shell';

interface RuleSection {
  title: string;
  rules: string[];
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
    <PageShell>
      <Card>
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
      <Card>
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
      <Card>
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
      <Card>
        <CardHeader>
          <CardDescription>Informations</CardDescription>
          <CardTitle className={TYPOGRAPHY.H2}>Contact</CardTitle>
        </CardHeader>
        <CardContent className={SPACING.CARD_SPACING}>
          <p className={TYPOGRAPHY.SMALL}>
            Pour toute question concernant ce règlement, contactez l'équipe d'administration.
          </p>
        </CardContent>
      </Card>
    </PageShell>
  );
}
