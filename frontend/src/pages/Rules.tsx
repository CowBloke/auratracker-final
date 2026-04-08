import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TYPOGRAPHY, SPACING } from '@/lib/design-system';
import { cn } from '@/lib/utils';
import { PageShell } from '@/components/layout/page-shell';
import { t } from '@/lib/i18n';

interface RuleSection {
  title: string;
  rules: string[];
}

const sections: RuleSection[] = [
  {
    title: t('rules_general_title'),
    rules: [
      t('rules_general_1'),
      t('rules_general_2'),
      t('rules_general_3'),
      t('rules_general_4'),
    ],
  },
  {
    title: t('rules_behavior_title'),
    rules: [
      t('rules_behavior_1'),
      t('rules_behavior_2'),
      t('rules_behavior_3'),
      t('rules_behavior_4'),
    ],
  },
  {
    title: t('rules_donations_title'),
    rules: [
      t('rules_donations_1'),
      t('rules_donations_2'),
      t('rules_donations_3'),
      t('rules_donations_4'),
    ],
  },
  {
    title: t('rules_games_title'),
    rules: [
      t('rules_games_1'),
      t('rules_games_2'),
      t('rules_games_3'),
      t('rules_games_4'),
    ],
  },
  {
    title: t('rules_market_title'),
    rules: [
      t('rules_market_1'),
      t('rules_market_2'),
      t('rules_market_3'),
      t('rules_market_4'),
    ],
  },
  {
    title: t('rules_security_title'),
    rules: [
      t('rules_security_1'),
      t('rules_security_2'),
      t('rules_security_3'),
      t('rules_security_4'),
    ],
  },
];

const sanctions = [
  { offense: t('rules_sanction_1_offense'), sanction: t('rules_sanction_1_sanction') },
  { offense: t('rules_sanction_2_offense'), sanction: t('rules_sanction_2_sanction') },
  { offense: t('rules_sanction_3_offense'), sanction: t('rules_sanction_3_sanction') },
  { offense: t('rules_sanction_4_offense'), sanction: t('rules_sanction_4_sanction') },
];

export default function Rules() {
  return (
    <PageShell>
      <Card>
        <CardHeader>
          <CardDescription>{t('rules_regulation')}</CardDescription>
          <CardTitle className={TYPOGRAPHY.H2}>{t('rules_principles')}</CardTitle>
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
          <CardDescription>{t('rules_moderation')}</CardDescription>
          <CardTitle className={TYPOGRAPHY.H2}>{t('rules_sanctions')}</CardTitle>
        </CardHeader>
        <CardContent className={SPACING.CARD_SPACING}>
          <p className={TYPOGRAPHY.SMALL}>
            {t('rules_sanction_intro')}
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
          <CardDescription>{t('rules_information')}</CardDescription>
          <CardTitle className={TYPOGRAPHY.H2}>{t('rules_contact')}</CardTitle>
        </CardHeader>
        <CardContent className={SPACING.CARD_SPACING}>
          <p className={TYPOGRAPHY.SMALL}>
            {t('rules_contact_text')}
          </p>
        </CardContent>
      </Card>
    </PageShell>
  );
}
