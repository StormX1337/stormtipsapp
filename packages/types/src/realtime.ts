import type { EventDTO, TipDTO, ComboDTO, PollDTO } from './dto.js';

/** Topics a WebSocket client may subscribe to. Premium topics are entitlement-gated. */
export const WS_TOPICS = {
  liveEvents: 'live:events',
  tipsFree: 'tips:FREE',
  tipsVip: 'tips:VIP',
  tipsExtra: 'tips:EXTRA',
  tipsCombo: 'tips:COMBO',
  tipsFixOdds: 'tips:FIX_ODDS',
  polls: 'polls',
  odds: 'odds',
} as const;
export type WsTopic = (typeof WS_TOPICS)[keyof typeof WS_TOPICS];

export type ClientMessage =
  | { type: 'subscribe'; topics: string[] }
  | { type: 'unsubscribe'; topics: string[] }
  | { type: 'ping' }
  | { type: 'auth'; token: string };

export type ServerMessage =
  | { type: 'pong'; at: string }
  | { type: 'subscribed'; topics: string[]; rejected: string[] }
  | { type: 'error'; code: string; message: string }
  | { type: 'event.update'; topic: string; payload: EventDTO }
  | { type: 'tip.published'; topic: string; payload: TipDTO }
  | { type: 'tip.settled'; topic: string; payload: TipDTO }
  | {
      type: 'tip.odds';
      topic: string;
      payload: { tipId: string; currentOdds: number; oddsChanged: boolean };
    }
  | { type: 'combo.published'; topic: string; payload: ComboDTO }
  | { type: 'poll.update'; topic: string; payload: PollDTO };

export interface BroadcastEnvelope {
  topic: string;
  message: ServerMessage;
  /** Optional single-user delivery. */
  userId?: string;
}
