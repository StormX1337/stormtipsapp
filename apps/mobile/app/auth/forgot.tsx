import { useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { theme } from '@/lib/theme';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { Screen } from '@/components/layout';
import { Field, FormMessage } from '@/components/form';
import { Button } from '@/components/primitives';

export default function ForgotPasswordScreen(): ReactNode {
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(): Promise<void> {
    setError(null);
    setBusy(true);
    try {
      // The API always answers 204 so an address cannot be probed for existence.
      await api('/auth/forgot-password', {
        method: 'POST',
        auth: false,
        body: { email: email.trim() },
      });
      setSent(true);
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen title={t('auth.forgotPassword')} back>
      <View style={{ paddingTop: theme.spacing[5] }}>
        {error ? <FormMessage message={error} /> : null}
        {sent ? <FormMessage message={t('auth.resetSent')} tone="success" /> : null}

        <Field
          label={t('auth.email')}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoComplete="email"
          placeholder="name@example.com"
        />

        <Button
          label={t('auth.resetPassword')}
          loading={busy}
          disabled={!email}
          onPress={() => void submit()}
          style={{ marginTop: theme.spacing[2] }}
        />
      </View>
    </Screen>
  );
}
