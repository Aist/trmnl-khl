const MOSCOW_ZONE = 'Europe/Moscow';

const COPY = {
  today: 'Сегодня · КХЛ',
  upcoming: 'Ближайшие игры ·',
  noGames: 'Ближайших матчей нет',
  noGamesDetail: 'Следующий игровой день КХЛ пока недоступен.',
  unavailable: 'Расписание временно недоступно',
  unavailableDetail: 'Повторите попытку при следующем обновлении.',
  more: 'матчей',
};

function parts(date) {
  const values = new Intl.DateTimeFormat('en-CA', {
    timeZone: MOSCOW_ZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  return Object.fromEntries(values.filter(({ type }) => type !== 'literal').map(({ type, value }) => [type, value]));
}

function dateKey(date) {
  const value = parts(date);
  return `${value.year}-${value.month}-${value.day}`;
}

function displayDate(date) {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: MOSCOW_ZONE,
    day: 'numeric', month: 'long',
  }).format(date);
}

function displayTime(date) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: MOSCOW_ZONE,
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(date);
}

function moscowMidnightEpoch(now) {
  const value = parts(now);
  return Math.floor(Date.UTC(Number(value.year), Number(value.month) - 1, Number(value.day)) / 1000) - 3 * 60 * 60;
}

async function fetchEvents(now) {
  const params = new URLSearchParams({
    locale: 'ru',
    order_direction: 'asc',
    'q[start_at_gt_time_from_unixtime]': String(moscowMidnightEpoch(now)),
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4500);
  try {
    const response = await fetch(`https://khl.api.webcaster.pro/api/khl_mobile/events_v2.json?${params}`, { signal: controller.signal });
    if (!response.ok) return null;
    return await response.json();
  } catch (_) {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function normaliseEvents(data) {
  if (!Array.isArray(data)) return null;

  return data
    .map((entry) => entry && entry.event)
    .filter((event) => event && event.type_id === 24 && Number.isFinite(Number(event.start_at)))
    .map((event) => {
      const start = new Date(Number(event.start_at));
      const home = event.team_a && typeof event.team_a.name === 'string' ? event.team_a.name.trim() : '';
      const away = event.team_b && typeof event.team_b.name === 'string' ? event.team_b.name.trim() : '';
      const homeLogo = event.team_a && typeof event.team_a.image === 'string' ? event.team_a.image : '';
      const awayLogo = event.team_b && typeof event.team_b.image === 'string' ? event.team_b.image : '';
      return { start, home: home || '—', away: away || '—', homeLogo, awayLogo };
    })
    .filter((game) => !Number.isNaN(game.start.getTime()))
    .sort((left, right) => left.start - right.start);
}

async function run(input) {
  const copy = COPY;
  const now = new Date();
  // The array path keeps normalisation independently testable. In production the
  // polling response is an object and the transform fetches the schedule below.
  const source = Array.isArray(input?.data)
    ? input.data
    : Object.prototype.hasOwnProperty.call(input || {}, 'events')
      ? input.events
      : await fetchEvents(now);
  const games = normaliseEvents(source);
  if (!games) {
    return { status: 'error', ...copy, games: [], overflow: 0 };
  }

  const today = dateKey(now);
  const todayGames = games.filter((game) => dateKey(game.start) === today);
  const selected = todayGames.length ? todayGames : (() => {
    const future = games.filter((game) => dateKey(game.start) > today);
    if (!future.length) return [];
    const nextDate = dateKey(future[0].start);
    return future.filter((game) => dateKey(game.start) === nextDate);
  })();

  if (!selected.length) {
    return { status: 'empty', ...copy, games: [], overflow: 0 };
  }

  const selectedDate = dateKey(selected[0].start);
  return {
    status: 'ok',
    ...copy,
    is_today: selectedDate === today,
    game_date: displayDate(selected[0].start),
    games: selected.map((game) => ({
      time: displayTime(game.start),
      home: game.home,
      away: game.away,
      home_logo: game.homeLogo,
      away_logo: game.awayLogo,
    })),
    overflow: 0,
  };
}

