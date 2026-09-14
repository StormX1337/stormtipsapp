import type { ReactNode } from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { theme } from '@/lib/theme';

/**
 * Icon set.
 *
 * Drawn in-house with plain SVG geometry so the app ships no third-party icon
 * artwork. Every icon uses a 24×24 view box and inherits colour and size from
 * its props.
 */
export interface IconProps {
  size?: number;
  color?: string;
}

type Icon = (props: IconProps) => ReactNode;

function base({ size = theme.sizes.iconMd, color = theme.colors.text.secondary }: IconProps): {
  width: number;
  height: number;
  stroke: string;
  strokeWidth: number;
  strokeLinecap: 'round';
  strokeLinejoin: 'round';
  fill: 'none';
  viewBox: string;
} {
  return {
    width: size,
    height: size,
    stroke: color,
    strokeWidth: 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    fill: 'none',
    viewBox: '0 0 24 24',
  };
}

export const BallIcon: Icon = (props) => (
  <Svg {...base(props)}>
    <Circle cx="12" cy="12" r="9" />
    <Path d="M12 6.5 15.5 9l-1.3 4h-4.4L8.5 9z" />
    <Path d="M12 3v3.5M4.2 9.4 8.5 9M19.8 9.4 15.5 9M7 19.5l2.8-6.5M17 19.5l-2.8-6.5" />
  </Svg>
);

export const TicketIcon: Icon = (props) => (
  <Svg {...base(props)}>
    <Path d="M3 8.5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v1a2.5 2.5 0 0 0 0 5v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1a2.5 2.5 0 0 0 0-5z" />
    <Path d="M14 7.5v9" />
  </Svg>
);

export const BoltIcon: Icon = (props) => (
  <Svg {...base(props)}>
    <Path d="M13.5 3 5.5 13.5h5L10 21l8.5-10.5h-5z" />
  </Svg>
);

export const CrownIcon: Icon = (props) => (
  <Svg {...base(props)}>
    <Path d="M3.5 7.5 7 12l5-6.5 5 6.5 3.5-4.5-1.5 11h-14z" />
    <Path d="M5 20.5h14" />
  </Svg>
);

export const PollIcon: Icon = (props) => (
  <Svg {...base(props)}>
    <Path d="M5 20V10M12 20V4M19 20v-6" />
    <Path d="M3 20h18" />
  </Svg>
);

export const LockIcon: Icon = (props) => (
  <Svg {...base(props)}>
    <Rect x="4.5" y="10" width="15" height="10.5" rx="2" />
    <Path d="M8 10V7.5a4 4 0 0 1 8 0V10" />
  </Svg>
);

export const ShieldIcon: Icon = (props) => (
  <Svg {...base(props)}>
    <Path d="M12 3 5 5.8v5.4c0 4.3 2.8 8 7 9.8 4.2-1.8 7-5.5 7-9.8V5.8z" />
    <Path d="m9 12 2.2 2.2L15.5 10" />
  </Svg>
);

export const CheckIcon: Icon = (props) => (
  <Svg {...base(props)}>
    <Path d="m4.5 12.5 5 5 10-11" />
  </Svg>
);

export const ChevronLeftIcon: Icon = (props) => (
  <Svg {...base(props)}>
    <Path d="m14.5 5-7 7 7 7" />
  </Svg>
);

export const ChevronRightIcon: Icon = (props) => (
  <Svg {...base(props)}>
    <Path d="m9.5 5 7 7-7 7" />
  </Svg>
);

export const BellIcon: Icon = (props) => (
  <Svg {...base(props)}>
    <Path d="M6 10a6 6 0 0 1 12 0c0 3.2.7 5 1.6 6H4.4C5.3 15 6 13.2 6 10Z" />
    <Path d="M10 19.5a2.2 2.2 0 0 0 4 0" />
  </Svg>
);

export const UserIcon: Icon = (props) => (
  <Svg {...base(props)}>
    <Circle cx="12" cy="8.5" r="3.8" />
    <Path d="M4.8 20.5a7.4 7.4 0 0 1 14.4 0" />
  </Svg>
);

export const ChartIcon: Icon = (props) => (
  <Svg {...base(props)}>
    <Path d="M4 19 9.5 12l3.5 3.5L20 6.5" />
    <Path d="M20 11V6.5h-4.5" />
  </Svg>
);

export const ClockIcon: Icon = (props) => (
  <Svg {...base(props)}>
    <Circle cx="12" cy="12" r="8.5" />
    <Path d="M12 7.5V12l3 1.8" />
  </Svg>
);

export const ShareIcon: Icon = (props) => (
  <Svg {...base(props)}>
    <Path d="M12 3.5v11" />
    <Path d="m8 7 4-3.5L16 7" />
    <Path d="M5.5 13v6a1.5 1.5 0 0 0 1.5 1.5h10a1.5 1.5 0 0 0 1.5-1.5v-6" />
  </Svg>
);

export const CopyIcon: Icon = (props) => (
  <Svg {...base(props)}>
    <Rect x="9" y="9" width="11" height="11" rx="2" />
    <Path d="M15 6.5V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h.5" />
  </Svg>
);

export const CloseIcon: Icon = (props) => (
  <Svg {...base(props)}>
    <Path d="m6 6 12 12M18 6 6 18" />
  </Svg>
);

export const AlertIcon: Icon = (props) => (
  <Svg {...base(props)}>
    <Circle cx="12" cy="12" r="8.5" />
    <Path d="M12 7.5v5.2M12 16.2v.2" />
  </Svg>
);

export const SettingsIcon: Icon = (props) => (
  <Svg {...base(props)}>
    <Circle cx="12" cy="12" r="3.2" />
    <Path d="M12 3.5v2.2M12 18.3v2.2M20.5 12h-2.2M5.7 12H3.5M18 6l-1.6 1.6M7.6 16.4 6 18M18 18l-1.6-1.6M7.6 7.6 6 6" />
  </Svg>
);

export const GiftIcon: Icon = (props) => (
  <Svg {...base(props)}>
    <Rect x="4" y="9.5" width="16" height="11" rx="1.6" />
    <Path d="M3 9.5h18M12 9.5v11" />
    <Path d="M12 9.5C10.5 6 9 4.5 7.6 5.2 6.2 5.9 6.6 8.4 12 9.5Zm0 0c1.5-3.5 3-5 4.4-4.3 1.4.7 1 3.2-4.4 4.3Z" />
  </Svg>
);

/** Product → icon, matching the paywall and tab bar. */
export const PRODUCT_ICON: Record<string, Icon> = {
  FREE: BallIcon,
  COMBO: TicketIcon,
  EXTRA: BoltIcon,
  VIP: CrownIcon,
  FIX_ODDS: ShieldIcon,
};
