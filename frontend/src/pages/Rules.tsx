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
    <div className="max-w-4xl mx-auto py-12 px-4 space-y-16">
      {/* Header */}
      <header className="space-y-2">
        <p className="text-sm text-muted-foreground tracking-wide uppercase">
          Règles et conditions
        </p>
        <h1 className="text-5xl md:text-7xl font-light tracking-tight">
          Règlement
        </h1>
      </header>

      {/* Divider */}
      <div className="h-px bg-border" />

      {/* Rules Sections */}
      {sections.map((section, index) => (
        <section key={index} className="space-y-6">
          <h2 className="text-sm text-muted-foreground tracking-wide uppercase">
            {section.title}
          </h2>
          
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
        <h2 className="text-sm text-muted-foreground tracking-wide uppercase">
          Sanctions
        </h2>
        
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
      <section className="space-y-2">
        <p className="text-sm text-muted-foreground">
          Dernière mise à jour : Janvier 2026
        </p>
        <p className="text-sm text-muted-foreground">
          Pour toute question concernant ce règlement, contactez l'équipe d'administration.
        </p>
      </section>
    </div>
  );
}
