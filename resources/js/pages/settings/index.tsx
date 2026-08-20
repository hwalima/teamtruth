import { PageTemplate } from '@/components/page-template';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { type NavItem } from '@/types';
import { useEffect, useRef, useState } from 'react';
import { Settings as SettingsIcon, Building, DollarSign, Users, RefreshCw, Palette, BookOpen, Award, FileText, Mail, Bell, Link2, CreditCard, Calendar, HardDrive, Shield, Bot, Cookie, Search, Webhook, Wallet, MessageSquare, Slack, Send, Video, Receipt, MonitorSmartphone } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import SystemSettings from './components/system-settings';
import { usePage } from '@inertiajs/react';

import CurrencySettings from './components/currency-settings';

import BrandSettings from './components/brand-settings';
import EmailSettings from './components/email-settings';
import PaymentSettings from './components/payment-settings';
import StorageSettings from './components/storage-settings';
import RecaptchaSettings from './components/recaptcha-settings';
import ChatGptSettings from './components/chatgpt-settings';
import CookieSettings from './components/cookie-settings';
import SeoSettings from './components/seo-settings';
import CacheSettings from './components/cache-settings';
import WebhookSettings from './components/webhook-settings';
import SlackSettings from './components/slack-settings';
import TelegramSettings from './components/telegram-settings';
import EmailNotificationSettings from './components/email-notification-settings';
import TaxSettings from './components/tax-settings';
import ZoomSettings from './components/zoom-settings';
import GoogleCalendarSettings from './components/google-calendar-settings';
import GoogleMeetSettings from './components/google-meet-settings';

import { useTranslation } from 'react-i18next';
import { hasPermission } from '@/utils/permissions';
import { useLayout } from '@/contexts/LayoutContext';
import InvoiceSettings from './components/invoice-settings';
import IctTicketSettings from './components/ict-ticket-settings';
import { Card } from '@/components/ui/card';

export default function Settings() {
  const { t } = useTranslation();
  const { position } = useLayout();
  const { systemSettings = {}, cacheSize = '0.00', timezones = {}, dateFormats = {}, timeFormats = {}, paymentSettings = {}, slackSettings = {}, telegramSettings = {}, webhooks = [], taxes = [], auth = {}, isSaasMode = false, isDemoMode = false, invoiceSettings = {}, currentWorkspace = {} } = usePage().props as any;

  // System Settings show condition:
  // Superadmin: always show
  // SaaS mode: company user hoy AND workspace_members ma owner role hoy to j show karo
  // Non-SaaS: permission check thi j handle thay
  const isSuperAdmin = auth?.user?.type === 'superadmin';
  const isCompanyOwner = auth?.user?.type === 'company' && auth?.user?.workspace_role === 'owner';
  const showSystemSettings = isSuperAdmin || (isSaasMode ? isCompanyOwner : hasPermission('settings_system'));

  // Set global demo mode flag for contexts
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).appSettings = {
        ...(window as any).appSettings,
        isDemoMode
      };
    }
  }, [isDemoMode]);

  const [activeSection, setActiveSection] = useState('system-settings');

  // Define all possible sidebar navigation items
  const allSidebarNavItems: (NavItem & { permission?: string; show?: boolean })[] = [
    {
      title: t('System Settings'),
      href: '#system-settings',
      icon: <SettingsIcon className="h-4 w-4 mr-2" />,
      permission: 'settings_system',
      show: showSystemSettings,
    },
    {
      title: t('Brand Settings'),
      href: '#brand-settings',
      icon: <Palette className="h-4 w-4 mr-2" />,
      permission: 'settings_brand'
    },
    {
      title: t('Currency Settings'),
      href: '#currency-settings',
      icon: <DollarSign className="h-4 w-4 mr-2" />,
      permission: 'settings_currency'
    },
    {
      title: t('Email Settings'),
      href: '#email-settings',
      icon: <Mail className="h-4 w-4 mr-2" />,
      permission: 'settings_email'
    },
    {
      title: t('Email Notification Settings'),
      href: '#email-notification-settings',
      icon: <Bell className="h-4 w-4 mr-2" />,
      permission: 'settings_email_notification'
    },
    {
      title: t('Tax Settings'),
      href: '#tax-settings',
      icon: <Receipt className="h-4 w-4 mr-2" />,
      permission: 'settings_tax'
    },
    {
      title: t('Payment Settings'),
      href: '#payment-settings',
      icon: <CreditCard className="h-4 w-4 mr-2" />,
      permission: 'settings_payment'
    },
    {
      title: t('Slack Settings'),
      href: '#slack-settings',
      icon: <Slack className="h-4 w-4 mr-2" />,
      permission: 'settings_slack'
    },
    {
      title: t('Telegram Settings'),
      href: '#telegram-settings',
      icon: <Send className="h-4 w-4 mr-2" />,
      permission: 'settings_telegram'
    },
    {
      title: t('Storage Settings'),
      href: '#storage-settings',
      icon: <HardDrive className="h-4 w-4 mr-2" />,
      permission: 'settings_storage'
    },
    {
      title: t('ReCaptcha Settings'),
      href: '#recaptcha-settings',
      icon: <Shield className="h-4 w-4 mr-2" />,
      permission: 'settings_recaptcha'
    },
    {
      title: t('Chat GPT Settings'),
      href: '#chatgpt-settings',
      icon: <Bot className="h-4 w-4 mr-2" />,
      permission: 'settings_chatgpt'
    },
    {
      title: t('Cookie Settings'),
      href: '#cookie-settings',
      icon: <Cookie className="h-4 w-4 mr-2" />,
      permission: 'settings_cookie'
    },
    {
      title: t('SEO Settings'),
      href: '#seo-settings',
      icon: <Search className="h-4 w-4 mr-2" />,
      permission: 'settings_seo'
    },
    {
      title: t('Cache Settings'),
      href: '#cache-settings',
      icon: <HardDrive className="h-4 w-4 mr-2" />,
      permission: 'settings_cache'
    },
    {
      title: t('Webhook Settings'),
      href: '#webhook-settings',
      icon: <Webhook className="h-4 w-4 mr-2" />,
      permission: 'settings_webhook'
    },
    {
      title: t('Zoom Settings'),
      href: '#zoom-settings',
      icon: <Video className="h-4 w-4 mr-2" />,
      permission: 'zoom_meeting_view_any'
    },
    {
      title: t('Invoice Settings'),
      href: '#invoice-settings',
      icon: <FileText className="h-4 w-4 mr-2" />,
      permission: 'settings_invoice'
    },
    {
      title: t('Google Calendar Settings'),
      href: '#google-calendar-settings',
      icon: <Calendar className="h-4 w-4 mr-2" />,
      permission: 'settings_google_calendar'
    },
    {
      title: t('Google Meet Settings'),
      href: '#google-meet-settings',
      icon: <Video className="h-4 w-4 mr-2" />,
      permission: 'settings_google_meet'
    },
    {
      title: t('ICT Ticket Settings'),
      href: '#ict-ticket-settings',
      icon: <MonitorSmartphone className="h-4 w-4 mr-2" />,
      permission: 'settings_system'
    },
  ];

  // Filter sidebar items based on user permissions
  const sidebarNavItems = allSidebarNavItems.filter(item => {
    if ('show' in item) return item.show;
    return item.permission ? hasPermission(item.permission) : true;
  });

  // Refs for each section
  const systemSettingsRef = useRef<HTMLDivElement>(null);
  const brandSettingsRef = useRef<HTMLDivElement>(null);

  const currencySettingsRef = useRef<HTMLDivElement>(null);
  const emailSettingsRef = useRef<HTMLDivElement>(null);
  const emailNotificationSettingsRef = useRef<HTMLDivElement>(null);
  const taxSettingsRef = useRef<HTMLDivElement>(null);
  const paymentSettingsRef = useRef<HTMLDivElement>(null);
  const slackSettingsRef = useRef<HTMLDivElement>(null);
  const telegramSettingsRef = useRef<HTMLDivElement>(null);
  const storageSettingsRef = useRef<HTMLDivElement>(null);
  const recaptchaSettingsRef = useRef<HTMLDivElement>(null);
  const chatgptSettingsRef = useRef<HTMLDivElement>(null);
  const cookieSettingsRef = useRef<HTMLDivElement>(null);
  const seoSettingsRef = useRef<HTMLDivElement>(null);
  const cacheSettingsRef = useRef<HTMLDivElement>(null);
  const webhookSettingsRef = useRef<HTMLDivElement>(null);
  const zoomSettingsRef = useRef<HTMLDivElement>(null);
  const invoiceSettingsRef = useRef<HTMLDivElement>(null);
  const googleCalendarSettingsRef = useRef<HTMLDivElement>(null);
  const googleMeetSettingsRef = useRef<HTMLDivElement>(null);
  const ictTicketSettingsRef = useRef<HTMLDivElement>(null);



  // Smart scroll functionality
  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 100; // Add offset for better UX

      // Get positions of each section
      const systemSettingsPosition = systemSettingsRef.current?.offsetTop || 0;
      const brandSettingsPosition = brandSettingsRef.current?.offsetTop || 0;

      const currencySettingsPosition = currencySettingsRef.current?.offsetTop || 0;
      const emailSettingsPosition = emailSettingsRef.current?.offsetTop || 0;
      const emailNotificationSettingsPosition = emailNotificationSettingsRef.current?.offsetTop || 0;
      const taxSettingsPosition = taxSettingsRef.current?.offsetTop || 0;
      const paymentSettingsPosition = paymentSettingsRef.current?.offsetTop || 0;
      const slackSettingsPosition = slackSettingsRef.current?.offsetTop || 0;
      const telegramSettingsPosition = telegramSettingsRef.current?.offsetTop || 0;
      const storageSettingsPosition = storageSettingsRef.current?.offsetTop || 0;
      const recaptchaSettingsPosition = recaptchaSettingsRef.current?.offsetTop || 0;
      const chatgptSettingsPosition = chatgptSettingsRef.current?.offsetTop || 0;
      const cookieSettingsPosition = cookieSettingsRef.current?.offsetTop || 0;
      const seoSettingsPosition = seoSettingsRef.current?.offsetTop || 0;
      const cacheSettingsPosition = cacheSettingsRef.current?.offsetTop || 0;
      const webhookSettingsPosition = webhookSettingsRef.current?.offsetTop || 0;
      const zoomSettingsPosition = zoomSettingsRef.current?.offsetTop || 0;
      const invoiceSettingsPosition = invoiceSettingsRef.current?.offsetTop || 0;
      const googleCalendarSettingsPosition = googleCalendarSettingsRef.current?.offsetTop || 0;
      const googleMeetSettingsPosition = googleMeetSettingsRef.current?.offsetTop || 0;
      const ictTicketSettingsPosition = ictTicketSettingsRef.current?.offsetTop || 0;


      // Determine active section based on scroll position
      if (scrollPosition >= ictTicketSettingsPosition && ictTicketSettingsPosition > 0) {
        setActiveSection('ict-ticket-settings');
      } else if (scrollPosition >= invoiceSettingsPosition && invoiceSettingsPosition > 0) {
        setActiveSection('invoice-settings');
      } else if (scrollPosition >= googleMeetSettingsPosition && googleMeetSettingsPosition > 0) {
        setActiveSection('google-meet-settings');
      } else if (scrollPosition >= googleCalendarSettingsPosition && googleCalendarSettingsPosition > 0) {
        setActiveSection('google-calendar-settings');
      } else if (scrollPosition >= zoomSettingsPosition && zoomSettingsPosition > 0) {
        setActiveSection('zoom-settings');
      } else if (scrollPosition >= webhookSettingsPosition && webhookSettingsPosition > 0) {
        setActiveSection('webhook-settings');
      } else if (scrollPosition >= cacheSettingsPosition && cacheSettingsPosition > 0) {
        setActiveSection('cache-settings');
      } else if (scrollPosition >= seoSettingsPosition && seoSettingsPosition > 0) {
        setActiveSection('seo-settings');
      } else if (scrollPosition >= cookieSettingsPosition && cookieSettingsPosition > 0) {
        setActiveSection('cookie-settings');
      } else if (scrollPosition >= chatgptSettingsPosition && chatgptSettingsPosition > 0) {
        setActiveSection('chatgpt-settings');
      } else if (scrollPosition >= recaptchaSettingsPosition && recaptchaSettingsPosition > 0) {
        setActiveSection('recaptcha-settings');
      } else if (scrollPosition >= storageSettingsPosition && storageSettingsPosition > 0) {
        setActiveSection('storage-settings');
      } else if (scrollPosition >= telegramSettingsPosition && telegramSettingsPosition > 0) {
        setActiveSection('telegram-settings');
      } else if (scrollPosition >= slackSettingsPosition && slackSettingsPosition > 0) {
        setActiveSection('slack-settings');
      } else if (scrollPosition >= paymentSettingsPosition && paymentSettingsPosition > 0) {
        setActiveSection('payment-settings');
      } else if (scrollPosition >= taxSettingsPosition && taxSettingsPosition > 0) {
        setActiveSection('tax-settings');
      } else if (scrollPosition >= emailNotificationSettingsPosition && emailNotificationSettingsPosition > 0) {
        setActiveSection('email-notification-settings');
      } else if (scrollPosition >= emailSettingsPosition && emailSettingsPosition > 0) {
        setActiveSection('email-settings');
      } else if (scrollPosition >= currencySettingsPosition && currencySettingsPosition > 0) {
        setActiveSection('currency-settings');

      } else if (scrollPosition >= brandSettingsPosition && brandSettingsPosition > 0) {
        setActiveSection('brand-settings');
      } else {
        setActiveSection('system-settings');
      }
    };

    // Add scroll event listener
    window.addEventListener('scroll', handleScroll);

    // Initial check for hash in URL
    const hash = window.location.hash.replace('#', '');
    if (hash) {
      const element = document.getElementById(hash);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
        setActiveSection(hash);
      }
    }

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // Handle navigation click
  const handleNavClick = (href: string) => {
    const id = href.replace('#', '');
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
      setActiveSection(id);
    }
  };

  const breadcrumbs = [
    { title: t('Dashboard'), href: route('dashboard') },
    { title: t('Settings') }
  ];

  return (
    <PageTemplate
      title={t('Settings')}
      description={t('Manage system settings.')}
      url="/settings"
      breadcrumbs={breadcrumbs}
    >
      <div className={`flex flex-col md:flex-row gap-8`} dir={position === 'right' ? 'rtl' : 'ltr'}>
        {/* Sidebar Navigation */}
        <div className="md:w-70 flex-shrink-0">
          <div className="sticky top-20">
            <ScrollArea dir={position === 'right' ? 'rtl' : 'ltr'} className="h-[calc(100vh-5rem)]">
              <Card className={`p-3 space-y-2 ${position === 'right' ? 'pl-4' : 'pr-4'}`}>
                {sidebarNavItems.map((item) => (
                  <Button
                    key={item.href}
                    variant="ghost"
                    className={cn('w-full justify-start', {
                          'bg-muted font-medium': activeSection === item.href.replace('#', ''),
                    })}
                    onClick={() => handleNavClick(item.href)}
                  >
                    {item.icon}
                    {item.title}
                  </Button>
                ))}
              </Card>
            </ScrollArea>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1">
          {/* System Settings Section */}
          {showSystemSettings && (
            <section id="system-settings" ref={systemSettingsRef} className="mb-8">
              <SystemSettings
                settings={systemSettings}
                timezones={timezones}
                dateFormats={dateFormats}
                timeFormats={timeFormats}
              />
            </section>
          )}

          {/* Brand Settings Section */}
          {(hasPermission('settings_view') && hasPermission('settings_brand')) && (
            <section id="brand-settings" ref={brandSettingsRef} className="mb-8">
              <BrandSettings />
            </section>
          )}

          {/* Currency Settings Section */}
          {(hasPermission('settings_view') && hasPermission('settings_currency')) && (
            <section id="currency-settings" ref={currencySettingsRef} className="mb-8">
              <CurrencySettings />
            </section>
          )}

          {/* Email Settings Section */}
          {(hasPermission('settings_view') && hasPermission('settings_email')) && (
            <section id="email-settings" ref={emailSettingsRef} className="mb-8">
              <EmailSettings />
            </section>
          )}

          {/* Email Notification Settings Section */}
          {(hasPermission('settings_view') && hasPermission('settings_email_notification')) && (
            <section id="email-notification-settings" ref={emailNotificationSettingsRef} className="mb-8">
              <EmailNotificationSettings />
            </section>
          )}

          {/* Tax Settings Section */}
          {(hasPermission('settings_view') && hasPermission('settings_tax')) && (
            <section id="tax-settings" ref={taxSettingsRef} className="mb-8">
              <TaxSettings taxes={taxes} />
            </section>
          )}

          {/* Payment Settings Section */}
          {(hasPermission('settings_view') && hasPermission('settings_payment')) && (
            <section id="payment-settings" ref={paymentSettingsRef} className="mb-8">
              <PaymentSettings settings={paymentSettings} />
            </section>
          )}

          {/* Slack Settings Section */}
          {(hasPermission('settings_view') && hasPermission('settings_slack')) && (
            <section id="slack-settings" ref={slackSettingsRef} className="mb-8">
              <SlackSettings settings={slackSettings} />
            </section>
          )}

          {/* Telegram Settings Section */}
          {(hasPermission('settings_view') && hasPermission('settings_telegram')) && (
            <section id="telegram-settings" ref={telegramSettingsRef} className="mb-8">
              <TelegramSettings settings={telegramSettings} />
            </section>
          )}

          {/* Storage Settings Section */}
          {(hasPermission('settings_view') && hasPermission('settings_storage')) && (
            <section id="storage-settings" ref={storageSettingsRef} className="mb-8">
              <StorageSettings settings={systemSettings} />
            </section>
          )}

          {/* ReCaptcha Settings Section */}
          {(hasPermission('settings_view') && hasPermission('settings_recaptcha')) && (
            <section id="recaptcha-settings" ref={recaptchaSettingsRef} className="mb-8">
              <RecaptchaSettings settings={systemSettings} />
            </section>
          )}

          {/* Chat GPT Settings Section */}
          {(hasPermission('settings_view') && hasPermission('settings_chatgpt')) && (
            <section id="chatgpt-settings" ref={chatgptSettingsRef} className="mb-8">
              <ChatGptSettings settings={systemSettings} />
            </section>
          )}

          {/* Cookie Settings Section */}
          {(hasPermission('settings_view') && hasPermission('settings_cookie')) && (
            <section id="cookie-settings" ref={cookieSettingsRef} className="mb-8">
              <CookieSettings settings={systemSettings} />
            </section>
          )}

          {/* SEO Settings Section */}
          {(hasPermission('settings_view') && hasPermission('settings_seo')) && (
            <section id="seo-settings" ref={seoSettingsRef} className="mb-8">
              <SeoSettings settings={systemSettings} />
            </section>
          )}

          {/* Cache Settings Section */}
          {(hasPermission('settings_view') && hasPermission('settings_cache')) && (
            <section id="cache-settings" ref={cacheSettingsRef} className="mb-8">
              <CacheSettings cacheSize={cacheSize} />
            </section>
          )}

          {/* Webhook Settings Section */}
          {(hasPermission('settings_view') && hasPermission('settings_webhook')) && (
            <section id="webhook-settings" ref={webhookSettingsRef} className="mb-8">
              <WebhookSettings webhooks={webhooks} />
            </section>
          )}

          {/* Zoom Settings Section */}
          {(hasPermission('settings_view') && hasPermission('zoom_meeting_view_any')) && (
            <section id="zoom-settings" ref={zoomSettingsRef} className="mb-8">
              <ZoomSettings settings={systemSettings} />
            </section>
          )}

          {/* Invoice Settings Section */}
          {(hasPermission('settings_view') && hasPermission('settings_invoice')) && (
            <section id="invoice-settings" ref={invoiceSettingsRef} className="mb-8">
              <InvoiceSettings settings={invoiceSettings} />
            </section>
          )}

          {/* Google Calendar Settings Section */}
          {(hasPermission('settings_view') && hasPermission('settings_google_calendar')) && (
            <section id="google-calendar-settings" ref={googleCalendarSettingsRef} className="mb-8">
              <GoogleCalendarSettings settings={systemSettings} />
            </section>
          )}

          {/* Google Meet Settings Section */}
          {(hasPermission('settings_view') && hasPermission('settings_google_meet')) && (
            <section id="google-meet-settings" ref={googleMeetSettingsRef} className="mb-8">
              <GoogleMeetSettings settings={systemSettings} />
            </section>
          )}

          {/* ICT Ticket Settings Section */}
          {showSystemSettings && (
            <section id="ict-ticket-settings" ref={ictTicketSettingsRef} className="mb-8">
              <IctTicketSettings />
            </section>
          )}
        </div>
      </div>
    </PageTemplate>
  );
}
