import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useTranslation } from 'react-i18next';
import { router } from '@inertiajs/react';
import { toast } from '@/components/custom-toast';
import { Send, Save, MessageCircle, HelpCircle, Bell } from 'lucide-react';
import { SettingsSection } from '@/components/settings-section';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import axios from 'axios';

interface TelegramSettingsProps {
  settings?: {
    telegram_enabled?: boolean;
    telegram_bot_token?: string;
    telegram_chat_id?: string;
  };
}

export default function TelegramSettings({ settings = {} }: TelegramSettingsProps) {
  const { t } = useTranslation();
  const [isEnabled, setIsEnabled] = useState(settings.telegram_enabled === 1 || settings.telegram_enabled === true);
  const [botToken, setBotToken] = useState(settings.telegram_bot_token ?? '');
  const [chatId, setChatId] = useState(settings.telegram_chat_id ?? '');
  const [notifications, setNotifications] = useState<Record<string, boolean>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [availableNotifications, setAvailableNotifications] = useState<any[]>([]);

  useEffect(() => {
    // Initialize with props data
    setIsEnabled(settings.telegram_enabled === 1 || settings.telegram_enabled === true);
    setBotToken(settings.telegram_bot_token || '');
    setChatId(settings.telegram_chat_id || '');

    // Load current Telegram notification settings
    axios.get(route('settings.telegram-notifications.get'))
      .then(response => {
        setNotifications(response.data);
      })
      .catch(error => {
        console.error('Failed to load Telegram notification settings:', error);
      });

    // Load available notifications
    axios.get(route('settings.telegram-notifications.available'))
      .then(response => {
        setAvailableNotifications(response.data);
      })
      .catch(error => {
        console.error('Failed to load available notifications:', error);
      });

    // Load Telegram config
    axios.get(route('settings.telegram-config.get'))
      .then(response => {
        setBotToken(response.data.telegram_bot_token || '');
        setChatId(response.data.telegram_chat_id || '');
        setIsEnabled(response.data.telegram_enabled === 1 || response.data.telegram_enabled === '1' || response.data.telegram_enabled === true);
      })
      .catch(error => {
        console.error('Failed to load Telegram config:', error);
      });
  }, [settings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isEnabled && (!botToken || !chatId)) {
      toast.error(t('Please enter both Bot Token and Chat ID when Telegram integration is enabled'));
      return;
    }

    setIsSaving(true);
    toast.loading(t("Saving Telegram settings..."));

    try {
      await router.post(route('settings.telegram-notifications.update'), {
        telegram_enabled: isEnabled ? 1 : 0,
        telegram_bot_token: botToken,
        telegram_chat_id: chatId,
        ...notifications
      }, {
        preserveState: true,
        preserveScroll: true,
        onSuccess: (page) => {
            // Flash messages handled by useEffect
            toast.dismiss();
            const successMessage = page.props.flash?.success;
            const errorMessage = page.props.flash?.error;

            if (successMessage) {
                toast.success(successMessage);
            } else if (errorMessage) {
                toast.error(errorMessage);
            }
        },
        onError: (errors) => {
          toast.dismiss();
          toast.error(t("Failed to save Telegram settings"));
          console.error('Telegram settings error:', errors);
        },
        onFinish: () => {
          toast.dismiss();
          setIsSaving(false);
        }
      });
    } catch (error) {
      toast.dismiss();
      toast.error(t("Failed to save Telegram settings"));
      setIsSaving(false);
    }
  };

  const handleTest = async () => {
    if (!botToken || !chatId) {
      toast.error(t("Please enter both Bot Token and Chat ID first"));
      return;
    }

    setIsTesting(true);
    toast.loading(t("Sending test message..."));

    try {
      const response = await axios.post(route('telegram.test'), {
        bot_token: botToken,
        chat_id: chatId
      });

      toast.dismiss();
      toast.success(t("Test message sent successfully to Telegram!"));
    } catch (error: any) {
      toast.dismiss();
      if (error.response?.status === 422) {
        toast.error(t("Please check your bot token and chat ID"));
      } else {
        toast.error(t("Failed to send test message"));
      }
      console.error('Telegram test error:', error);
    } finally {
      setIsTesting(false);
    }
  };

  const handleNotificationChange = (key: string, value: boolean) => {
    setNotifications(prev => ({
      ...prev,
      [key]: value
    }));
  };

  return (
    <SettingsSection
      title={t("Telegram Settings")}
      description={t("Configure Telegram bot integration for real-time notifications")}
      action={
        <Button type="submit" form="telegram-settings-form" size="sm">
          <Save className="h-4 w-4 mr-2" />
          {t("Save Changes")}
        </Button>
      }
    >
      <form id="telegram-settings-form" onSubmit={handleSave}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Settings */}
          <div className="lg:col-span-2">
            <Card>
              <CardContent className="space-y-6 mt-6">
                {/* Enable Integration */}
                <div className="flex items-center justify-between p-4 border rounded-md">
                  <div>
                    <Label className="font-medium">{t("Enable Telegram Integration")}</Label>
                    <p className="text-xs text-muted-foreground mt-1">{t("Turn on to receive notifications in Telegram")}</p>
                  </div>
                  <Switch
                    checked={isEnabled}
                    onCheckedChange={setIsEnabled}
                  />
                </div>

                {/* Bot Token & Chat ID */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      {/* <MessageCircle className="h-4 w-4 text-muted-foreground" /> */}
                      <Label required={isEnabled} className="font-medium">{t("Bot Token")}</Label>
                    </div>
                    <Input
                      type="password"
                      placeholder={t("123456789:ABCdefGHIjklMNOpqrsTUVwxyz")}
                      value={botToken}
                      onChange={(e) => setBotToken(e.target.value)}
                      disabled={!isEnabled}
                      required={isEnabled}
                      className="font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      {t("Create a bot with @BotFather to get this token")}
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      {/* <MessageCircle className="h-4 w-4 text-muted-foreground" /> */}
                      <Label required={isEnabled} className="font-medium">{t("Chat ID")}</Label>
                    </div>
                    <Input
                    required={isEnabled}
                      placeholder={t("123456789 or -123456789")}
                      value={chatId}
                      onChange={(e) => setChatId(e.target.value)}
                      disabled={!isEnabled}
                      className="font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      {t("Use @userinfobot to get your chat ID")}
                    </p>
                  </div>
                </div>

                {/* Notification Settings - Only show if templates are available */}
                {availableNotifications.length > 0 && (
                  <>
                    <div className="flex items-center gap-2 mb-6">
                      <Bell className="h-5 w-5 text-emerald-500" />
                      <h3 className="font-medium text-gray-900">{t("Notification Settings")}</h3>
                    </div>

                    {/* Notification Types */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {availableNotifications.map(item => (
                        <div key={item.name} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                          <Label htmlFor={item.name} className="text-sm font-medium">{t(item.label)}</Label>
                          <Switch
                            id={item.name}
                            checked={notifications[item.name] || false}
                            onCheckedChange={(checked) => handleNotificationChange(item.name, checked)}
                            disabled={!isEnabled}
                          />
                        </div>
                      ))}
                    </div>
                  </>
                )}

              </CardContent>
            </Card>
          </div>

          {/* Test & Instructions */}
          <div className="space-y-6">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-4">
                  <Send className="h-4 w-4 text-primary" />
                  <h3 className="text-base font-medium">{t("Test Telegram Integration")}</h3>
                </div>

                <p className="text-sm text-muted-foreground mb-4">
                  {t("Send a test message to verify your Telegram configuration is working correctly.")}
                </p>

                <Button
                  type="button"
                  onClick={handleTest}
                  disabled={!isEnabled || !botToken || !chatId || isTesting}
                  className="w-full"
                >
                  <Send className="h-4 w-4 mr-2" />
                  {isTesting ? t("Sending...") : t("Send Test Message")}
                </Button>

                <p className="text-xs text-muted-foreground text-center mb-6 mt-4">
                  {t("Enter bot token and chat ID to test the integration")}
                </p>

                {/* Setup Instructions */}
                <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                  <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
                    {t("Setup Instructions")}
                  </h4>
                  <ol className="text-xs text-blue-800 dark:text-blue-200 space-y-1 list-decimal list-inside">
                    <li>{t("Message @BotFather on Telegram")}</li>
                    <li>{t("Create a new bot with /newbot")}</li>
                    <li>{t("Copy the bot token")}</li>
                    <li>{t("Get your chat ID from @userinfobot")}</li>
                    <li>{t("Enter both values above")}</li>
                  </ol>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </form>
    </SettingsSection>
  );
}
