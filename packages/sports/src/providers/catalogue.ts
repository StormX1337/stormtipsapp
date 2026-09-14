/**
 * Static reference catalogue used by the mock provider and by the database seed.
 *
 * Contains factual league/team names only — no logos, crests or other protected
 * assets are bundled. The UI renders a coloured monogram when `logoUrl` is null.
 */

export interface CatalogueTeam {
  name: string;
  shortName: string;
  code: string;
  color: string;
}

export interface CatalogueLeague {
  key: string;
  name: string;
  shortName: string;
  sportKey: string;
  countryCode: string;
  tier: number;
  priority: number;
  teams: CatalogueTeam[];
}

export const CATALOGUE_SPORTS = [
  { key: 'football', name: 'Football', icon: 'soccer' },
  { key: 'tennis', name: 'Tennis', icon: 'tennis' },
  { key: 'basketball', name: 'Basketball', icon: 'basketball' },
  { key: 'ice-hockey', name: 'Ice Hockey', icon: 'hockey' },
  { key: 'baseball', name: 'Baseball', icon: 'baseball' },
] as const;

export const CATALOGUE_COUNTRIES = [
  { code: 'EN', name: 'England', flagEmoji: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  { code: 'DE', name: 'Germany', flagEmoji: '🇩🇪' },
  { code: 'ES', name: 'Spain', flagEmoji: '🇪🇸' },
  { code: 'IT', name: 'Italy', flagEmoji: '🇮🇹' },
  { code: 'FR', name: 'France', flagEmoji: '🇫🇷' },
  { code: 'NL', name: 'Netherlands', flagEmoji: '🇳🇱' },
  { code: 'PT', name: 'Portugal', flagEmoji: '🇵🇹' },
  { code: 'TR', name: 'Türkiye', flagEmoji: '🇹🇷' },
  { code: 'US', name: 'United States', flagEmoji: '🇺🇸' },
  { code: 'EU', name: 'Europe', flagEmoji: '🇪🇺' },
  { code: 'IN', name: 'International', flagEmoji: '🌍' },
] as const;

const team = (name: string, shortName: string, code: string, color: string): CatalogueTeam => ({
  name,
  shortName,
  code,
  color,
});

export const CATALOGUE_LEAGUES: CatalogueLeague[] = [
  {
    key: 'england-premier-league',
    name: 'Premier League',
    shortName: 'EPL',
    sportKey: 'football',
    countryCode: 'EN',
    tier: 1,
    priority: 1,
    teams: [
      team('Manchester United', 'Man United', 'MUN', '#DA291C'),
      team('Manchester City', 'Man City', 'MCI', '#6CABDD'),
      team('Liverpool', 'Liverpool', 'LIV', '#C8102E'),
      team('Arsenal', 'Arsenal', 'ARS', '#EF0107'),
      team('Chelsea', 'Chelsea', 'CHE', '#034694'),
      team('Tottenham Hotspur', 'Tottenham', 'TOT', '#132257'),
      team('Newcastle United', 'Newcastle', 'NEW', '#241F20'),
      team('Aston Villa', 'Aston Villa', 'AVL', '#95BFE5'),
      team('Brighton & Hove Albion', 'Brighton', 'BHA', '#0057B8'),
      team('West Ham United', 'West Ham', 'WHU', '#7A263A'),
      team('Everton', 'Everton', 'EVE', '#003399'),
      team('Nottingham Forest', 'Nottm Forest', 'NFO', '#DD0000'),
    ],
  },
  {
    key: 'england-championship',
    name: 'Championship',
    shortName: 'EFL',
    sportKey: 'football',
    countryCode: 'EN',
    tier: 2,
    priority: 12,
    teams: [
      team('Coventry City', 'Coventry', 'COV', '#48A0D9'),
      team('Leeds United', 'Leeds', 'LEE', '#FFCD00'),
      team('Norwich City', 'Norwich', 'NOR', '#00A650'),
      team('Sunderland', 'Sunderland', 'SUN', '#EB172B'),
      team('Middlesbrough', 'Boro', 'MID', '#DC2429'),
      team('Watford', 'Watford', 'WAT', '#FBEE23'),
    ],
  },
  {
    key: 'germany-bundesliga',
    name: 'Bundesliga',
    shortName: 'BL1',
    sportKey: 'football',
    countryCode: 'DE',
    tier: 1,
    priority: 2,
    teams: [
      team('FC Bayern München', 'Bayern', 'FCB', '#DC052D'),
      team('Borussia Dortmund', 'Dortmund', 'BVB', '#FDE100'),
      team('RB Leipzig', 'Leipzig', 'RBL', '#DD0741'),
      team('Bayer 04 Leverkusen', 'Leverkusen', 'B04', '#E32221'),
      team('VfB Stuttgart', 'Stuttgart', 'VFB', '#E32219'),
      team('Eintracht Frankfurt', 'Frankfurt', 'SGE', '#E1000F'),
      team('SV Elversberg', 'Elversberg', 'SVE', '#E30613'),
      team('SC Freiburg', 'Freiburg', 'SCF', '#000000'),
      team('Werder Bremen', 'Bremen', 'SVW', '#1D9053'),
      team('1. FC Union Berlin', 'Union Berlin', 'FCU', '#EB1923'),
    ],
  },
  {
    key: 'spain-laliga',
    name: 'LaLiga',
    shortName: 'LAL',
    sportKey: 'football',
    countryCode: 'ES',
    tier: 1,
    priority: 3,
    teams: [
      team('Real Madrid', 'Real Madrid', 'RMA', '#FEBE10'),
      team('FC Barcelona', 'Barcelona', 'BAR', '#A50044'),
      team('Atlético Madrid', 'Atlético', 'ATM', '#CB3524'),
      team('Sevilla FC', 'Sevilla', 'SEV', '#D50032'),
      team('Real Sociedad', 'Sociedad', 'RSO', '#0067B1'),
      team('Athletic Club', 'Athletic', 'ATH', '#EE2523'),
      team('Valencia CF', 'Valencia', 'VAL', '#F4A800'),
      team('Real Betis', 'Betis', 'BET', '#00954C'),
    ],
  },
  {
    key: 'italy-serie-a',
    name: 'Serie A',
    shortName: 'SEA',
    sportKey: 'football',
    countryCode: 'IT',
    tier: 1,
    priority: 4,
    teams: [
      team('Inter', 'Inter', 'INT', '#0068A8'),
      team('AC Milan', 'Milan', 'MIL', '#FB090B'),
      team('Juventus', 'Juventus', 'JUV', '#000000'),
      team('SSC Napoli', 'Napoli', 'NAP', '#12A0D7'),
      team('AS Roma', 'Roma', 'ROM', '#8E1F2F'),
      team('Atalanta', 'Atalanta', 'ATA', '#1E71B8'),
      team('Lazio', 'Lazio', 'LAZ', '#87D8F7'),
      team('Fiorentina', 'Fiorentina', 'FIO', '#482E92'),
    ],
  },
  {
    key: 'france-ligue-1',
    name: 'Ligue 1',
    shortName: 'LI1',
    sportKey: 'football',
    countryCode: 'FR',
    tier: 1,
    priority: 5,
    teams: [
      team('Paris Saint-Germain', 'PSG', 'PSG', '#004170'),
      team('Olympique de Marseille', 'Marseille', 'OM', '#2FAEE0'),
      team('AS Monaco', 'Monaco', 'ASM', '#E51B22'),
      team('Olympique Lyonnais', 'Lyon', 'OL', '#1A4B9B'),
      team('LOSC Lille', 'Lille', 'LIL', '#E01E13'),
      team('Stade Rennais', 'Rennes', 'REN', '#E23E2C'),
    ],
  },
  {
    key: 'netherlands-eredivisie',
    name: 'Eredivisie',
    shortName: 'ERE',
    sportKey: 'football',
    countryCode: 'NL',
    tier: 1,
    priority: 8,
    teams: [
      team('Ajax', 'Ajax', 'AJA', '#D2122E'),
      team('PSV Eindhoven', 'PSV', 'PSV', '#EE2224'),
      team('Feyenoord', 'Feyenoord', 'FEY', '#DA020E'),
      team('AZ Alkmaar', 'AZ', 'AZ', '#E4002B'),
    ],
  },
  {
    key: 'europe-champions-league',
    name: 'UEFA Champions League',
    shortName: 'UCL',
    sportKey: 'football',
    countryCode: 'EU',
    tier: 1,
    priority: 0,
    teams: [
      team('Real Madrid', 'Real Madrid', 'RMA', '#FEBE10'),
      team('FC Bayern München', 'Bayern', 'FCB', '#DC052D'),
      team('Manchester City', 'Man City', 'MCI', '#6CABDD'),
      team('Inter', 'Inter', 'INT', '#0068A8'),
      team('Paris Saint-Germain', 'PSG', 'PSG', '#004170'),
      team('Arsenal', 'Arsenal', 'ARS', '#EF0107'),
    ],
  },
  {
    key: 'tennis-atp',
    name: 'ATP Tour',
    shortName: 'ATP',
    sportKey: 'tennis',
    countryCode: 'IN',
    tier: 1,
    priority: 20,
    teams: [
      team('J. Sinner', 'Sinner', 'SIN', '#F26522'),
      team('C. Alcaraz', 'Alcaraz', 'ALC', '#D50032'),
      team('N. Djokovic', 'Djokovic', 'DJO', '#0057B8'),
      team('D. Medvedev', 'Medvedev', 'MED', '#1D428A'),
      team('A. Zverev', 'Zverev', 'ZVE', '#000000'),
      team('T. Fritz', 'Fritz', 'FRI', '#B31942'),
    ],
  },
  {
    key: 'basketball-nba',
    name: 'NBA',
    shortName: 'NBA',
    sportKey: 'basketball',
    countryCode: 'US',
    tier: 1,
    priority: 22,
    teams: [
      team('Boston Celtics', 'Celtics', 'BOS', '#007A33'),
      team('Denver Nuggets', 'Nuggets', 'DEN', '#0E2240'),
      team('Los Angeles Lakers', 'Lakers', 'LAL', '#552583'),
      team('Golden State Warriors', 'Warriors', 'GSW', '#1D428A'),
      team('Milwaukee Bucks', 'Bucks', 'MIL', '#00471B'),
      team('New York Knicks', 'Knicks', 'NYK', '#F58426'),
    ],
  },
  {
    key: 'ice-hockey-nhl',
    name: 'NHL',
    shortName: 'NHL',
    sportKey: 'ice-hockey',
    countryCode: 'US',
    tier: 1,
    priority: 24,
    teams: [
      team('Boston Bruins', 'Bruins', 'BOS', '#FFB81C'),
      team('Colorado Avalanche', 'Avalanche', 'COL', '#6F263D'),
      team('Toronto Maple Leafs', 'Maple Leafs', 'TOR', '#00205B'),
      team('Edmonton Oilers', 'Oilers', 'EDM', '#FF4C00'),
    ],
  },
  {
    key: 'baseball-mlb',
    name: 'MLB',
    shortName: 'MLB',
    sportKey: 'baseball',
    countryCode: 'US',
    tier: 1,
    priority: 26,
    teams: [
      team('New York Yankees', 'Yankees', 'NYY', '#0C2340'),
      team('Los Angeles Dodgers', 'Dodgers', 'LAD', '#005A9C'),
      team('Houston Astros', 'Astros', 'HOU', '#EB6E1F'),
      team('Atlanta Braves', 'Braves', 'ATL', '#CE1141'),
    ],
  },
];

export const CATALOGUE_BOOKMAKERS = [
  { key: 'betano', name: 'Betano', color: '#FF6B00', priority: 1 },
  { key: 'bet365', name: 'bet365', color: '#027B5B', priority: 2 },
  { key: 'bwin', name: 'bwin', color: '#FFCC00', priority: 3 },
  { key: 'tipico', name: 'Tipico', color: '#D2001F', priority: 4 },
  { key: 'pinnacle', name: 'Pinnacle', color: '#E4002B', priority: 5 },
  { key: 'unibet', name: 'Unibet', color: '#147B45', priority: 6 },
] as const;

/**
 * Maps a provider's league key onto the catalogue.
 *
 * Providers name leagues in their own shorthand — `EPL`, `IT_SERIE_A`,
 * `LA_LIGA` — and the sync used to store that string as the league's name and
 * key. That produced both an ugly name in the feed and a second league sitting
 * beside the one already in the catalogue, so `Serie A` and `IT_SERIE_A` were
 * two different leagues with the same fixtures.
 *
 * Resolving to the catalogue entry keeps the provider's events on the league
 * that already exists; its own key is kept in `providerLeagueId`.
 */
const squash = (value: string): string => value.toUpperCase().replace(/[^A-Z0-9]/g, '');

export function resolveCatalogueLeague(
  providerKey: string,
  sportKey?: string,
): CatalogueLeague | null {
  const candidates = sportKey
    ? CATALOGUE_LEAGUES.filter((league) => league.sportKey === sportKey)
    : CATALOGUE_LEAGUES;
  const squashed = squash(providerKey);

  return (
    candidates.find((league) => league.key === providerKey) ??
    candidates.find((league) => squash(league.shortName) === squashed) ??
    candidates.find((league) => squash(league.key) === squashed) ??
    // `IT_SERIE_A` → `ITSERIEA`, which ends with the catalogue name `SERIEA`.
    candidates.find((league) => {
      const name = squash(league.name);
      return name.length >= 4 && squashed.endsWith(name);
    }) ??
    null
  );
}

/**
 * A readable name for a league the catalogue does not know, so the feed shows
 * "FR Ligue 2" rather than `FR_LIGUE_2`. Short all-caps tokens are left alone,
 * because they are acronyms; everything else is title cased.
 */
export function humaniseLeagueKey(providerKey: string): string {
  const parts = providerKey.split(/[^A-Za-z0-9]+/).filter(Boolean);
  if (parts.length === 0) return providerKey;
  return parts
    .map((part) => {
      if (/^\d+$/.test(part)) return part;
      // Short all-caps tokens are acronyms — NBA, NHL, WTA, and the country
      // prefixes providers put in front of a league.
      if (part.length <= 3 && part === part.toUpperCase()) return part;
      return part[0]!.toUpperCase() + part.slice(1).toLowerCase();
    })
    .join(' ');
}
