import React from 'react';
import Svg, { Path } from 'react-native-svg';

// Path data taken verbatim from Google's Material Symbols Outlined set
// (wght400 / FILL0 / GRAD0 / opsz24, https://fonts.google.com/icons), which is
// Apache-2.0 licensed and safe to embed directly as vector paths. Keeping them
// here avoids pulling in a font/icon-font linking step for five icons.
const ICON_PATHS: Record<TabBarIconName, string> = {
  dashboard:
    'M510-570v-270h330v270H510ZM120-450v-390h330v390H120Zm390 330v-390h330v390H510Zm-390 0v-270h330v270H120Zm60-390h210v-270H180v270Zm390 330h210v-270H570v270Zm0-450h210v-150H570v150ZM180-180h210v-150H180v150Zm210-330Zm180-120Zm0 180ZM390-330Z',
  meeting_room:
    'M120-120v-60h92v-660h390v45h147v615h91v60H689v-615h-87v615H120Zm152-660v600-600Zm207.5 328.5Q491-463 491-480t-11.5-28.5Q468-520 451-520t-28.5 11.5Q411-497 411-480t11.5 28.5Q434-440 451-440t28.5-11.5ZM272-180h270v-600H272v600Z',
  receipt_long:
    'M222-80q-43.75 0-74.37-30.63Q117-141.25 117-185v-125h127v-570l59.8 60 59.8-60 59.8 60 59.8-60 59.8 60 60-60 60 60 60-60 60 60 60-60v695q0 43.75-30.62 74.37Q781.75-80 738-80H222Zm516-60q20 0 32.5-12.5T783-185v-595H304v470h389v125q0 20 12.5 32.5T738-140ZM357-622v-60h240v60H357Zm0 134v-60h240v60H357Zm333-134q-12 0-21-9t-9-21q0-12 9-21t21-9q12 0 21 9t9 21q0 12-9 21t-21 9Zm0 129q-12 0-21-9t-9-21q0-12 9-21t21-9q12 0 21 9t9 21q0 12-9 21t-21 9ZM221-140h412v-110H177v65q0 20 12.65 32.5T221-140Zm-44 0v-110 110Z',
  inventory_2:
    'M180-80q-24.75 0-42.37-17.63Q120-115.25 120-140v-483q-17-6-28.5-21.39T80-680v-140q0-24.75 17.63-42.38Q115.25-880 140-880h680q24.75 0 42.38 17.62Q880-844.75 880-820v140q0 20.22-11.5 35.61T840-623v483q0 24.75-17.62 42.37Q804.75-80 780-80H180Zm0-540v480h600v-480H180Zm-40-60h680v-140H140v140Zm220 260h240v-60H360v60Zm120 40Z',
  more_horiz:
    'M207.86-432Q188-432 174-446.14t-14-34Q160-500 174.14-514t34-14Q228-528 242-513.86t14 34Q256-460 241.86-446t-34 14Zm272 0Q460-432 446-446.14t-14-34Q432-500 446.14-514t34-14Q500-528 514-513.86t14 34Q528-460 513.86-446t-34 14Zm272 0Q732-432 718-446.14t-14-34Q704-500 718.14-514t34-14Q772-528 786-513.86t14 34Q800-460 785.86-446t-34 14Z',
};

export type TabBarIconName =
  | 'dashboard'
  | 'meeting_room'
  | 'receipt_long'
  | 'inventory_2'
  | 'more_horiz';

const DEFAULT_SIZE = 24;

interface TabBarIconProps {
  name: TabBarIconName;
  color: string;
  size?: number;
}

// Renders a single Material Symbols Outlined glyph at the requested size/tint,
// matching the 24px / wght400 / opsz24 reference used across the GetPass tab bar.
export function TabBarIcon({ name, color, size = DEFAULT_SIZE }: TabBarIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 -960 960 960" fill={color}>
      <Path d={ICON_PATHS[name]} />
    </Svg>
  );
}
