/**
 * Sets the password of an existing account.
 *
 *   pnpm --filter @storm-tips/database set-password <email> <password>
 *
 * Operator tool for local and staging databases: the seed only writes its
 * accounts on a fresh run, so this is how an existing login is recovered
 * without wiping data. The password is hashed with the same KDF the API
 * uses — no plaintext ever reaches the database.
 */
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '@storm-tips/auth';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const [email, password] = process.argv.slice(2);
  if (!email || !password) {
    console.error('usage: set-password <email> <password>');
    process.exitCode = 1;
    return;
  }

  const normalised = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email: normalised },
    select: { id: true, role: true, status: true, deletedAt: true },
  });

  if (!user) {
    const known = await prisma.user.findMany({
      where: { role: { in: ['ADMIN', 'SUPER_ADMIN', 'MODERATOR'] } },
      select: { email: true, role: true },
      orderBy: { createdAt: 'asc' },
    });
    console.error(`No account with the address ${normalised}.`);
    if (known.length > 0) {
      console.error('Staff accounts in this database:');
      for (const row of known) console.error(`  · ${row.email} (${row.role})`);
    }
    process.exitCode = 1;
    return;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(password), emailVerifiedAt: new Date() },
  });

  console.log(`Password updated for ${normalised} (${user.role}, status ${user.status}).`);
  if (user.deletedAt) console.warn('Note: this account is soft-deleted and cannot sign in.');
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
