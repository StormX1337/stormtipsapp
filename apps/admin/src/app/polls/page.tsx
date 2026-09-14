'use client';

import { useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import type { Paginated, PollDTO } from '@profit-tips/types';
import { api } from '@/lib/api';
import {
  Badge,
  Button,
  DataTable,
  ErrorBox,
  Field,
  Modal,
  PageHeader,
  Pagination,
  Select,
  Toggle,
  type Column,
} from '@/components/ui';

export default function PollsPage(): ReactNode {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    question: '',
    description: '',
    kind: 'CUSTOM',
    status: 'ACTIVE',
    allowMultiple: false,
    showResultsBeforeVote: false,
    endsAt: '',
    options: ['', ''],
  });

  const polls = useQuery({
    queryKey: ['admin-polls', page],
    queryFn: () => api<Paginated<PollDTO>>(`/admin/ops/polls?page=${page}&limit=25`),
  });

  const create = useMutation({
    mutationFn: () =>
      api('/admin/ops/polls', {
        method: 'POST',
        body: {
          question: form.question,
          description: form.description || null,
          kind: form.kind,
          status: form.status,
          allowMultiple: form.allowMultiple,
          showResultsBeforeVote: form.showResultsBeforeVote,
          endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
          options: form.options
            .filter((label) => label.trim().length > 0)
            .map((label) => ({ label: label.trim() })),
        },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-polls'] });
      setOpen(false);
      setForm({ ...form, question: '', description: '', options: ['', ''] });
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => api(`/admin/ops/polls/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-polls'] }),
  });

  const columns: Column<PollDTO>[] = [
    {
      key: 'question',
      header: 'Frage',
      render: (poll) => (
        <div>
          <p className="font-medium">{poll.question}</p>
          <p className="text-[11px] text-ink-dim">{poll.options.map((o) => o.label).join(' · ')}</p>
        </div>
      ),
    },
    { key: 'kind', header: 'Art', render: (poll) => <Badge>{poll.kind}</Badge> },
    {
      key: 'status',
      header: 'Status',
      render: (poll) => (
        <Badge tone={poll.status === 'ACTIVE' ? 'positive' : 'neutral'}>{poll.status}</Badge>
      ),
    },
    { key: 'votes', header: 'Stimmen', align: 'right', render: (poll) => poll.totalVotes },
    {
      key: 'ends',
      header: 'Endet',
      render: (poll) => (poll.endsAt ? new Date(poll.endsAt).toLocaleString('de-DE') : '—'),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (poll) => (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            if (window.confirm('Umfrage löschen?')) remove.mutate(poll.id);
          }}
        >
          <Trash2 size={14} aria-hidden />
        </Button>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Umfragen"
        description="Nutzerabstimmungen mit Live-Auswertung."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus size={15} aria-hidden /> Neue Umfrage
          </Button>
        }
      />

      {polls.isError ? <ErrorBox error={polls.error} /> : null}

      <DataTable
        columns={columns}
        rows={polls.data?.items ?? []}
        loading={polls.isPending}
        rowKey={(poll) => poll.id}
      />

      {polls.data ? (
        <Pagination page={polls.data.page} totalPages={polls.data.totalPages} onChange={setPage} />
      ) : null}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Neue Umfrage"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Abbrechen
            </Button>
            <Button
              onClick={() => create.mutate()}
              disabled={
                create.isPending ||
                form.question.length < 4 ||
                form.options.filter((option) => option.trim()).length < 2
              }
            >
              Anlegen
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          {create.isError ? <ErrorBox error={create.error} /> : null}
          <Field
            label="Frage"
            value={form.question}
            onChange={(event) => setForm({ ...form, question: event.target.value })}
          />
          <Field
            label="Beschreibung"
            value={form.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
          />
          <div className="grid gap-3 sm:grid-cols-3">
            <Select
              label="Art"
              value={form.kind}
              onChange={(event) => setForm({ ...form, kind: event.target.value })}
              options={[
                'MATCH_WINNER',
                'GOALS',
                'PLAYER_PERFORMANCE',
                'LEAGUE',
                'BEST_TIP',
                'CUSTOM',
              ].map((value) => ({ value, label: value }))}
            />
            <Select
              label="Status"
              value={form.status}
              onChange={(event) => setForm({ ...form, status: event.target.value })}
              options={['DRAFT', 'ACTIVE', 'CLOSED'].map((value) => ({ value, label: value }))}
            />
            <Field
              label="Endet am"
              type="datetime-local"
              value={form.endsAt}
              onChange={(event) => setForm({ ...form, endsAt: event.target.value })}
            />
          </div>

          <div>
            <span className="label">Antwortoptionen</span>
            <div className="flex flex-col gap-2">
              {form.options.map((option, index) => (
                <input
                  key={index}
                  className="input"
                  value={option}
                  placeholder={`Option ${index + 1}`}
                  onChange={(event) => {
                    const options = [...form.options];
                    options[index] = event.target.value;
                    setForm({ ...form, options });
                  }}
                />
              ))}
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="mt-2"
              disabled={form.options.length >= 10}
              onClick={() => setForm({ ...form, options: [...form.options, ''] })}
            >
              <Plus size={13} aria-hidden /> Option hinzufügen
            </Button>
          </div>

          <div className="flex gap-4">
            <Toggle
              label="Mehrfachauswahl"
              checked={form.allowMultiple}
              onChange={(value) => setForm({ ...form, allowMultiple: value })}
            />
            <Toggle
              label="Ergebnisse vor der Stimmabgabe zeigen"
              checked={form.showResultsBeforeVote}
              onChange={(value) => setForm({ ...form, showResultsBeforeVote: value })}
            />
          </div>
        </div>
      </Modal>
    </>
  );
}
