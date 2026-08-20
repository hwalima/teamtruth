import { useState } from 'react';
import { router } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle, XCircle, Key, Save } from 'lucide-react';
import { SettingsSection } from '@/components/settings-section';
import { useTranslation } from 'react-i18next';
import { toast } from '@/components/custom-toast';
import { isDemoMode } from '@/utils/cookie-utils';
import { Card, CardContent } from '@/components/ui/card';

interface ZoomSettingsProps {
  settings?: Record<string, string>;
}

export default function ZoomSettings({ settings = {} }: ZoomSettingsProps) {
  const { t } = useTranslation();
  const isDemo = isDemoMode();

  const [formData, setFormData] = useState({
    zoom_account_id: settings.zoom_account_id || '',
    zoom_client_id: settings.zoom_client_id || '',
    zoom_client_secret: settings.zoom_client_secret || '',
  });

  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);

  const handleChange = (name: string, value: any) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    router.post(route('settings.zoom.update'), formData, {
      preserveScroll: true,
      onSuccess: (page) => {
        toast.dismiss();
        setIsSaving(false);
        const successMessage = page.props.flash?.success;
        const errorMessage = page.props.flash?.error;

        if (successMessage) {
            toast.success(successMessage);
        } else if (errorMessage) {
            toast.error(errorMessage);
        }
      },
      onError: (errors) => {
        setIsSaving(false);
        const errorMessage = errors.error || Object.values(errors).join(', ') || t('Failed to update Zoom settings');
        toast.error(errorMessage);
      }
    });
  };

  const testConnection = async () => {
    setIsTesting(true);
    setTestResult(null);

    router.post(route('settings.zoom.test'), {
      zoom_account_id: formData.zoom_account_id,
      zoom_client_id: formData.zoom_client_id,
      zoom_client_secret: formData.zoom_client_secret
    }, {
      preserveScroll: true,
      onSuccess: (page) => {
        setIsTesting(false);
        const errorMessage = page.props.flash?.error;

        if (errorMessage) {
          setTestResult('error');
        } else {
          setTestResult('success');
        }
      },
      onError: (errors) => {
        setTestResult('error');
        setIsTesting(false);
        const errorMessage = errors.error || Object.values(errors).join(', ') || t('Failed to test connection');
        toast.error(errorMessage);
      }
    });
  };

  return (
    <SettingsSection
      title={t("Zoom Settings")}
      description={t("Configure Zoom meeting integration for video conferencing")}
      action={
        <Button type="submit" form="zoom-form" disabled={isSaving} size="sm">
          <Save className="h-4 w-4 mr-2" />
          {isSaving ? t('Saving...') : t('Save Changes')}
        </Button>
      }
    >
      <form id="zoom-form" onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-4">
        <Card>
          <CardContent className="space-y-6 mt-4">
          <div>
            <Label htmlFor="zoom_account_id">{t('Account ID')} <span className="text-red-500">*</span></Label>
            <Input
              id="zoom_account_id"
              type={isDemo && formData.zoom_account_id ? "password" : "text"}
              value={isDemo && formData.zoom_account_id ? "********************" : formData.zoom_account_id}
              onChange={(e) => handleChange('zoom_account_id', e.target.value)}
              placeholder={t('Enter your Zoom Account ID')}
              required
            />
          </div>

          <div>
            <Label htmlFor="zoom_client_id">{t('Client ID')} <span className="text-red-500">*</span></Label>
            <Input
              id="zoom_client_id"
              type={isDemo && formData.zoom_client_id ? "password" : "text"}
              value={isDemo && formData.zoom_client_id ? "********************" : formData.zoom_client_id}
              onChange={(e) => handleChange('zoom_client_id', e.target.value)}
              placeholder={t('Enter your Zoom Client ID')}
              required
            />
          </div>

          <div>
            <Label htmlFor="zoom_client_secret">{t('Client Secret')} <span className="text-red-500">*</span></Label>
            <Input
              id="zoom_client_secret"
              type="password"
              value={formData.zoom_client_secret}
              onChange={(e) => handleChange('zoom_client_secret', e.target.value)}
              placeholder={t('Enter your Zoom Client Secret')}
              required
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={testConnection}
                disabled={isDemo || !formData.zoom_account_id || !formData.zoom_client_id || !formData.zoom_client_secret || isTesting}
              >
                {isTesting ? t('Testing...') : t('Test Connection')}
              </Button>

              {testResult === 'success' && (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  <span className="text-sm">{t('Connection successful')}</span>
                </div>
              )}

              {testResult === 'error' && (
                <div className="flex items-center gap-2 text-red-600">
                  <XCircle className="h-4 w-4" />
                  <span className="text-sm">{t('Connection failed')}</span>
                </div>
              )}
            </div>

            <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded border border-amber-200">
              <strong>Note:</strong> You must test and validate your credentials before Zoom Meetings will appear in the sidebar.
            </p>
          </div>
          </CardContent>
          </Card>
        </div>
      </form>
    </SettingsSection>
  );
}
