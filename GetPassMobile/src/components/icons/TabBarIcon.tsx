import React from 'react';
import Svg, { Path, Rect } from 'react-native-svg';

// Path data taken verbatim from Google's Material Symbols Outlined set
// (wght400 / FILL0 / GRAD0 / opsz24, https://fonts.google.com/icons), which is
// Apache-2.0 licensed and safe to embed directly as vector paths. Keeping them
// here avoids pulling in a font/icon-font linking step for five icons.
const ICON_PATHS: Record<Exclude<TabBarIconName, 'qr_code_scanner'>, string> = {
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
  logout:
    'M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h280v80H200v560h280v80H200Zm440-160-56-58 102-102H360v-80h326L584-622l56-58 200 200-200 200Z',
  balance:
    'M480-80q-17 0-28.5-11.5T440-120v-360H260q-17 0-28.5-11.5T220-520q0-7 1.5-14t5.5-13l95-165q7-12 19-19t26-7h113v-40q0-17 11.5-28.5T520-818q17 0 28.5 11.5T560-778v40h113q14 0 26 7t19 19l95 165q4 6 5.5 13t1.5 14q0 17-11.5 28.5T780-480H520v360q0 17-11.5 28.5T480-80ZM280-560h160l-80-140-80 140Zm240 0h160l-80-140-80 140Z',
  verified_user:
    'M480-80q-138-34-229-158T160-520v-280l320-120 320 120v280q0 158-91 282T480-80Zm-42-222 226-226-56-56-170 170-86-86-56 56 142 142Z',
  group:
    'M40-160v-112q0-34 17.5-62.5T104-378q62-31 126-46.5T360-440q66 0 130 15.5T616-378q29 15 46.5 43.5T680-272v112H40Zm720 0v-120q0-44-24.5-84T668-426q36 8 68 20t60 28q31 18 47.5 50.5T860-256v96H760ZM360-480q-66 0-113-47t-47-113q0-66 47-113t113-47q66 0 113 47t47 113q0 66-47 113t-113 47Zm400-160q0 66-47 113t-113 47q-17 0-35-4t-33-11q44-51 44-118t-44-118q15-7 33-11t35-4q66 0 113 47t47 113Z',
  account_circle:
    'M480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q53 0 100-17t86-49q-39-29-86-46.5T480-290q-53 0-100 17.5T294-226q39 32 86 49t100 17Zm0-210q50 0 85-35t35-85q0-50-35-85t-85-35q-50 0-85 35t-35 85q0 50 35 85t85 35Zm0-50q-29 0-50-21t-21-50q0-29 21-50t50-21q29 0 50 21t21 50q0 29-21 50t-50 21Zm0 170q69 0 128 25t106 66q47-50 76.5-117T820-480q0-142-99-241t-241-99q-142 0-241 99t-99 241q0 77 29.5 144T245-219q47-41 106-66t129-25Zm0-310Zm0 406Z',
  settings:
    'M480-80q-17 0-30-11t-16-28l-8-56q-17-5-34-15t-30-22l-52 20q-16 6-32-1t-25-22l-46-80q-9-16-5-33t18-28l45-35q-3-18-3-37t3-37l-45-35q-14-11-18-28t5-33l46-80q9-15 25-22t32-1l52 20q13-12 30-22t34-15l8-56q3-17 16-28t30-11h92q17 0 30 11t16 28l8 56q17 5 34 15t30 22l52-20q16-6 32 1t25 22l46 80q9 16 5 33t-18 28l-45 35q3 18 3 37t-3 37l45 35q14 11 18 28t-5 33l-46 80q-9 15-25 22t-32 1l-52-20q-13 12-30 22t-34 15l-8 56q-3 17-16 28t-30 11h-92Zm46-270q50 0 85-35t35-85q0-50-35-85t-85-35q-50 0-85 35t-35 85q0 50 35 85t85 35Z',
};

export type TabBarIconName =
  | 'dashboard'
  | 'meeting_room'
  | 'receipt_long'
  | 'inventory_2'
  | 'more_horiz'
  | 'logout'
  | 'balance'
  | 'verified_user'
  | 'group'
  | 'account_circle'
  | 'settings'
  | 'qr_code_scanner';

const DEFAULT_SIZE = 24;

interface TabBarIconProps {
  name: TabBarIconName;
  color: string;
  size?: number;
}

// Renders a single Material Symbols Outlined glyph at the requested size/tint,
// matching the 24px / wght400 / opsz24 reference used across the GetPass tab bar.
export function TabBarIcon({ name, color, size = DEFAULT_SIZE }: TabBarIconProps) {
  if (name === 'qr_code_scanner') return <QrScannerGlyph color={color} size={size} />;
  return (
    <Svg width={size} height={size} viewBox="0 -960 960 960" fill={color}>
      <Path d={ICON_PATHS[name]} />
    </Svg>
  );
}

// A simple QR-frame glyph (three corner markers + a scan line), drawn with
// basic shapes rather than a Material Symbols path, since this app doesn't
// otherwise need that icon set's exact "qr_code_scanner" artwork.
function QrScannerGlyph({ color, size }: { color: string; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M3 8V5a2 2 0 0 1 2-2h3" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Path d="M21 8V5a2 2 0 0 0-2-2h-3" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Path d="M3 16v3a2 2 0 0 0 2 2h3" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Path d="M21 16v3a2 2 0 0 1-2 2h-3" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Rect x={7} y={7} width={3} height={3} fill={color} />
      <Rect x={14} y={7} width={3} height={3} fill={color} />
      <Rect x={7} y={14} width={3} height={3} fill={color} />
      <Rect x={2} y={11.25} width={20} height={1.5} fill={color} />
    </Svg>
  );
}
