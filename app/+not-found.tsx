import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { type Palette } from '@/constants/theme';
import { useThemedStyles } from '@/lib/ThemeContext';

export default function NotFoundScreen() {
  const styles = useThemedStyles(makeStyles);
  return (
    <>
      <Stack.Screen options={{ title: 'Error' }} />
      <View style={styles.container}>
        <Text style={styles.title}>This page does not exist.</Text>

        <Link href="/" style={styles.link}>
          <Text style={styles.linkText}>Back to home</Text>
        </Link>
      </View>
    </>
  );
}

const makeStyles = (Colors: Palette) =>
  StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: Colors.background,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
  },
  link: {
    marginTop: 15,
    paddingVertical: 15,
  },
  linkText: {
    fontSize: 14,
    color: Colors.primary,
  },
});
