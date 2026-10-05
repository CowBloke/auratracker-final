import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PageHeader, PageShell } from '@/components/layout/PageShell';
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
      t('rules_behavior_5'),
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
      <PageHeader title={t('rules_principles')} description={t('rules_regulation')} />

      <Card>
        <CardContent>
          <Accordion type="multiple" defaultValue={sections.map((_, index) => `section-${index}`)}>
            {sections.map((section, index) => (
              <AccordionItem key={section.title} value={`section-${index}`}>
                <AccordionTrigger>{section.title}</AccordionTrigger>
                <AccordionContent>
                  <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm">
                    {section.rules.map((rule) => (
                      <li key={rule}>{rule}</li>
                    ))}
                  </ol>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardDescription>{t('rules_moderation')}</CardDescription>
          <CardTitle>{t('rules_sanctions')}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">{t('rules_sanction_intro')}</p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Infraction</TableHead>
                <TableHead>Sanction</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sanctions.map((item) => (
                <TableRow key={item.offense}>
                  <TableCell className="whitespace-normal">{item.offense}</TableCell>
                  <TableCell className="whitespace-normal">{item.sanction}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardDescription>{t('rules_information')}</CardDescription>
          <CardTitle>{t('rules_contact')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{t('rules_contact_text')}</p>
        </CardContent>
      </Card>
    </PageShell>
  );
}
