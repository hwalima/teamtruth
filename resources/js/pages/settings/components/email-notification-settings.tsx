import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { router } from '@inertiajs/react';
import { Save } from 'lucide-react';
import { SettingsSection } from '@/components/settings-section';
import axios from 'axios';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';

interface NotificationItem {
    name: string;
    label: string;
    description?: string;
}

export default function EmailNotificationSettings() {
    const { t } = useTranslation();
    const [notifications, setNotifications] = useState<Record<string, boolean>>({});
    const [availableNotifications, setAvailableNotifications] = useState<NotificationItem[]>([]);

    useEffect(() => {
        // Load available notifications
        axios.get(route('settings.email-notifications.available'))
            .then(response => {
                setAvailableNotifications(response.data);
            })
            .catch(error => {
                console.error('Failed to load available notifications:', error);
            });

        // Load current settings
        axios.get(route('settings.email-notifications.get'))
            .then(response => {
                setNotifications(response.data);
            })
            .catch(error => {
                console.error('Failed to load email notification settings:', error);
            });
    }, []);

    const handleToggle = (key: string, enabled: boolean) => {
        setNotifications(prev => ({
            ...prev,
            [key]: enabled
        }));
    };

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        router.post(route('settings.email-notifications.update'), notifications, {
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
            onError: () => {
                toast.error('Failed to update email notification settings.');
            }
        });
    };

    return (
        <SettingsSection
            title={t("Email Notification Settings")}
            description={t("Configure which email notifications are sent")}
            action={
                <Button onClick={handleSave} size="sm">
                    <Save className="h-4 w-4 mr-2" />
                    {t("Save Changes")}
                </Button>
            }
        >
                <Card>
              <CardContent className="pt-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {availableNotifications.map(item => (
                    <div key={item.name} className="flex items-center justify-between p-3 border rounded-md">
                        <Label htmlFor={item.name} className="text-sm font-medium">
                            {t(item.label)}
                        </Label>
                        <Switch
                            id={item.name}
                            checked={notifications[item.name] || false}
                            onCheckedChange={(checked) => handleToggle(item.name, checked)}
                        />
                    </div>
                ))}
            </div>
                </CardContent>
                </Card>
        </SettingsSection>
    );
}
