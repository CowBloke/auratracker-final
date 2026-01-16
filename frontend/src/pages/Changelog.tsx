import {
  Sparkles,
  Rocket,
  Users,
  Gamepad2,
  Coins,
  Trophy,
  ShieldCheck,
  MessageCircle,
} from 'lucide-react';

interface HighlightCard {
  icon: React.ReactNode;
  title: string;
  description: string;
}

interface FeatureGroup {
  title: string;
  items: string[];
}

const highlights: HighlightCard[] = [
  {
    icon: <Rocket className="h-5 w-5" />,
    title: 'Lancement officiel',
    description: "La v1.0.0 marque l'ouverture publique d'Aura Tracker et pose les bases de la suite.",
  },
  {
    icon: <Sparkles className="h-5 w-5" />,
    title: 'Ecosysteme Aura',
    description: "Une monnaie centrale, des gains en jeu et un suivi complet pour progresser.",
  },
  {
    icon: <Users className="h-5 w-5" />,
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
    <div className="max-w-5xl mx-auto py-12 px-4 space-y-16">
      <header className="space-y-4">
        <p className="text-sm text-muted-foreground tracking-wide uppercase">
          Changelog
        </p>
        <div className="space-y-3">
          <h1 className="text-5xl md:text-6xl font-light tracking-tight">
            Version 1.0.0
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl">
            Premiere version publique d'Aura Tracker, avec un univers de jeux,
            une economie complete et des outils sociaux pour rassembler la commu.
          </p>
          <div className="inline-flex items-center gap-2 rounded-full border border-border/60 px-4 py-2 text-sm text-muted-foreground">
            <Sparkles className="h-4 w-4 text-aura-light" />
            <span>Release : v1.0.0</span>
          </div>
        </div>
      </header>

      <section className="grid gap-6 md:grid-cols-3">
        {highlights.map((card, index) => (
          <div
            key={index}
            className="rounded-2xl border border-border/60 bg-card/60 p-6 shadow-sm space-y-3"
          >
            <div className="h-10 w-10 rounded-full bg-aura/10 text-aura-light flex items-center justify-center">
              {card.icon}
            </div>
            <h2 className="text-lg font-semibold">{card.title}</h2>
            <p className="text-sm text-muted-foreground">{card.description}</p>
          </div>
        ))}
      </section>

      <section className="space-y-8">
        <div className="flex items-center gap-3">
          <Gamepad2 className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-sm text-muted-foreground tracking-wide uppercase">
            Nouveautes majeures
          </h2>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          {featureGroups.map((group) => (
            <div
              key={group.title}
              className="rounded-2xl border border-border/40 bg-card/40 p-6 space-y-4"
            >
              <h3 className="font-semibold text-lg">{group.title}</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {group.items.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-aura-light" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        {v1Notes.map((note) => (
          <div
            key={note.title}
            className="rounded-2xl border border-border/60 bg-muted/30 p-6 space-y-3"
          >
            <h3 className="text-base font-semibold">{note.title}</h3>
            <p className="text-sm text-muted-foreground">{note.description}</p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-border/60 bg-card/60 p-8">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground uppercase tracking-wide">
              <Trophy className="h-4 w-4" />
              Momentum
            </div>
            <h3 className="text-2xl font-semibold">Le debut de la saison Aura</h3>
            <p className="text-sm text-muted-foreground">
              Les classements, les gains et les interactions sont desormais
              centralises pour une experience continue et competitive.
            </p>
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground uppercase tracking-wide">
              <ShieldCheck className="h-4 w-4" />
              Qualite
            </div>
            <p className="text-sm text-muted-foreground">
              V1.0.0 introduit un cadre stable : moderation, signalement et
              transparence sur les regles pour garder une communaute saine.
            </p>
            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-2 rounded-full border border-border/60 px-3 py-1">
                <Coins className="h-3 w-3" />
                Economie harmonisee
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-border/60 px-3 py-1">
                <MessageCircle className="h-3 w-3" />
                Social renforce
              </span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
