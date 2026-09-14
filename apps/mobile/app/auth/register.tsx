import { useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { theme } from '@/lib/theme';
import { useI18n } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { Screen } from '@/components/layout';
import { Field, FormMessage, ToggleRow } from '@/components/form';
import { Button } from '@/components/primitives';

const { colors, fontSize, spacing } = theme;

export default function RegisterScreen(): ReactNode {
  const { t } = useI18n();
  const router = useRouter();
  const { register } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [terms, setTerms] = useState(false);
  const [age, setAge] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const ready = Boolean(email && password.length >= 10 && terms && age);

  async function submit(): Promise<void> {
    setError(null);
    setBusy(true);
    try {
      await register({
        email: email.trim(),
        password,
        displayName: displayName.trim() || undefined,
        referralCode: referralCode.trim() || undefined,
      });
      router.replace('/free');
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen title={t('auth.register')} back>
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
            autoComplete="new-password"
            hint={t('auth.passwordRules')}
          />
          <Field
            label={`${t('auth.displayName')} (${t('common.optional')})`}
            value={displayName}
            onChangeText={setDisplayName}
            autoCapitalize="words"
            autoComplete="name"
          />
          <Field
            label={`${t('auth.referralCode')} (${t('common.optional')})`}
            value={referralCode}
            onChangeText={setReferralCode}
            autoCapitalize="characters"
          />

          <ToggleRow label={t('auth.acceptTerms')} value={terms} onValueChange={setTerms} />
          <ToggleRow label={t('auth.confirmAge')} value={age} onValueChange={setAge} />

          <Button
            label={t('auth.register')}
            loading={busy}
            disabled={!ready}
            onPress={() => void submit()}
            style={{ marginTop: spacing[3] }}
          />

          <View style={styles.footer}>
            <Text style={styles.footerText}>{t('auth.hasAccount')}</Text>
            <Pressable accessibilityRole="button" onPress={() => router.replace('/auth/login')}>
              <Text style={styles.link}>{t('auth.login')}</Text>
            </Pressable>
          </View>

          <Text style={styles.legal}>
            {t('legal.ageNotice')} {t('legal.noGuarantee')}
          </Text>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  footer: { flexDirection: 'row', justifyContent: 'center', gap: spacing[2], marginTop: spacing[4] },
  footerText: { color: colors.text.muted, fontSize: fontSize.base },
  link: { color: colors.accent.DEFAULT, fontSize: fontSize.base },
  legal: {
    marginTop: spacing[5],
    color: colors.text.muted,
    fontSize: fontSize.xs,
    lineHeight: fontSize.xs * 1.6,
    textAlign: 'center',
  },
});
