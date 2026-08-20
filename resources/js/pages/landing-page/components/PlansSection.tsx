import React, { useState } from 'react';
import { Check, ArrowRight, Sparkles } from 'lucide-react';
import { Link } from '@inertiajs/react';
import { useScrollAnimation } from '../../../hooks/useScrollAnimation';
import { useTranslation } from 'react-i18next';

// Simple encryption function for plan ID
const encryptPlanId = (planId: number): string => {
  const key = 'TASKLY2024';
  const str = planId.toString();
  let encrypted = '';
  for (let i = 0; i < str.length; i++) {
    encrypted += String.fromCharCode(str.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return btoa(encrypted);
};

interface Plan {
  id: number;
  name: string;
  description: string;
  price: number;
  yearly_price?: number;
  duration: string;
  features?: string[];
  module?: string[];
  stats: {
    users?: number | string;
    workspaces?: number | string;
    projects?: number | string;
    storage?: string;
    [key: string]: any;
  };
  is_popular?: boolean;
  is_plan_enable: string;
}

interface PlansSectionProps {
  brandColor?: string;
  plans: Plan[];
  settings?: any;
  sectionData?: {
    title?: string;
    subtitle?: string;
    faq_text?: string;
  };
}

function PlansSection({ plans, settings, sectionData, brandColor = '#3b82f6' }: PlansSectionProps) {
  const { t } = useTranslation();
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const { ref, isVisible } = useScrollAnimation();

  // Filter enabled plans
  const enabledPlans = plans.filter(plan => plan.is_plan_enable === 'on');

  // Default plans if none provided
  const defaultPlans: Plan[] = [
    {
      id: 1,
      name: 'Starter',
      description: t('Perfect for small businesses looking to grow their online presence.'),
      price: 0,
      yearly_price: 0,
      duration: 'month',
      features: [
        'AI Integration'
      ],
      stats: {
        users: 1,
        workspaces: 5,
        projects: 10,
        storage: '1GB'
      },
      is_popular: false,
      is_plan_enable: 'on'
    },
    {
      id: 2,
      name: 'Professional',
      description: 'Ideal for professionals and small businesses',
      price: 19,
      yearly_price: 190,
      duration: 'month',
      features: [
        'AI Integration'
      ],
      stats: {
        users: 5,
        workspaces: 25,
        projects: 100,
        storage: '10GB'
      },
      is_popular: true,
      is_plan_enable: 'on'
    },
    {
      id: 3,
      name: 'Enterprise',
      description: 'For teams and large organizations',
      price: 49,
      yearly_price: 490,
      duration: 'month',
      features: [
        'AI Integration'
      ],
      stats: {
        users: 50,
        workspaces: 100,
        projects: 500,
        storage: '100GB'
      },
      is_popular: false,
      is_plan_enable: 'on'
    }
  ];

  const displayPlans: Plan[] = enabledPlans.length > 0 ? enabledPlans : defaultPlans;

  const formatCurrency = (amount: string | number) => {
    if (typeof window !== 'undefined' && window.appSettings?.formatCurrency) {
      const numericAmount = typeof amount === 'number' ? amount : parseFloat(amount);
      return window.appSettings.formatCurrency(numericAmount, { showSymbol: true });
    }
    return amount;
  };
  
  const getPrice = (plan: Plan) => {
    if (billingCycle === 'yearly' && plan.yearly_price) {
      return plan.yearly_price;
    }
    return plan.price;
  };

  return (
    <section id="pricing" className="py-12 sm:py-16 lg:py-20 bg-white dark:bg-gray-900" ref={ref}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className={`text-center mb-8 sm:mb-12 lg:mb-16 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
            {sectionData?.title || t('Choose Your Plan')}
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-300 max-w-3xl mx-auto mb-8 leading-relaxed font-medium">
            {sectionData?.subtitle || t('Start with our free plan and upgrade as you grow. All plans include our core features with no setup fees or hidden costs.')}
          </p>

          {/* Billing Toggle */}
          <div className="flex items-center justify-center gap-4">
            <span className={`text-sm ${billingCycle === 'monthly' ? 'text-gray-900 dark:text-white font-semibold' : 'text-gray-500 dark:text-gray-400'}`}>
              {t('Monthly')}
            </span>
            <button
              onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'yearly' : 'monthly')}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${billingCycle === 'monthly' ? 'bg-gray-200 dark:bg-gray-700' : ''}`}
              style={{ backgroundColor: billingCycle === 'yearly' ? brandColor : undefined }}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  billingCycle === 'yearly' ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
            <span className={`text-sm ${billingCycle === 'yearly' ? 'text-gray-900 dark:text-white font-semibold' : 'text-gray-500 dark:text-gray-400'}`}>
              {t('Yearly')}
            </span>
          </div>
        </div>

        <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 transition-all duration-700 delay-300 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          {displayPlans.map((plan) => (
            <div 
              key={plan.id} 
              className={`relative h-full transition-all duration-200 ${plan.is_popular ? 'transform scale-105' : ''}`}
            >
              {/* Main Card */}
              <div className={`
                relative h-full flex flex-col rounded-lg border-2 transition-all duration-200 bg-white dark:bg-gray-800
                ${plan.is_popular
                  ? 'shadow-xl'
                  : 'hover:shadow-lg border-gray-200 dark:border-gray-600'
                }
              `} style={{
                borderColor: plan.is_popular ? brandColor : undefined,
              }}>

                {/* Recommended Badge */}
                {plan.is_popular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-10">
                    <div 
                      className="text-white px-4 py-1 rounded-full text-sm font-semibold flex items-center gap-1.5"
                      style={{ backgroundColor: brandColor }}
                    >
                      <Check className="h-4 w-4" />
                      {t('Recommended')}
                    </div>
                  </div>
                )}
                
                {/* Card Header */}
                <div className="p-6 text-center border-b border-gray-100 dark:border-gray-700">
                  <h3 className="text-xl font-bold mb-2 text-gray-900 dark:text-white">
                    {plan.name}
                  </h3>

                  {/* Pricing */}
                  <div className="mb-4">
                    <div className="flex items-center justify-center">
                      <span className="text-4xl font-bold text-gray-900 dark:text-white font-mono">
                        {getPrice(plan) === 0 ? formatCurrency(0) : formatCurrency(getPrice(plan))}
                      </span>
                      <span className="ml-1 text-gray-500 dark:text-gray-400">
                        /{billingCycle === 'yearly' ? t('year') : t('month')}
                      </span>
                    </div>
                    {billingCycle === 'yearly' && getPrice(plan) > 0 && (
                      <div className="flex items-center justify-center gap-1 mt-1 text-sm" style={{ color: brandColor }}>
                        <Check className="h-3.5 w-3.5" />
                        {t('Save')} <span className="font-mono">{formatCurrency(Math.round((plan.price * 12 - getPrice(plan)) * 100) / 100)}</span> {t('annually')}
                      </div>
                    )}
                  </div>

                  {/* Description */}
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {plan.description}
                  </p>
                </div>
                
                {/* Card Content */}
                <div className="flex flex-col flex-1 p-6">
                  {/* Usage Stats - HRM Style List */}
                  {plan.stats && (
                    <div className="mb-6">
                      <h4 className="text-sm font-semibold mb-3 uppercase tracking-wide text-gray-900 dark:text-gray-400">
                        {t("What's Included")}
                      </h4>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-700 dark:text-gray-300">{t('Workspaces')}</span>
                          <span className="text-sm font-semibold text-gray-900 dark:text-white">{plan.stats?.workspaces || 'N/A'}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-700 dark:text-gray-300">{t('Users')}</span>
                          <span className="text-sm font-semibold text-gray-900 dark:text-white">{plan.stats?.users || 'N/A'}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-700 dark:text-gray-300">{t('Storage')}</span>
                          <span className="text-sm font-semibold text-gray-900 dark:text-white">{plan.stats?.storage || 'N/A'}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-700 dark:text-gray-300">{t('Projects')}</span>
                          <span className="text-sm font-semibold text-gray-900 dark:text-white">{plan.stats?.projects || 'N/A'}</span>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Features */}
                  {(plan.features || plan.module || []).length > 0 && (
                    <div className="mb-6 flex-1">
                      <h4 className="text-sm font-semibold mb-3 uppercase tracking-wide text-gray-900 dark:text-gray-400">
                        {t('Features')}
                      </h4>
                      <ul className="space-y-2">
                        {(plan.features || plan.module || []).map((feature, index) => (
                          <li key={index} className="flex items-center gap-2">
                            <div 
                              className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center"
                              style={{ backgroundColor: `${brandColor}20`, color: brandColor }}
                            >
                              <Check className="h-3 w-3" />
                            </div>
                            <span className="text-sm text-gray-700 dark:text-gray-300">{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {/* Actions */}
                  <div className="mt-auto pt-4 border-t border-gray-200 dark:border-gray-700">
                    <Link
                      href={route('register', { plan: encryptPlanId(plan.id) })}
                      className="block w-full text-center py-3 px-6 rounded-lg font-semibold transition-colors hover:opacity-90"
                      style={{
                        backgroundColor: plan.is_popular ? brandColor : undefined,
                        color: plan.is_popular ? 'white' : undefined,
                      }}
                      {...(!plan.is_popular && { className: 'block w-full text-center py-3 px-6 rounded-lg font-semibold transition-colors hover:opacity-90 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white' })}
                    >
                      {plan.price === 0 ? t('Start Free') : t('Get Started')}
                      <ArrowRight className="w-4 h-4 inline-block ml-2" />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* FAQ Link */}
        {sectionData?.faq_text && (
          <div className="text-center mt-8 sm:mt-12">
            <p className="text-gray-600 dark:text-gray-300">
              {sectionData.faq_text}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

export default PlansSection;