import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { Colors, Spacing } from '@/constants/theme';

interface TextFieldProps extends TextInputProps {
  label: string;
  error?: string | null;
}

export default function TextField({ label, error, ...inputProps }: TextFieldProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, !!error && styles.inputError]}
        placeholderTextColor={Colors.muted}
        {...inputProps}
      />
      {!!error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: Spacing.sm },
  label: { color: Colors.text, fontSize: 14, fontWeight: '600', marginBottom: Spacing.xs },
  input: {
    backgroundColor: Colors.surface,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    fontSize: 16,
  },
  inputError: { borderColor: Colors.danger },
  error: { color: Colors.danger, fontSize: 13, marginTop: 4 },
});
