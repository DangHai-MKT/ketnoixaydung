
import 'dotenv/config';

import { eq, sql } from 'drizzle-orm';
import { db } from '../db/client';
import {
  ledgerEntries,
  ledgerTransactions,
  wallets,
} from '../db/schema/index';

export interface WalletBalance {
  walletId: string;
  unit: 'POINT' | 'VND';
  balance: bigint;
}

/**
 * Returns the posted ledger balance for one wallet.
 * Pending and failed transactions are excluded.
 */
export async function getWalletBalance(
  walletId: string,
): Promise<WalletBalance> {
  const rows = await db
    .select({
      walletId: wallets.id,
      unit: wallets.unit,
      balance: sql<string>`
        COALESCE(
          SUM(
            CASE
              WHEN ${ledgerTransactions.status} = 'posted'
              THEN ${ledgerEntries.amount}
              ELSE 0
            END
          ),
          0
        )::text
      `,
    })
    .from(wallets)
    .leftJoin(
      ledgerEntries,
      eq(ledgerEntries.walletId, wallets.id),
    )
    .leftJoin(
      ledgerTransactions,
      eq(ledgerTransactions.id, ledgerEntries.transactionId),
    )
    .where(eq(wallets.id, walletId))
    .groupBy(wallets.id, wallets.unit)
    .limit(1);

  const wallet = rows[0];

  if (!wallet) {
    throw new Error(`Wallet not found: ${walletId}`);
  }

  return {
    walletId: wallet.walletId,
    unit: wallet.unit,
    balance: BigInt(wallet.balance),
  };
}
