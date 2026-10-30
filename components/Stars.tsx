import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors } from '@/constants/theme';

interface StarsProps {
  /** Current value 0-5 (fractions allowed in display mode). */
  value: number;
  /** When provided, stars are tappable and call back with 1-5. */
  onRate?: (stars: number) => void;
  size?: number;
}

/** Row of 5 stars. Display-only by default; tappable when onRate is set. */
export default function Stars({ value, onRate, size = 22 }: StarsProps) {
  return (
    <View style={styles.row}>
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = value >= star - 0.25;
        const glyph = (
          <Text
            style={[
              styles.star,
              { fontSize: size },
              filled ? styles.filled : styles.empty,
            ]}
          >
            ★
          </Text>
        );
        return onRate ? (
          <Pressable
            key={star}
            onPress={() => onRate(star)}
            hitSlop={6}
            accessibilityLabel={`Rate ${star} stars`}
          >
            {glyph}
          </Pressable>
        ) : (
          <View key={star}>{glyph}</View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  star: { lineHeight: 26 },
  filled: { color: '#fbbf24' },
  empty: { color: Colors.border },
});
