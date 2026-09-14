import { useState, type ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
} from 'react-native';
import { theme } from '@/lib/theme';

const { colors, fontSize, radii, sizes, spacing } = theme;

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  secure,
  keyboardType,
  autoCapitalize = 'none',
  autoComplete,
  error,
  hint,
  editable = true,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  secure?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoComplete?: 'email' | 'password' | 'new-password' | 'name' | 'off';
  error?: string | null;
  hint?: string;
  editable?: boolean;
}): ReactNode {
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View
        style={[
          styles.inputWrap,
          focused && { borderColor: colors.border.accent },
          error ? { borderColor: colors.feedback.danger } : null,
        ]}
      >
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.text.disabled}
          secureTextEntry={secure && !revealed}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoComplete={autoComplete}
          autoCorrect={false}
          editable={editable}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={styles.input}
        />
        {secure ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={revealed ? 'Passwort verbergen' : 'Passwort anzeigen'}
            hitSlop={8}
            onPress={() => setRevealed((current) => !current)}
          >
            <Text style={styles.reveal}>{revealed ? '🙈' : '👁'}</Text>
          </Pressable>
        ) : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

export function ToggleRow({
  label,
  description,
  value,
  onValueChange,
  disabled,
}: {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
}): ReactNode {
  return (
    <View style={styles.toggleRow}>
      <View style={styles.toggleText}>
        <Text style={styles.toggleLabel}>{label}</Text>
        {description ? <Text style={styles.toggleDescription}>{description}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: colors.bg.cardAlt, true: colors.accent[700] }}
        thumbColor={value ? colors.accent.DEFAULT : colors.text.muted}
      />
    </View>
  );
}

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
}): ReactNode {
  return (
    <View style={styles.segmented}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(option.value)}
            style={[styles.segment, active && styles.segmentActive]}
          >
            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Inline banner for form-level success or failure feedback. */
export function FormMessage({
  message,
  tone = 'error',
}: {
  message: string;
  tone?: 'error' | 'success';
}): ReactNode {
  const color = tone === 'error' ? colors.feedback.danger : colors.feedback.success;
  return (
    <Text accessibilityRole="alert" style={[styles.formMessage, { color, backgroundColor: `${color}1F` }]}>
      {message}
    </Text>
  );
}

const styles = StyleSheet.create({
  field: { marginBottom: spacing[3] },
  label: { color: colors.text.secondary, fontSize: fontSize.sm, marginBottom: spacing[1.5] },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    backgroundColor: colors.bg.input,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.default,
    paddingHorizontal: spacing[3],
  },
  input: {
    flex: 1,
    color: colors.text.primary,
    fontSize: fontSize.md,
    minHeight: sizes.touchTarget,
    paddingVertical: spacing[2],
  },
  reveal: { fontSize: fontSize.md },
  error: { marginTop: spacing[1], color: colors.feedback.danger, fontSize: fontSize.xs },
  hint: { marginTop: spacing[1], color: colors.text.muted, fontSize: fontSize.xs },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[2.5],
  },
  toggleText: { flex: 1 },
  toggleLabel: { color: colors.text.primary, fontSize: fontSize.md },
  toggleDescription: { color: colors.text.muted, fontSize: fontSize.xs, marginTop: 2 },
  segmented: {
    flexDirection: 'row',
    backgroundColor: colors.bg.card,
    borderRadius: radii.md,
    padding: 3,
    gap: 2,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[2],
    borderRadius: radii.sm,
  },
  segmentActive: { backgroundColor: colors.bg.cardAlt },
  segmentText: { color: colors.text.muted, fontSize: fontSize.sm, fontWeight: '600' },
  segmentTextActive: { color: colors.text.primary },
  formMessage: {
    borderRadius: radii.sm,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    fontSize: fontSize.sm,
    marginBottom: spacing[3],
  },
});
