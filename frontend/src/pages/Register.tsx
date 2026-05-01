import { useState, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { authApi } from '../services/api';
import { Loader2, CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TYPOGRAPHY } from '@/lib/design-system';
import { cn } from '@/lib/utils';
import { CenteredShell } from '@/components/layout/centered-shell';
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
    .min(3, t('register_min_3_chars'))
    .max(20, t('register_max_20_chars')),
  email: z.string().email(t('register_email_invalid')).min(1, t('register_email_required')),
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

// Progress step indicator component
function StepIndicator({ steps, currentStep }: { steps: OnboardingStep[]; currentStep: number }) {
  return (
    <div className="space-y-4">
      {/* Progress bar */}
      <div className="flex gap-1">
        {steps.map((_, index) => (
          <div
            key={index}
            className={cn(
              'h-1 flex-1 rounded-full transition-colors',
              index <= currentStep ? 'bg-foreground' : 'bg-border'
            )}
          />
        ))}
      </div>
      
      {/* Step labels */}
      <div className="flex items-center justify-between gap-2">
        {steps.map((step, index) => (
          <div
            key={step.id}
            className={cn(
              'flex flex-col items-center gap-1 flex-1 text-center',
              index <= currentStep && 'opacity-100',
              index > currentStep && 'opacity-50'
            )}
          >
            <div
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-colors',
                index < currentStep ? 'bg-foreground text-background' : index === currentStep ? 'bg-foreground text-background' : 'bg-border text-muted-foreground'
              )}
            >
              {index < currentStep ? '✓' : index + 1}
            </div>
            <span className={cn(TYPOGRAPHY.XS, 'hidden sm:inline')}>{step.title}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

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
    return STEPS.map(step =>
      step.id === 'motivation'
        ? { ...step, fields: ['motivationMessage'] as (keyof RegisterForm)[] }
        : step
    );
  }, [referralEnabled]);

  const currentStepData = steps[currentStep];

  const handleNextStep = async () => {
    const fieldsToValidate = currentStepData.fields;
    const isValid = await form.trigger(fieldsToValidate);
    
    if (isValid) {
      setError('');
      if (currentStep < steps.length - 1) {
        setCurrentStep(currentStep + 1);
      } else {
        // Submit form
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
        username: data.username,
        firstName: data.firstName,
        school: data.school.trim(),
        schoolLevel: data.schoolLevel,
        classLetter: data.classLetter,
        email: data.email,
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
      <CenteredShell widthClassName="max-w-sm">
        <Card>
          <CardContent className="space-y-8 pt-6 text-center">
            <div className="space-y-4">
              <CheckCircle2 className="mx-auto h-16 w-16 text-green-500" />
              <h1 className={TYPOGRAPHY.H2}>
                {t('register_success_title')}
              </h1>
              <p className={TYPOGRAPHY.MUTED}>
                {successMessage || t('register_success_description')}
              </p>
            </div>

            <Button asChild className="h-12 w-full">
              <Link to="/login">
                {t('register_back_to_login')}
              </Link>
            </Button>
          </CardContent>
        </Card>
      </CenteredShell>
    );
  }

  return (
    <CenteredShell widthClassName="max-w-sm">
      <Card>
        <CardHeader className="space-y-4 text-center pb-6">
          <StepIndicator steps={steps} currentStep={currentStep} />
          
          <div className="space-y-2">
            <CardTitle className={TYPOGRAPHY.H2}>{currentStepData.title}</CardTitle>
            <CardDescription>{currentStepData.description}</CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {error && (
            <p className={cn(TYPOGRAPHY.SMALL, 'text-destructive text-center')}>{error}</p>
          )}

          <Form {...form}>
            <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
              {/* Step 0: Profile */}
              {currentStep === 0 && (
                <>
                  <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input
                            type="text"
                            placeholder={t('register_first_name_placeholder')}
                            className="h-12 border-border/50 text-center"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage className="text-center" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input
                            type="text"
                            placeholder={t('register_username_placeholder')}
                            className="h-12 border-border/50 text-center"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage className="text-center" />
                      </FormItem>
                    )}
                  />
                </>
              )}

              {/* Step 1: Education */}
              {currentStep === 1 && (
                <>
                  <FormField
                    control={form.control}
                    name="schoolChoice"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Select
                            onValueChange={(value) => {
                              field.onChange(value);
                              form.setValue('school', value === 'SAINT_DOMINIQUE' ? 'Saint-Dominique' : '', { shouldValidate: true });
                            }}
                            value={field.value}
                          >
                            <SelectTrigger className="h-12 border-border/50 text-center">
                              <SelectValue placeholder={t('register_school_placeholder')} />
                            </SelectTrigger>
                            <SelectContent>
                              {SCHOOL_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage className="text-center" />
                      </FormItem>
                    )}
                  />

                  {form.watch('schoolChoice') === 'OTHER' && (
                    <FormField
                      control={form.control}
                      name="school"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input
                              type="text"
                              placeholder={t('register_school_other_placeholder')}
                              className="h-12 border-border/50 text-center"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage className="text-center" />
                        </FormItem>
                      )}
                    />
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={form.control}
                      name="schoolLevel"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <SelectTrigger className="h-12 border-border/50">
                                <SelectValue placeholder={t('register_school_level_placeholder')} />
                              </SelectTrigger>
                              <SelectContent>
                                {SCHOOL_LEVELS.map((level) => (
                                  <SelectItem key={level.value} value={level.value}>
                                    {level.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </FormControl>
                          <FormMessage className="text-center" />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="classLetter"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <SelectTrigger className="h-12 border-border/50">
                                <SelectValue placeholder={t('register_class_letter_placeholder')} />
                              </SelectTrigger>
                              <SelectContent>
                                {CLASS_LETTERS.map((letter) => (
                                  <SelectItem key={letter} value={letter}>
                                    {letter}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </FormControl>
                          <FormMessage className="text-center" />
                        </FormItem>
                      )}
                    />
                  </div>
                </>
              )}

              {/* Step 2: Credentials */}
              {currentStep === 2 && (
                <>
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder={t('register_email_placeholder')}
                            className="h-12 border-border/50 text-center"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage className="text-center" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input
                            type="password"
                            placeholder={t('register_password_placeholder')}
                            className="h-12 border-border/50 text-center"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage className="text-center" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input
                            type="password"
                            placeholder={t('register_confirm_password_placeholder')}
                            className="h-12 border-border/50 text-center"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage className="text-center" />
                      </FormItem>
                    )}
                  />
                </>
              )}

              {/* Step 3: Motivation */}
              {currentStep === 3 && (
                <>
                  <FormField
                    control={form.control}
                    name="motivationMessage"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Textarea
                            placeholder={t('register_motivation_placeholder')}
                            className="min-h-28 border-border/50"
                            maxLength={500}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage className="text-center" />
                      </FormItem>
                    )}
                  />

                  {!maintenanceLoading && referralEnabled && (
                    <FormField
                      control={form.control}
                      name="referralCode"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input
                              type="text"
                              placeholder={t('register_referral_placeholder')}
                              className="h-12 border-border/50 text-center uppercase tracking-[0.24em]"
                              {...field}
                              value={field.value || ''}
                              onChange={(event) => field.onChange(event.target.value.toUpperCase())}
                            />
                          </FormControl>
                          <FormMessage className="text-center" />
                        </FormItem>
                      )}
                    />
                  )}
                </>
              )}
            </form>
          </Form>

          {/* Navigation Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={handlePrevStep}
              disabled={currentStep === 0 || loading}
              className="h-12 flex-1"
            >
              <ChevronLeft className="mr-2 h-4 w-4" />
              Précédent
            </Button>

            <Button
              onClick={handleNextStep}
              disabled={loading}
              className="h-12 flex-1"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : currentStep === steps.length - 1 ? (
                <>
                  Envoyer
                  <ChevronRight className="ml-2 h-4 w-4" />
                </>
              ) : (
                <>
                  Suivant
                  <ChevronRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </div>

          <p className={cn(TYPOGRAPHY.SMALL, 'text-center text-muted-foreground')}>
            {t('register_have_account')}{' '}
            <Link to="/login" className="text-foreground hover:underline">
              {t('register_login_link')}
            </Link>
          </p>
        </CardContent>
      </Card>
    </CenteredShell>
  );
}
