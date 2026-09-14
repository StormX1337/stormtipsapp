'use client';

import { useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, RefreshCw } from 'lucide-react';
import type { EventDTO, LeagueDTO, OddDTO, Paginated, TeamDTO } from '@storm-tips/types';
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
  type Column,
} from '@/components/ui';

/** A fixture with no provider id was typed in here and no sync will settle it. */
type AdminEventRow = EventDTO & { isManual: boolean };

interface FixtureForm {
  leagueId: string;
  homeTeamName: string;
  awayTeamName: string;
  /** `datetime-local` value — local wall time, converted to UTC on submit. */
  startsAt: string;
  venue: string;
  round: string;
}

const BLANK_FIXTURE: FixtureForm = {
  leagueId: '',
  homeTeamName: '',
  awayTeamName: '',
  startsAt: '',
  venue: '',
  round: '',
};

export default function EventsPage(): ReactNode {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<AdminEventRow | null>(null);
  const [oddsFor, setOddsFor] = useState<AdminEventRow | null>(null);
  const [result, setResult] = useState({ homeScore: '', awayScore: '', status: 'FINISHED' });
  const [fixture, setFixture] = useState<FixtureForm | null>(null);

  const events = useQuery({
    queryKey: ['admin-catalogue-events', page],
    queryFn: () => api<Paginated<AdminEventRow>>(`/admin/catalogue/events?page=${page}&limit=25`),
  });

  const leagues = useQuery({
    queryKey: ['admin-leagues-for-fixture'],
    queryFn: () => api<Paginated<LeagueDTO>>('/admin/catalogue/leagues?page=1&limit=100'),
    enabled: Boolean(fixture),
  });

  /**
   * Suggestions only. The name is sent as typed, and the API matches an
   * existing team in the league's sport before it creates one — so picking from
   * the list and typing the same name by hand end in the same place.
   */
  const teams = useQuery({
    queryKey: ['admin-teams-for-fixture', fixture?.leagueId],
    queryFn: () =>
      api<Paginated<TeamDTO>>(
        `/admin/catalogue/teams?page=1&limit=100&leagueId=${fixture?.leagueId ?? ''}`,
      ),
    enabled: Boolean(fixture?.leagueId),
  });

  const createFixture = useMutation({
    mutationFn: () =>
      api('/admin/catalogue/events', {
        method: 'POST',
        body: {
          leagueId: fixture?.leagueId,
          homeTeamName: fixture?.homeTeamName.trim(),
          awayTeamName: fixture?.awayTeamName.trim(),
          // The picker reads local wall time; the API stores UTC.
          startsAt: new Date(fixture?.startsAt ?? '').toISOString(),
          venue: fixture?.venue.trim() || null,
          round: fixture?.round.trim() || null,
        },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-catalogue-events'] });
      setFixture(null);
    },
  });

  const odds = useQuery({
    queryKey: ['admin-odds', oddsFor?.id],
    queryFn: () => api<{ items: OddDTO[] }>(`/odds?eventId=${oddsFor?.id}`),
    enabled: Boolean(oddsFor),
  });

  const saveResult = useMutation({
    mutationFn: () =>
      api(`/admin/catalogue/events/${editing?.id}/result`, {
        method: 'PATCH',
        body: {
          homeScore: Number(result.homeScore),
          awayScore: Number(result.awayScore),
          status: result.status,
        },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-catalogue-events'] });
      setEditing(null);
    },
  });

  const resync = useMutation({
    mutationFn: (kind: string) => api(`/admin/ops/providers/sync/${kind}`, { method: 'POST' }),
  });

  const columns: Column<AdminEventRow>[] = [
    {
      key: 'match',
      header: 'Fixture',
      render: (event) => (
        <div>
          <p className="font-medium">
            {event.homeTeam.name} – {event.awayTeam.name}
          </p>
          <p className="text-[11px] text-ink-dim">
            {event.league.name}
            {event.isManual ? ' · entered by hand' : null}
          </p>
        </div>
      ),
    },
    {
      key: 'kickoff',
      header: 'Kick-off',
      render: (event) => new Date(event.startsAt).toLocaleString('en-GB'),
    },
    {
      key: 'status',
      header: 'Status',
      render: (event) => (
        <Badge
          tone={
            event.status === 'FINISHED'
              ? 'positive'
              : event.status === 'LIVE' || event.status === 'HALFTIME'
                ? 'info'
                : 'neutral'
          }
        >
          {event.status}
        </Badge>
      ),
    },
    {
      key: 'score',
      header: 'Score',
      align: 'center',
      render: (event) =>
        event.homeScore === null ? (
          <span className="text-ink-dim">—</span>
        ) : (
          <span className="tabular font-bold">
            {event.homeScore} : {event.awayScore}
          </span>
        ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (event) => (
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="ghost" onClick={() => setOddsFor(event)}>
            Odds
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setEditing(event);
              setResult({
                homeScore: String(event.homeScore ?? ''),
                awayScore: String(event.awayScore ?? ''),
                status: 'FINISHED',
              });
            }}
          >
            <Pencil size={14} aria-hidden />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Events & odds"
        description="Fixtures from the data provider, plus any entered by hand for matches it does not carry. A manual correction re-settles every tip it affects."
        actions={
          <>
            <Button onClick={() => setFixture(BLANK_FIXTURE)}>
              <Plus size={14} aria-hidden /> Add fixture
            </Button>
            <Button variant="outline" onClick={() => resync.mutate('fixtures')}>
              <RefreshCw size={14} aria-hidden /> Fixtures
            </Button>
            <Button variant="outline" onClick={() => resync.mutate('odds')}>
              <RefreshCw size={14} aria-hidden /> Odds
            </Button>
            <Button variant="outline" onClick={() => resync.mutate('results')}>
              <RefreshCw size={14} aria-hidden /> Results
            </Button>
          </>
        }
      />

      {events.isError ? <ErrorBox error={events.error} /> : null}
      {resync.isSuccess ? (
        <p className="mb-3 rounded-sm bg-accent-500/10 px-3 py-2 text-[12px] text-accent-300">
          Sync queued — the worker will run it shortly.
        </p>
      ) : null}

      <DataTable
        columns={columns}
        rows={events.data?.items ?? []}
        loading={events.isPending}
        rowKey={(event) => event.id}
      />

      {events.data ? (
        <Pagination
          page={events.data.page}
          totalPages={events.data.totalPages}
          onChange={setPage}
        />
      ) : null}

      <Modal
        open={Boolean(fixture)}
        onClose={() => setFixture(null)}
        title="Add a fixture"
        footer={
          <>
            <Button variant="ghost" onClick={() => setFixture(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => createFixture.mutate()}
              disabled={
                createFixture.isPending ||
                !fixture?.leagueId ||
                !fixture.homeTeamName.trim() ||
                !fixture.awayTeamName.trim() ||
                !fixture.startsAt
              }
            >
              Create
            </Button>
          </>
        }
      >
        {fixture ? (
          <div className="flex flex-col gap-3">
            {createFixture.isError ? <ErrorBox error={createFixture.error} /> : null}
            <p className="text-[12px] text-ink-muted">
              For a match the data provider does not carry. Nothing will sync its odds or its
              result, so enter the score here once it is played.
            </p>

            <Select
              label="League"
              value={fixture.leagueId}
              onChange={(event) =>
                setFixture({
                  ...fixture,
                  leagueId: event.target.value,
                  // Team suggestions belong to the league, so they start over.
                  homeTeamName: '',
                  awayTeamName: '',
                })
              }
              options={[
                { value: '', label: 'Choose a league…' },
                ...(leagues.data?.items ?? []).map((league) => ({
                  value: league.id,
                  label: league.country ? `${league.country.name} · ${league.name}` : league.name,
                })),
              ]}
              hint={
                leagues.data && leagues.data.total > leagues.data.items.length
                  ? `Showing the first ${leagues.data.items.length} of ${leagues.data.total} leagues, highest priority first.`
                  : undefined
              }
            />

            <datalist id="fixture-teams">
              {(teams.data?.items ?? []).map((team) => (
                <option key={team.id} value={team.name} />
              ))}
            </datalist>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="Home team"
                list="fixture-teams"
                disabled={!fixture.leagueId}
                value={fixture.homeTeamName}
                onChange={(event) => setFixture({ ...fixture, homeTeamName: event.target.value })}
                hint="Pick one from the league, or type a name to add it."
              />
              <Field
                label="Away team"
                list="fixture-teams"
                disabled={!fixture.leagueId}
                value={fixture.awayTeamName}
                onChange={(event) => setFixture({ ...fixture, awayTeamName: event.target.value })}
              />
            </div>

            <Field
              label="Kick-off"
              type="datetime-local"
              value={fixture.startsAt}
              onChange={(event) => setFixture({ ...fixture, startsAt: event.target.value })}
              hint="Your local time."
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="Venue"
                value={fixture.venue}
                onChange={(event) => setFixture({ ...fixture, venue: event.target.value })}
              />
              <Field
                label="Round"
                value={fixture.round}
                onChange={(event) => setFixture({ ...fixture, round: event.target.value })}
                placeholder="Matchday 7"
              />
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title="Correct the result"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={() => saveResult.mutate()} disabled={saveResult.isPending}>
              Save
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          {saveResult.isError ? <ErrorBox error={saveResult.error} /> : null}
          <p className="text-[12.5px] text-ink-muted">
            {editing?.homeTeam.name} – {editing?.awayTeam.name}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Home goals"
              type="number"
              min="0"
              value={result.homeScore}
              onChange={(event) => setResult({ ...result, homeScore: event.target.value })}
            />
            <Field
              label="Away goals"
              type="number"
              min="0"
              value={result.awayScore}
              onChange={(event) => setResult({ ...result, awayScore: event.target.value })}
            />
          </div>
          <Select
            label="Status"
            value={result.status}
            onChange={(event) => setResult({ ...result, status: event.target.value })}
            options={['FINISHED', 'CANCELLED', 'POSTPONED', 'ABANDONED'].map((value) => ({
              value,
              label: value,
            }))}
          />
        </div>
      </Modal>

      <Modal
        open={Boolean(oddsFor)}
        onClose={() => setOddsFor(null)}
        wide
        title={`Odds: ${oddsFor?.homeTeam.name ?? ''} – ${oddsFor?.awayTeam.name ?? ''}`}
      >
        <DataTable
          columns={[
            { key: 'book', header: 'Bookmaker', render: (row: OddDTO) => row.bookmaker.name },
            { key: 'market', header: 'Market', render: (row: OddDTO) => row.marketType },
            {
              key: 'selection',
              header: 'Selection',
              render: (row: OddDTO) => `${row.selection}${row.line ? ` ${row.line}` : ''}`,
            },
            {
              key: 'open',
              header: 'Opening',
              align: 'right',
              render: (row: OddDTO) => (
                <span className="tabular">{row.openingPrice.toFixed(2)}</span>
              ),
            },
            {
              key: 'price',
              header: 'Current',
              align: 'right',
              render: (row: OddDTO) => (
                <span className="tabular font-bold">{row.price.toFixed(2)}</span>
              ),
            },
            {
              key: 'movement',
              header: 'Movement',
              render: (row: OddDTO) => (
                <Badge
                  tone={
                    row.movement.includes('UP')
                      ? 'positive'
                      : row.movement.includes('DOWN')
                        ? 'negative'
                        : 'neutral'
                  }
                >
                  {row.movement}
                </Badge>
              ),
            },
          ]}
          rows={odds.data?.items ?? []}
          loading={odds.isPending}
          rowKey={(row) => row.id}
          empty="No odds stored"
        />
      </Modal>
    </>
  );
}
