import type { FastifyInstance } from 'fastify';
import { prisma } from '@storm-tips/database';
import { AppError, idParamSchema, paginationSchema, voteSchema } from '@storm-tips/types';
import { parseBody, parseParams, parseQuery } from '../lib/validate.js';
import { assertFound, noStore, paginate, skipTake } from '../lib/http.js';
import { pollInclude, serializePoll } from '../serializers/poll.js';
import { broadcast } from '../ws/gateway.js';
import { WS_TOPICS } from '@storm-tips/types';

export async function pollRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', app.optionalAuth);

  app.get('/', async (request, reply) => {
    const query = parseQuery(request, paginationSchema);
    const { skip, take } = skipTake(query);
    const where = { status: { in: ['ACTIVE', 'CLOSED'] as never } };

    const [polls, total] = await Promise.all([
      prisma.poll.findMany({
        where,
        include: pollInclude,
        orderBy: [{ status: 'asc' }, { startsAt: 'desc' }],
        skip,
        take,
      }),
      prisma.poll.count({ where }),
    ]);

    const myVotes = request.auth
      ? await prisma.pollVote.findMany({
          where: { userId: request.auth.userId, pollId: { in: polls.map((poll) => poll.id) } },
          select: { pollId: true, optionId: true },
        })
      : [];

    noStore(reply);
    return paginate(
      polls.map((poll) =>
        serializePoll(
          poll,
          myVotes.filter((vote) => vote.pollId === poll.id).map((vote) => vote.optionId),
        ),
      ),
      total,
      query,
    );
  });

  app.get('/:id', async (request, reply) => {
    const { id } = parseParams(request, idParamSchema);
    const poll = assertFound(
      await prisma.poll.findUnique({ where: { id }, include: pollInclude }),
      'Poll',
    );
    const myVotes = request.auth
      ? await prisma.pollVote.findMany({
          where: { userId: request.auth.userId, pollId: id },
          select: { optionId: true },
        })
      : [];
    noStore(reply);
    return serializePoll(
      poll,
      myVotes.map((vote) => vote.optionId),
    );
  });

  app.post('/:id/vote', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = parseParams(request, idParamSchema);
    const { optionIds } = parseBody(request, voteSchema);
    const userId = request.auth!.userId;

    const poll = assertFound(
      await prisma.poll.findUnique({ where: { id }, include: pollInclude }),
      'Poll',
    );
    if (poll.status !== 'ACTIVE') throw AppError.validation('This poll is closed');
    if (poll.endsAt && poll.endsAt.getTime() < Date.now()) {
      throw AppError.validation('This poll is closed');
    }
    if (!poll.allowMultiple && optionIds.length > 1) {
      throw AppError.validation('This poll accepts a single answer');
    }

    const validOptionIds = new Set(poll.options.map((option) => option.id));
    if (optionIds.some((optionId) => !validOptionIds.has(optionId))) {
      throw AppError.validation('Unknown option for this poll');
    }

    const existing = await prisma.pollVote.findMany({ where: { pollId: id, userId } });
    if (existing.length > 0 && !poll.allowMultiple) {
      throw AppError.conflict('You have already voted in this poll');
    }

    // Vote + counter update in one transaction so the tallies can never drift.
    await prisma.$transaction(async (tx) => {
      for (const optionId of optionIds) {
        await tx.pollVote.create({ data: { pollId: id, optionId, userId } });
        await tx.pollOption.update({
          where: { id: optionId },
          data: { voteCount: { increment: 1 } },
        });
      }
      await tx.poll.update({
        where: { id },
        data: { totalVotes: { increment: optionIds.length } },
      });
    });

    const updated = await prisma.poll.findUniqueOrThrow({ where: { id }, include: pollInclude });
    const dto = serializePoll(updated, optionIds);
    await broadcast({
      topic: WS_TOPICS.polls,
      message: { type: 'poll.update', topic: WS_TOPICS.polls, payload: dto },
    });

    noStore(reply).status(201);
    return dto;
  });
}
