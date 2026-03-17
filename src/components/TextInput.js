import React from 'react';
import { TextInput as RNTextInput, StyleSheet } from 'react-native';
import { colors, spacing, borderRadius } from '../config/theme';

export default function TextInput({ style, ...props }) {
  return (
    <RNTextInput
      style={[styles.input, style]}
      placeholderTextColor={colors.gray}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderColor: colors.lightGray,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: 16,
    backgroundColor: colors.white,
    minHeight: 56,
  },
});
