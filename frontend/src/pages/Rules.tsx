import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  return (
    <PageShell>
      <Card>
        <CardHeader>
          <CardDescription>Règlement</CardDescription>
          <CardTitle className={TYPOGRAPHY.H2}>Principes</CardTitle>
        </CardHeader>
        <CardContent className={SPACING.SECTION_SPACING}>
          {sections.map((section, index) => (
            <section
              key={index}
              className={cn(
                "space-y-3",
                index > 0 && "border-t border-border/30 pt-6"
              )}
            >
              <h3 className={TYPOGRAPHY.MUTED}>{section.title}</h3>

              <div className="divide-y divide-border/30">
                {section.rules.map((rule, ruleIndex) => (
                  <div
                    key={ruleIndex}
                    className="grid grid-cols-[auto_1fr] items-start gap-x-1 py-4"
                  >
                    <span
                      className={cn(
                        TYPOGRAPHY.SMALL,
                        "text-muted-foreground tabular-nums leading-5"
                      )}
                    >
                      {ruleIndex + 1}.
                    </span>
                    <p className={cn(TYPOGRAPHY.SMALL, "leading-5")}>{rule}</p>
                  </div>
                ))}
              </div>
            </section>
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
