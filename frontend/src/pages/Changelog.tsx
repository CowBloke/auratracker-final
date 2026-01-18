interface HighlightCard {
  title: string;
  description: string;
}

interface FeatureGroup {
  title: string;
  items: string[];
}

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

export default function Changelog() {
  return (
    <div className="max-w-4xl mx-auto py-12 px-4 space-y-16">
      {/* Header */}
      <header className="space-y-2">
        <div>
          <p className="text-sm text-muted-foreground tracking-wide uppercase">
            Changelog
          </p>
          <h1 className="text-5xl md:text-7xl font-light tracking-tight">
            Version 1.0.0
          </h1>
        </div>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Premiere version publique d'Aura Tracker, avec un univers de jeux,
          une economie complete et des outils sociaux pour rassembler la commu.
        </p>
      </header>

      {/* Divider */}
      <div className="h-px bg-border" />

      {/* Highlights */}
      <section className="space-y-6">
        <h2 className="text-sm text-muted-foreground tracking-wide uppercase">
          Points cles
        </h2>
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
      </section>

      {/* Divider */}
      <div className="h-px bg-border" />

      {/* Feature Groups */}
      <section className="space-y-6">
        <h2 className="text-sm text-muted-foreground tracking-wide uppercase">
          Nouveautes majeures
        </h2>
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
      </section>

      {/* Divider */}
      <div className="h-px bg-border" />

      {/* Notes */}
      <section className="space-y-6">
        <h2 className="text-sm text-muted-foreground tracking-wide uppercase">
          Notes de version
        </h2>
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

      {/* Final Section */}
      <section className="space-y-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground tracking-wide uppercase">
              Momentum
            </p>
            <h3 className="text-base font-medium">Le debut de la saison Aura</h3>
            <p className="text-sm text-muted-foreground">
              Les classements, les gains et les interactions sont desormais
              centralises pour une experience continue et competitive.
            </p>
          </div>
        </div>
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground tracking-wide uppercase">
              Qualite
            </p>
            <p className="text-sm text-muted-foreground">
              V1.0.0 introduit un cadre stable : moderation, signalement et
              transparence sur les regles pour garder une communaute saine.
            </p>
            <div className="flex flex-wrap gap-2 pt-2">
              <span className="text-xs text-muted-foreground border border-border/30 px-3 py-1">
                Economie harmonisee
              </span>
              <span className="text-xs text-muted-foreground border border-border/30 px-3 py-1">
                Social renforce
              </span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
