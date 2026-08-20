import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface Faq {
  id: number;
  question: string;
  answer: string;
}

interface FaqSectionProps {
  brandColor?: string;
  faqs: Faq[];
  settings?: any;
  sectionData?: {
    title?: string;
    subtitle?: string;
    cta_text?: string;
    button_text?: string;
    default_faqs?: Array<{
      question: string;
      answer: string;
    }>;
  };
}

export default function FaqSection({ faqs, settings, sectionData, brandColor = '#3b82f6' }: FaqSectionProps) {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const { t } = useTranslation();

  const displayFaqs = faqs;

  const toggleFaq = (id: number) => {
    setOpenFaq(openFaq === id ? null : id);
  };

  return (
    <section className="py-12 sm:py-16 lg:py-20 bg-white dark:bg-gray-900">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8 sm:mb-12 lg:mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
            {sectionData?.title || t('Frequently Asked Questions')}
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-300 leading-relaxed font-medium">
            {sectionData?.subtitle || t('Got questions? We\'ve got answers. If you can\'t find what you\'re looking for, feel free to contact our support team.')}
          </p>
        </div>

        <div className="space-y-2 sm:space-y-3">
          {displayFaqs.map((faq) => (
            <div
              key={faq.id}
              className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg"
            >
              <button
                onClick={() => toggleFaq(faq.id)}
                className="w-full px-6 py-4 text-left flex justify-between cursor-pointer items-center hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                aria-expanded={openFaq === faq.id}
                aria-controls={`faq-answer-${faq.id}`}
                aria-describedby={`faq-question-${faq.id}`}
              >
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white pr-4" id={`faq-question-${faq.id}`}>
                  {faq.question}
                </h3>
                {openFaq === faq.id ? (
                  <ChevronUp className="w-5 h-5 text-gray-600 dark:text-gray-400 flex-shrink-0" aria-hidden="true" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-600 dark:text-gray-400 flex-shrink-0" aria-hidden="true" />
                )}
              </button>
              
              {openFaq === faq.id && (
                <div className="px-6 pb-4 border-t border-gray-200 dark:border-gray-700" id={`faq-answer-${faq.id}`} role="region" aria-labelledby={`faq-question-${faq.id}`}>
                  <p className="text-gray-600 dark:text-gray-300 leading-relaxed pt-4">
                    {faq.answer}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>

        {(sectionData?.cta_text || sectionData?.button_text) && (
          <div className="text-center mt-8 sm:mt-12">
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              {sectionData?.cta_text || t('Still have questions?')}
            </p>
            <a
              href="#contact"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg transition-all duration-300 font-semibold hover:scale-105 hover:shadow-lg transform"
              style={{ backgroundColor: brandColor, boxShadow: `0 10px 25px ${brandColor}20`, color: '#ffffff' }}
              onClick={(e) => {
                e.preventDefault();
                const contactSection = document.getElementById('contact');
                if (contactSection) {
                  contactSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
              }}
            >
              {sectionData?.button_text || t('Contact Support')}
            </a>
          </div>
        )}
      </div>
    </section>
  );
}