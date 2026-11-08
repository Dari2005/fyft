import { useEffect, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { Colors, Spacing } from '@/constants/theme';

/** Placeholder card shown while events load (gently pulsing). */
export default function SkeletonCard() {
  const [opacity] = useState(() => new Animated.Value(0.5));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.5, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <View style={styles.card}>
      <Animated.View style={{ opacity, gap: 9 }}>
        <View style={[styles.bar, { width: '38%', height: 10 }]} />
        <View style={[styles.bar, { width: '72%', height: 16 }]} />
        <View style={[styles.bar, { width: '50%', height: 10 }]} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  bar: { backgroundColor: Colors.surfaceHigh, borderRadius: 6 },
});
