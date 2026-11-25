import React from 'react';
import {
  Text as NativeText,
  TextInput as NativeTextInput,
  TextInputProps,
  TextProps,
} from 'react-native';
import { useLanguage } from '../i18n/LanguageContext';

function translateChildren(children: React.ReactNode, translate: (text: string) => string): React.ReactNode {
  if (typeof children === 'string') return translate(children);
  if (Array.isArray(children)) return children.map(child => translateChildren(child, translate));
  return children;
}

export function Text(props: TextProps) {
  const { t } = useLanguage();
  return (
    <NativeText
      {...props}
      accessibilityLabel={props.accessibilityLabel ? t(props.accessibilityLabel) : undefined}
    >
      {translateChildren(props.children, t)}
    </NativeText>
  );
}

export function TextInput(props: TextInputProps) {
  const { t } = useLanguage();
  return (
    <NativeTextInput
      {...props}
      accessibilityLabel={props.accessibilityLabel ? t(props.accessibilityLabel) : undefined}
      placeholder={props.placeholder ? t(props.placeholder) : undefined}
    />
  );
}
