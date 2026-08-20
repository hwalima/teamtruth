import { useForm, router, usePage } from '@inertiajs/react';
import { Mail, Lock } from 'lucide-react';
import { FormEventHandler, useState, useEffect } from 'react';

import InputError from '@/components/input-error';
import TextLink from '@/components/text-link';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';
import AuthLayout from '@/layouts/auth-layout';
import AuthButton from '@/components/auth/auth-button';
import Recaptcha from '@/components/recaptcha';
import { useBrand } from '@/contexts/BrandContext';
import { THEME_COLORS } from '@/hooks/use-appearance';
import { isRegistrationEnabled, usePageProps } from '@/utils/helpers';


type LoginForm = {
    email: string;
    password: string;
    remember: boolean;
    recaptcha_token?: string;
};

interface LoginProps {
    status?: string;
    canResetPassword: boolean;
}

export default function Login({ status, canResetPassword }: LoginProps) {
    const { t } = useTranslation();
    const { themeColor, customColor } = useBrand();

    const primaryColor = themeColor === 'custom' ? customColor : THEME_COLORS[themeColor as keyof typeof THEME_COLORS];
    const [isDemo, setIsDemo] = useState<boolean>(false);
    const [recaptchaToken, setRecaptchaToken] = useState<string>('');
    const [recaptchaError, setRecaptchaError] = useState<string>('');
    const { flash } = usePage().props as any;
    const pageProps = usePageProps();
    
    const { data, setData, post, processing, errors, reset } = useForm<LoginForm>({
        email: '',
        password: '',
        remember: false,
        recaptcha_token: '',
    });
    
    useEffect(() => {
        const isDemoMode = (window as any).isDemo === true;
        setIsDemo(isDemoMode);
        
        if (isDemoMode) {
            setData({
                email: 'company@example.com',
                password: 'password',
                remember: false
            });
        }
    }, []);

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        
        if (processing) return;
        
        const { settings = {} } = pageProps;
        const recaptchaEnabled = settings.recaptchaEnabled === 1 || settings.recaptchaEnabled === '1';
        const recaptchaVersion = settings.recaptchaVersion || 'v2';
        
        if (recaptchaEnabled && recaptchaVersion === 'v2' && !recaptchaToken) {
            setRecaptchaError(t('Please complete the reCAPTCHA verification.'));
            return;
        }
        
        setRecaptchaError('');
        const updatedData = {
            ...data,
            recaptcha_token: recaptchaToken
        };
        
        post(route('login'), updatedData, {
            onFinish: () => reset('password'),
            onError: () => {
                setTimeout(() => window.location.reload(), 100);
            },
        });
    };

    return (
        <AuthLayout
            title={t("Log in to your account")}
            description={t("Enter your credentials to access your account")}
            status={flash?.status || status}
            statusType={flash?.statusType || 'success'}
        >
            <form className="space-y-5" onSubmit={submit}>
                <div className="space-y-4">
                    <div className="relative">
                        <Label required htmlFor="email" className="font-medium mb-2 block text-sm" style={{ color: 'rgba(0,26,77,0.75)' }}>{t("Email address")}</Label>
                        <div className="relative">
                            <Input
                                id="email"
                                type="email"
                                required
                                autoFocus
                                tabIndex={1}
                                autoComplete="email"
                                value={data.email}
                                onChange={(e) => setData('email', e.target.value)}
                                placeholder="email@example.com"
                                className="w-full rounded-xl border-0 bg-white/60 focus:ring-2 transition-all duration-200"
                                style={{ boxShadow: `0 0 0 1.5px rgba(0,26,77,0.12)`, '--tw-ring-color': primaryColor } as React.CSSProperties}
                            />
                        </div>
                        <InputError message={errors.email} />
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <Label required htmlFor="password" className="font-medium mb-2 text-sm" style={{ color: 'rgba(0,26,77,0.75)' }}>{t("Password")}</Label>
                            {canResetPassword && (
                                <TextLink 
                                    href={route('password.request')} 
                                    className="text-sm no-underline hover:underline hover:underline-primary" 
                                    style={{ color: primaryColor }}
                                    tabIndex={5}
                                >
                                    {t("Forgot password?")}
                                </TextLink>
                            )}
                        </div>
                        <div className="relative">
                            <Input
                                id="password"
                                type="password"
                                required
                                tabIndex={2}
                                autoComplete="current-password"
                                value={data.password}
                                onChange={(e) => setData('password', e.target.value)}
                                placeholder="••••••••"
                                className="w-full rounded-xl border-0 bg-white/60 focus:ring-2 transition-all duration-200"
                                style={{ boxShadow: `0 0 0 1.5px rgba(0,26,77,0.12)`, '--tw-ring-color': primaryColor } as React.CSSProperties}
                            />
                        </div>
                        <InputError message={errors.password} />
                    </div>

                    <div className="flex items-center">
                        <Checkbox
                            id="remember"
                            name="remember"
                            checked={data.remember}
                            onClick={() => setData('remember', !data.remember)}
                            tabIndex={3}
                            className="border border-gray-300 rounded"
                        />
                        <Label htmlFor="remember" className="ms-2 text-gray-600 dark:text-gray-400">{t("Remember me")}</Label>
                    </div>
                </div>

                <Recaptcha 
                    onVerify={(token) => {
                        setRecaptchaToken(token);
                        setData('recaptcha_token', token);
                        setRecaptchaError('');
                    }}
                    onExpired={() => {
                        setRecaptchaToken('');
                        setData('recaptcha_token', '');
                    }}
                    onError={() => {
                        setRecaptchaToken('');
                        setData('recaptcha_token', '');
                    }}
                />
                <InputError message={recaptchaError || errors.recaptcha_token} />



                <AuthButton className='mb-0'
                    tabIndex={4} 
                    processing={processing}
                >
                    {t("Log in")}
                </AuthButton>

                 {(pageProps.isSaasMode && isRegistrationEnabled()) && (
                    <div className="text-center text-sm text-gray-600 dark:text-gray-400 mt-5">
                        {t("Don't have an account?")}{' '}
                        <TextLink 
                            href={route('register')} 
                            className="font-medium transition-colors duration-200" 
                            style={{ color: primaryColor }}
                            tabIndex={6}
                        >
                            {t("Sign up")}
                        </TextLink>
                    </div>
                )}
                
                
                {isDemo && (
                    <div>
                        {/* Divider */}
                        <div className="my-5">
                            <div className="flex items-center">
                                <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700"></div>
                                <div className="w-2 h-2 rotate-45 mx-4" style={{ backgroundColor: primaryColor }}></div>
                                <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700"></div>
                            </div>
                        </div>

                        <h3 className="text-sm font-medium text-gray-900 dark:text-gray-300 tracking-wider mb-4 text-center">{t("Quick Access")}</h3>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {pageProps.isSaasMode && (
                                    <Button 
                                        type="button" 
                                        onClick={() => {
                                            router.post(route('login'), {
                                                email: 'superadmin@example.com',
                                                password: 'password',
                                                remember: false
                                            });
                                        }}
                                        className="text-white px-4 py-2 rounded-md text-[13px] font-medium transition-all duration-200"
                                        style={{ backgroundColor: primaryColor }}
                                    >
                                        {t("Login as Super Admin")}
                                    </Button>
                                )}
                                <Button 
                                    type="button" 
                                    onClick={() => {
                                        router.post(route('login'), {
                                            email: 'company@example.com',
                                            password: 'password',
                                            remember: false
                                        });
                                    }}
                                    className="text-white px-4 py-2 rounded-md text-[13px] font-medium transition-all duration-200"
                                    style={{ backgroundColor: primaryColor }}
                                >
                                    {t("Login as Company")}
                                </Button>
                                        <Button 
                                            type="button" 
                                            onClick={() => {
                                                router.post(route('login'), {
                                                    email: 'sarah.johnson@techcorp.com',
                                                    password: 'password',
                                                    remember: false
                                                });
                                            }}
                                            className="text-white px-4 py-2 rounded-md text-[13px] font-medium transition-all duration-200"
                                            style={{ backgroundColor: primaryColor }}
                                        >
                                            {t("Login as Manager")}
                                        </Button>
                                        <Button 
                                            type="button" 
                                            onClick={() => {
                                                router.post(route('login'), {
                                                    email: 'david.kim@techcorp.com',
                                                    password: 'password',
                                                    remember: false
                                                });
                                            }}
                                            className="text-white px-4 py-2 rounded-md text-[13px] font-medium transition-all duration-200"
                                            style={{ backgroundColor: primaryColor }}
                                        >
                                            {t("Login as Member")}
                                        </Button>
                                        <Button 
                                            type="button" 
                                            onClick={() => {
                                                router.post(route('login'), {
                                                    email: 'globaltechindustries@client.com',
                                                    password: 'password',
                                                    remember: false
                                                });
                                            }}
                                            className="text-white px-4 py-2 rounded-md text-[13px] font-medium transition-all duration-200"
                                            style={{ backgroundColor: primaryColor }}
                                        >
                                            {t("Login as Client")}
                                        </Button>
                            </div>
                        </div>
                )}
            </form>
        </AuthLayout>
    );
}