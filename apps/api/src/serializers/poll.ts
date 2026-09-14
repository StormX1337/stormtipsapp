import type { Prisma } from '@storm-tips/database';
import type { PollDTO, PollOptionDTO } from '@storm-tips/types';
import { eventInclude, serializeEvent } from './catalogue.js';
import { iso } from './common.js';

export const pollInclude = {
  options: { orderBy: { sortOrder: 'asc' } },
  event: { include: eventInclude },
} satisfies Prisma.PollInclude;

export type PollWithRelations = Prisma.PollGetPayload<{ include: typeof pollInclude }>;

export function serializePoll(poll: PollWithRelations, myOptionIds: string[] = []): PollDTO {
  const total = poll.options.reduce((sum, option) => sum + option.voteCount, 0);
  const hasVoted = myOptionIds.length > 0;
  const showResults = hasVoted || poll.showResultsBeforeVote || poll.status === 'CLOSED';

  const options: PollOptionDTO[] = poll.options.map((option) => ({
    id: option.id,
    label: option.label,
    imageUrl: option.imageUrl,
    voteCount: showResults ? option.voteCount : 0,
    percentage: showResults && total > 0 ? Math.round((option.voteCount / total) * 1000) / 10 : 0,
    isMyVote: myOptionIds.includes(option.id),
  }));
  return {
    id: poll.id,
    question: poll.question,
    description: poll.description,
    kind: poll.kind,
    status: poll.status,
    imageUrl: poll.imageUrl,
    allowMultiple: poll.allowMultiple,
    totalVotes: total,
    hasVoted,
    showResults,
    startsAt: poll.startsAt.toISOString(),
    endsAt: iso(poll.endsAt),
    event: poll.event ? serializeEvent(poll.event) : null,
    options,
  };
}
