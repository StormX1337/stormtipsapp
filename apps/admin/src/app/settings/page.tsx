'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  Button,
  DataTable,
  ErrorBox,
  Field,
  PageHeader,
  Select,
  Toggle,
  type Column,
} from '@/components/ui';

interface SettingRow {
  key: string;
  value: unknown;
  updatedAt: string;
}

interface ReferralProgram {
  rewardType: string;
  rewardDays: number;
  rewardAmountCents: number;
  minPurchaseCents: number;
  expiresInDays: number;
  isActive: boolean;
}

export default function SettingsPage(): ReactNode {
  const queryClient = useQueryClient();
  const [program, setProgram] = useState<ReferralProgram | null>(null);

  const settings = useQuery({
    queryKey: ['admin-settings'],
    queryFn: () => api<{ items: SettingRow[] }>('/admin/ops/settings'),
  });

  const referral = useQuery({
    queryKey: ['admin-referral-program'],
    queryFn: () => api<ReferralProgram>('/admin/ops/referral-program'),
  });

  useEffect(() => {
    if (referral.data) setProgram(referral.data);
  }, [referral.data]);

  const saveProgram = useMutation({
    mutationFn: () => api('/admin/ops/referral-program', { method: 'PUT', body: program }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-referral-program'] }),
  });

  const columns: Column<SettingRow>[] = [
    { key: 'key', header: 'Schlüssel', render: (row) => <code className="font-mono">{row.key}</code> },
    {
      key: 'value',
      header: 'Wert',
      render: (row) => (
        <pre className="max-w-xl overflow-x-auto text-[11px] text-ink-muted">
          {JSON.stringify(row.value, null, 2)}
        </pre>
      ),
    },
    {
      key: 'updated',
      header: 'Geändert',
      align: 'right',
      render: (row) => new Date(row.updatedAt).toLocaleString('de-DE'),
    },
  ];

  return (
    <>
      <PageHeader title="Einstellungen" description="Plattformweite Konfiguration." />

      <section className="card mb-5 p-4">
        <h2 className="mb-3 text-[14px] font-bold">Empfehlungsprogramm</h2>
        {referral.isError ? <ErrorBox error={referral.error} /> : null}
        {program ? (
          <div className="flex flex-col gap-3">
            <div className="grid gap-3 sm:grid-cols-4">
              <Select
                label="Prämienart"
                value={program.rewardType}
                onChange={(event) => setProgram({ ...program, rewardType: event.target.value })}
                options={['FREE_DAYS', 'CREDIT', 'DISCOUNT_COUPON'].map((value) => ({
                  value,
                  label: value,
                }))}
              />
              <Field
                label="Gratistage"
                type="number"
                min="0"
                value={String(program.rewardDays)}
                onChange={(event) =>
                  setProgram({ ...program, rewardDays: Number(event.target.value) })
                }
              />
              <Field
                label="Guthaben (Cent)"
                type="number"
                min="0"
                value={String(program.rewardAmountCents)}
                onChange={(event) =>
                  setProgram({ ...program, rewardAmountCents: Number(event.target.value) })
                }
              />
              <Field
                label="Mindestkauf (Cent)"
                type="number"
                min="0"
                value={String(program.minPurchaseCents)}
                onChange={(event) =>
                  setProgram({ ...program, minPurchaseCents: Number(event.target.value) })
                }
              />
            </div>
            <div className="flex items-end gap-4">
              <Field
                label="Gültigkeit (Tage)"
                type="number"
                min="1"
                value={String(program.expiresInDays)}
                onChange={(event) =>
                  setProgram({ ...program, expiresInDays: Number(event.target.value) })
                }
              />
              <Toggle
                label="Programm aktiv"
                checked={program.isActive}
                onChange={(value) => setProgram({ ...program, isActive: value })}
              />
              <Button onClick={() => saveProgram.mutate()} disabled={saveProgram.isPending}>
                Speichern
              </Button>
            </div>
            {saveProgram.isError ? <ErrorBox error={saveProgram.error} /> : null}
          </div>
        ) : null}
      </section>

      <h2 className="mb-2 text-[14px] font-bold">Gespeicherte Einstellungen</h2>
      <DataTable
        columns={columns}
        rows={settings.data?.items ?? []}
        loading={settings.isPending}
        rowKey={(row) => row.key}
      />
    </>
  );
}
