import { useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { theme } from '@/lib/theme';
import { useI18n } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { Screen } from '@/components/layout';
import { Field, FormMessage } from '@/components/form';
import { Button } from '@/components/primitives';

const { colors, fontSize, spacing } = theme;

export default function LoginScreen(): ReactNode {
  const { t } = useI18n();
  const router = useRouter();
  const { login } = useAuth();
  const { next } = useLocalSearchParams<{ next?: string }>();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(): Promise<void> {
    setError(null);
    setBusy(true);
    try {
      await login(email.trim(), password);
      if (next) router.replace(next as never);
      else if (router.canGoBack()) router.back();
      else router.replace('/free');
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen title={t('auth.login')} back>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ paddingTop: spacing[5] }}>
          {error ? <FormMessage message={error} /> : null}

          <Field
            label={t('auth.email')}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoComplete="email"
            placeholder="name@example.com"
          />
          <Field
            label={t('auth.password')}
            value={password}
            onChangeText={setPassword}
            secure
            autoComplete="password"
          />

          <Button
            label={t('auth.login')}
            loading={busy}
            disabled={!email || !password}
            onPress={() => void submit()}
            style={{ marginTop: spacing[2] }}
          />

          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/auth/forgot')}
            style={styles.linkRow}
          >
            <Text style={styles.link}>{t('auth.forgotPassword')}</Text>
          </Pressable>

          <View style={styles.footer}>
            <Text style={styles.footerText}>{t('auth.noAccount')}</Text>
            <Pressable accessibilityRole="button" onPress={() => router.replace('/auth/register')}>
              <Text style={styles.link}>{t('auth.register')}</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  linkRow: { alignSelf: 'center', paddingVertical: spacing[3] },
  link: { color: colors.accent.DEFAULT, fontSize: fontSize.base },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing[2],
    marginTop: spacing[4],
  },
  footerText: { color: colors.text.muted, fontSize: fontSize.base },
});
