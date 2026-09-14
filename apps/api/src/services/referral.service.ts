import { prisma } from '@storm-tips/database';
import { referralProgramSchema, type ReferralProgramConfig } from '@storm-tips/types';
import { maskEmail } from '@storm-tips/ui';
import type { ReferralSummaryDTO } from '@storm-tips/types';
import { env } from '../lib/env.js';
import { money } from '../serializers/common.js';
import { entitlements } from './entitlement.service.js';
import { logger } from '../lib/logger.js';

const SETTINGS_KEY = 'referral_program';

const DEFAULT_PROGRAM: ReferralProgramConfig = referralProgramSchema.parse({});

export class ReferralService {
  async program(): Promise<ReferralProgramConfig> {
    const row = await prisma.appSetting.findUnique({ where: { key: SETTINGS_KEY } });
    if (!row) return DEFAULT_PROGRAM;
    const parsed = referralProgramSchema.safeParse(row.value);
    return parsed.success ? parsed.data : DEFAULT_PROGRAM;
  }

  async saveProgram(config: ReferralProgramConfig): Promise<ReferralProgramConfig> {
    await prisma.appSetting.upsert({
      where: { key: SETTINGS_KEY },
      create: { key: SETTINGS_KEY, value: config as never },
      update: { value: config as never },
    });
    return config;
  }

  async summary(userId: string, locale = 'de'): Promise<ReferralSummaryDTO> {
    const [user, referrals, rewards, program] = await Promise.all([
      prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { referralCode: true } }),
      prisma.referral.findMany({ where: { referrerId: userId } }),
      prisma.referralReward.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }),
      this.program(),
    ]);

    return {
      code: user.referralCode,
      link: `${env.WEB_PUBLIC_URL}/r/${user.referralCode}`,
      totalReferrals: referrals.length,
      qualifiedReferrals: referrals.filter(
        (r) => r.status === 'QUALIFIED' || r.status === 'REWARDED',
      ).length,
      rewardedReferrals: referrals.filter((r) => r.status === 'REWARDED').length,
      pendingReferrals: referrals.filter((r) => r.status === 'PENDING').length,
      rewards: rewards.map((reward) => ({
        id: reward.id,
        type: reward.type,
        status: reward.status,
        days: reward.days,
        amount: reward.amountCents
          ? money(reward.amountCents, reward.currency ?? 'EUR', locale)
          : null,
        grantedAt: reward.grantedAt?.toISOString() ?? null,
      })),
      program: {
        rewardType: program.rewardType,
        rewardDays: program.rewardDays,
        rewardAmountCents: program.rewardAmountCents,
        minPurchaseCents: program.minPurchaseCents,
        expiresInDays: program.expiresInDays,
      },
    };
  }

  async list(userId: string) {
    const referrals = await prisma.referral.findMany({
      where: { referrerId: userId },
      include: { referee: { select: { email: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return referrals.map((referral) => ({
      id: referral.id,
      status: referral.status,
      refereeMasked: maskEmail(referral.referee.email),
      createdAt: referral.createdAt.toISOString(),
      qualifiedAt: referral.qualifiedAt?.toISOString() ?? null,
    }));
  }

  /**
   * Called after a successful payment: qualifies the referral and grants the
   * reward to the referrer. Idempotent — a referral is only rewarded once.
   */
  async qualify(refereeId: string, paymentAmountCents: number): Promise<void> {
    const program = await this.program();
    if (!program.isActive) return;
    if (paymentAmountCents < program.minPurchaseCents) return;

    const referral = await prisma.referral.findUnique({ where: { refereeId } });
    if (!referral || referral.status === 'REWARDED') return;

    await prisma.referral.update({
      where: { id: referral.id },
      data: { status: 'REWARDED', qualifiedAt: new Date(), rewardedAt: new Date() },
    });

    const reward = await prisma.referralReward.create({
      data: {
        referralId: referral.id,
        userId: referral.referrerId,
        type: program.rewardType,
        status: 'GRANTED',
        days: program.rewardType === 'FREE_DAYS' ? program.rewardDays : null,
        amountCents: program.rewardType === 'CREDIT' ? program.rewardAmountCents : null,
        currency: env.DEFAULT_CURRENCY,
        grantedAt: new Date(),
        expiresAt: new Date(Date.now() + program.expiresInDays * 86_400_000),
      },
    });

    if (program.rewardType === 'FREE_DAYS' && program.rewardDays > 0) {
      await entitlements.grant(referral.referrerId, 'VIP', {
        expiresAt: new Date(Date.now() + program.rewardDays * 86_400_000),
        source: 'REFERRAL_REWARD',
        note: `Referral reward ${reward.id}`,
      });
    }

    logger.info({ referralId: referral.id, rewardId: reward.id }, 'referral rewarded');
  }
}

export const referrals = new ReferralService();
