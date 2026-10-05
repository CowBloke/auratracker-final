import { useState, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { authApi } from '../services/api';
import { CheckCircle2, ChevronLeft, ChevronRight, CircleAlert } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { AuthShell } from '@/components/layout/AuthShell';
import { useFeatures } from '@/contexts/FeaturesContext';
import { t } from '@/lib/i18n';

const SCHOOL_LEVELS = [
  { value: 'SECONDE', label: t('register_school_level_second') },
  { value: 'PREMIERE', label: t('register_school_level_premiere') },
  { value: 'TERMINALE', label: t('register_school_level_terminale') },
] as const;

const SCHOOL_OPTIONS = [
  { value: 'SAINT_DOMINIQUE', label: 'Saint-Dominique' },
  { value: 'OTHER', label: t('register_school_other_option') },
] as const;

const CLASS_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'] as const;

const registerSchema = z.object({
  firstName: z.string()
    .trim()
    .min(1, t('register_first_name_required'))
    .max(50, t('register_max_50_chars')),
  schoolChoice: z.enum(['SAINT_DOMINIQUE', 'OTHER']),
  school: z.string()
    .trim()
    .min(1, t('register_school_required'))
    .max(100, t('register_max_100_chars')),
  schoolLevel: z.enum(['SECONDE', 'PREMIERE', 'TERMINALE']),
  classLetter: z.enum(['A', 'B', 'C', 'D', 'E', 'F', 'G']),
  username: z.string()
    .trim()
    .min(3, t('register_min_3_chars'))
    .max(20, t('register_max_20_chars')),
  email: z.string().trim().email(t('register_email_invalid')).min(1, t('register_email_required')),
  password: z.string().min(6, t('register_min_6_chars')),
  confirmPassword: z.string().min(1, t('register_confirm_required')),
  motivationMessage: z.string()
    .trim()
    .min(10, t('register_min_10_chars'))
    .max(500, t('register_max_500_chars')),
  referralCode: z.string()
    .trim()
    .max(24, t('register_max_24_chars'))
    .optional()
    .or(z.literal('')),
}).refine((data) => data.password === data.confirmPassword, {
  message: t('register_passwords_mismatch'),
  path: ['confirmPassword'],
});

type RegisterForm = z.infer<typeof registerSchema>;

interface OnboardingStep {
  id: string;
  type: 'profile' | 'education' | 'credentials' | 'motivation';
  title: string;
  description: string;
  fields: (keyof RegisterForm)[];
}

const STEPS: OnboardingStep[] = [
  {
    id: 'profile',
    type: 'profile',
    title: 'Profil',
    description: 'Commençons par ton nom et pseudo',
    fields: ['firstName', 'username'],
  },
  {
    id: 'education',
    type: 'education',
    title: 'Études',
    description: 'Dis-nous où tu étudies',
    fields: ['schoolChoice', 'school', 'schoolLevel', 'classLetter'],
  },
  {
    id: 'credentials',
    type: 'credentials',
    title: 'Compte',
    description: 'Email et mot de passe',
    fields: ['email', 'password', 'confirmPassword'],
  },
  {
    id: 'motivation',
    type: 'motivation',
    title: 'Finalisation',
    description: 'Aide-nous à comprendre tes objectifs',
    fields: ['motivationMessage', 'referralCode'],
  },
];

export default function Register() {
  const [currentStep, setCurrentStep] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [searchParams] = useSearchParams();
  const { maintenanceStatus, maintenanceLoading } = useFeatures();
  const referralEnabled = maintenanceStatus.referralEnabled;

  const form = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      firstName: '',
      schoolChoice: 'SAINT_DOMINIQUE',
      school: 'Saint-Dominique',
      schoolLevel: undefined,
      classLetter: undefined,
      username: '',
      email: '',
      password: '',
      confirmPassword: '',
      motivationMessage: '',
      referralCode: searchParams.get('ref') || '',
    },
    mode: 'onChange',
  });

  const steps = useMemo(() => {
    if (referralEnabled) return STEPS;
    // Remove referralCode from motivation step if referral is disabled
    return STEPS.map((step) =>
      step.id === 'motivation'
        ? { ...step, fields: ['motivationMessage'] as (keyof RegisterForm)[] }
        : step
    );
  }, [referralEnabled]);

  const currentStepData = steps[currentStep];

  const handleNextStep = async () => {
    const isValid = await form.trigger(currentStepData.fields);

    if (isValid) {
      setError('');
      if (currentStep < steps.length - 1) {
        setCurrentStep(currentStep + 1);
      } else {
        await onSubmit(form.getValues());
      }
    }
  };

  const handlePrevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      setError('');
    }
  };

  const onSubmit = async (data: RegisterForm) => {
    try {
      setError('');
      setLoading(true);
      const response = await authApi.register({
        username: data.username.trim(),
        firstName: data.firstName,
        school: data.school.trim(),
        schoolLevel: data.schoolLevel,
        classLetter: data.classLetter,
        email: data.email.trim(),
        password: data.password,
        motivationMessage: data.motivationMessage,
        referralCode: referralEnabled && data.referralCode?.trim() ? data.referralCode.trim() : undefined,
      });
      setSuccessMessage(response.data.message || '');
      setSuccess(true);
    } catch (err: any) {
      setError(err.response?.data?.error || t('register_request_failed'));
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <AuthShell>
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-xl">{t('register_success_title')}</CardTitle>
            <CardDescription>{successMessage || t('register_success_description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Alert>
              <CheckCircle2 />
              <AlertTitle>{t('register_success_title')}</AlertTitle>
            </Alert>
          </CardContent>
          <CardFooter>
            <Button asChild className="w-full">
              <Link to="/login">{t('register_back_to_login')}</Link>
            </Button>
          </CardFooter>
        </Card>
      </AuthShell>
    );
  }

  const isLastStep = currentStep === steps.length - 1;

  return (
    <AuthShell>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Étape {currentStep + 1} sur {steps.length}
            </span>
            <span>{currentStepData.title}</span>
          </div>
          <Progress value={((currentStep + 1) / steps.length) * 100} />
          <CardTitle className="pt-2 text-xl">{currentStepData.title}</CardTitle>
          <CardDescription>{currentStepData.description}</CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          {error ? (
            <Alert variant="destructive">
              <CircleAlert />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <Form {...form}>
            <form onSubmit={(event) => event.preventDefault()} className="flex flex-col gap-4">
              {currentStep === 0 && (
                <>
                  <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('register_first_name_placeholder')}</FormLabel>
                        <FormControl>
                          <Input type="text" autoComplete="given-name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('register_username_placeholder')}</FormLabel>
                        <FormControl>
                          <Input type="text" autoComplete="username" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}

              {currentStep === 1 && (
                <>
                  <FormField
                    control={form.control}
                    name="schoolChoice"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('register_school_placeholder')}</FormLabel>
                        <Select
                          onValueChange={(value) => {
                            field.onChange(value);
                            form.setValue('school', value === 'SAINT_DOMINIQUE' ? 'Saint-Dominique' : '', {
                              shouldValidate: true,
                            });
                          }}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder={t('register_school_placeholder')} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {SCHOOL_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {form.watch('schoolChoice') === 'OTHER' && (
                    <FormField
                      control={form.control}
                      name="school"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('register_school_other_placeholder')}</FormLabel>
                          <FormControl>
                            <Input type="text" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="schoolLevel"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('register_school_level_placeholder')}</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder={t('register_school_level_placeholder')} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {SCHOOL_LEVELS.map((level) => (
                                <SelectItem key={level.value} value={level.value}>
                                  {level.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="classLetter"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('register_class_letter_placeholder')}</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder={t('register_class_letter_placeholder')} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {CLASS_LETTERS.map((letter) => (
                                <SelectItem key={letter} value={letter}>
                                  {letter}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </>
              )}

              {currentStep === 2 && (
                <>
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('register_email_placeholder')}</FormLabel>
                        <FormControl>
                          <Input type="email" autoComplete="email" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('register_password_placeholder')}</FormLabel>
                        <FormControl>
                          <Input type="password" autoComplete="new-password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('register_confirm_password_placeholder')}</FormLabel>
                        <FormControl>
                          <Input type="password" autoComplete="new-password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}

              {currentStep === 3 && (
                <>
                  <FormField
                    control={form.control}
                    name="motivationMessage"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('register_motivation_placeholder')}</FormLabel>
                        <FormControl>
                          <Textarea className="min-h-28" maxLength={500} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {!maintenanceLoading && referralEnabled && (
                    <FormField
                      control={form.control}
                      name="referralCode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('register_referral_placeholder')}</FormLabel>
                          <FormControl>
                            <Input
                              type="text"
                              className="font-mono "
                              {...field}
                              value={field.value || ''}
                              onChange={(event) => field.onChange(event.target.value.toUpperCase())}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </>
              )}
            </form>
          </Form>
        </CardContent>

        <CardFooter className="flex-col gap-4">
          <div className="flex w-full gap-2">
            <Button variant="outline" onClick={handlePrevStep} disabled={currentStep === 0 || loading} className="flex-1">
              <ChevronLeft />
              Précédent
            </Button>
            <Button onClick={handleNextStep} disabled={loading} className="flex-1">
              {loading ? <Spinner /> : null}
              {isLastStep ? 'Envoyer' : 'Suivant'}
              {!loading ? <ChevronRight /> : null}
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            {t('register_have_account')}{' '}
            <Link to="/login" className="text-foreground underline-offset-4 hover:underline">
              {t('register_login_link')}
            </Link>
          </p>
        </CardFooter>
      </Card>
    </AuthShell>
  );
}
