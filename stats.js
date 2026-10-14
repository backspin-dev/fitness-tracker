// Alleen afgeleid van opgeslagen lokale gegevens; geen netwerk en geen schattingen.
const DAY = 86400000;
const SVG_NS = 'http://www.w3.org/2000/svg';
const number = new Intl.NumberFormat('nl-NL', { maximumFractionDigits: 2 });
const shortDate = new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const fullDate = new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

function calendarDay(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new RangeError('Gebruik een geldige datum in de vorm JJJJ-MM-DD.');
  }
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== value) {
    throw new RangeError('Deze datum bestaat niet.');
  }
  return timestamp / DAY;
}

function dateFromDay(day) {
  return new Date(day * DAY).toISOString().slice(0, 10);
}

function savedWorkouts(state, groupId = null) {
  return Object.entries(state.sessions ?? {}).flatMap(([key, exercises]) => {
    if (!Array.isArray(exercises) || exercises.length === 0) return [];
    const match = /^(\d{4}-\d{2}-\d{2}):(.+)$/.exec(key);
    if (!match || (groupId !== null && match[2] !== groupId)) return [];
    calendarDay(match[1]);
    return [{ date: match[1], groupId: match[2], exercises }];
  }).sort((a, b) => a.date.localeCompare(b.date) || a.groupId.localeCompare(b.groupId));
}

/** Series volgen stabiele oefening- én groeps-ID's, ook na een naamswijziging. */
export function listExerciseSeries(state) {
  const groups = new Map((state.groups ?? []).map((group, index) => [group.id, { ...group, index }]));
  const series = new Map();
  for (const workout of savedWorkouts(state)) {
    for (const exercise of workout.exercises) {
      const key = `${workout.groupId}:${exercise.id}`;
      if (!series.has(key)) {
        series.set(key, {
          key,
          name: exercise.name,
          groupName: groups.get(workout.groupId)?.name ?? workout.groupId,
          points: [],
        });
      }
      const item = series.get(key);
      item.name = exercise.name;
      item.points.push({ date: workout.date, weight: exercise.weight, reps: exercise.reps });
    }
  }
  return [...series.values()].sort((a, b) => {
    const groupA = groups.get(a.key.split(':')[0])?.index ?? Infinity;
    const groupB = groups.get(b.key.split(':')[0])?.index ?? Infinity;
    return groupA - groupB || a.groupName.localeCompare(b.groupName, 'nl') ||
      a.name.localeCompare(b.name, 'nl') || a.key.localeCompare(b.key);
  });
}

export function bodyWeightSeries(state) {
  return Object.entries(state.bodyWeights ?? {})
    .map(([date, value]) => { calendarDay(date); return { date, value }; })
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Een training is een niet-lege opgeslagen sessie, niet een geopend schema. */
export function trainingSummary(state, today, groupId = null) {
  const from = dateFromDay(calendarDay(today) - 27);
  const workouts = savedWorkouts(state, groupId).filter(workout => workout.date <= today);
  return {
    total: workouts.length,
    last28Days: workouts.filter(workout => workout.date >= from).length,
    lastDate: workouts.at(-1)?.date ?? null,
  };
}

/** Kalenderweken beginnen op maandag; de huidige week telt alleen t/m vandaag. */
export function weeklyTrainingCounts(state, today, weeks = 8, groupId = null) {
  if (!Number.isInteger(weeks) || weeks < 1 || weeks > 520) {
    throw new RangeError('Kies tussen 1 en 520 hele weken.');
  }
  const day = calendarDay(today);
  const weekday = new Date(day * DAY).getUTCDay();
  const monday = day - (weekday + 6) % 7;
  const firstMonday = monday - (weeks - 1) * 7;
  const buckets = Array.from({ length: weeks }, (_, index) => ({
    date: dateFromDay(firstMonday + index * 7), value: 0,
  }));
  for (const workout of savedWorkouts(state, groupId)) {
    const workoutDay = calendarDay(workout.date);
    if (workoutDay < firstMonday || workoutDay > day) continue;
    buckets[Math.floor((workoutDay - firstMonday) / 7)].value++;
  }
  return buckets;
}

/** Vergelijk per ID met de vorige niet-lege sessie van dezelfde groep. */
export function latestWorkoutComparison(state, groupId, today) {
  calendarDay(today);
  const workouts = savedWorkouts(state, groupId).filter(workout => workout.date <= today);
  const latest = workouts.at(-1);
  if (!latest) return null;
  const previous = workouts.at(-2);
  const previousExercises = new Map((previous?.exercises ?? []).map(exercise => [exercise.id, exercise]));
  return {
    date: latest.date,
    previousDate: previous?.date ?? null,
    rows: latest.exercises.map(exercise => {
      const old = previousExercises.get(exercise.id);
      return {
        name: exercise.name,
        weight: exercise.weight,
        reps: exercise.reps,
        weightDelta: old ? Number((exercise.weight - old.weight).toFixed(8)) : null,
        repsDelta: old ? exercise.reps - old.reps : null,
      };
    }),
  };
}

function svgElement(document, tag, attributes = {}, text) {
  const element = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, String(value));
  if (text !== undefined) element.textContent = text;
  return element;
}

function checkedPoints(points) {
  return points.map(point => {
    const day = calendarDay(point.date);
    if (typeof point.value !== 'number' || !Number.isFinite(point.value)) {
      throw new TypeError('Een grafiekwaarde moet een eindig getal zijn.');
    }
    return { date: point.date, value: point.value, day };
  }).sort((a, b) => a.day - b.day);
}

function niceStep(value) {
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const fraction = value / magnitude;
  return (fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 2.5 ? 2.5 : fraction <= 5 ? 5 : 10) * magnitude;
}

function extent(points, zeroBaseline) {
  const values = points.map(point => point.value);
  let low = Math.min(...values);
  let high = Math.max(...values);
  if (zeroBaseline) {
    low = Math.min(0, low);
    high = Math.max(1, high);
  } else {
    const padding = high === low ? Math.max(Math.abs(high) * 0.05, 1) : (high - low) * 0.12;
    low = low >= 0 ? Math.max(0, low - padding) : low - padding;
    high += padding;
  }
  let step = niceStep((high - low) / 4);
  if (zeroBaseline) step = Math.max(1, Math.ceil(step));
  const min = Math.floor(low / step) * step;
  const max = Math.ceil(high / step) * step;
  return { min, max, step };
}

function chartFrame(container, points, { label = 'Voortgang', unit = '' } = {}, zeroBaseline = false) {
  const document = container.ownerDocument;
  container.replaceChildren();
  if (!points.length) {
    const empty = document.createElement('p');
    empty.className = 'stats-chart-empty';
    empty.textContent = 'Nog geen gegevens voor deze grafiek.';
    container.append(empty);
    return null;
  }
  const width = 360;
  const height = 240;
  const plot = { left: 48, right: width - 16, top: 25, bottom: height - 39 };
  const svg = svgElement(document, 'svg', {
    viewBox: `0 0 ${width} ${height}`,
    class: 'stats-chart',
    role: 'img',
    'aria-label': `${label}${unit ? ` (${unit})` : ''}. ${points.length} ${points.length === 1 ? 'meetpunt' : 'meetpunten'}, van ${fullDate.format(new Date(points[0].day * DAY))} tot ${fullDate.format(new Date(points.at(-1).day * DAY))}.`,
  });
  svg.append(svgElement(document, 'title', {}, label));
  const domain = extent(points, zeroBaseline);
  const y = value => plot.bottom - (value - domain.min) / (domain.max - domain.min) * (plot.bottom - plot.top);
  for (let tick = 0; tick <= Math.round((domain.max - domain.min) / domain.step); tick++) {
    const value = domain.min + tick * domain.step;
    svg.append(svgElement(document, 'line', {
      x1: plot.left, x2: plot.right, y1: y(value), y2: y(value), stroke: '#353b30', 'stroke-width': 1,
    }));
    svg.append(svgElement(document, 'text', {
      x: plot.left - 9, y: y(value) + 4, 'text-anchor': 'end', fill: '#a0a898', stroke: 'none', 'font-size': 11,
    }, number.format(value)));
  }
  if (unit) svg.append(svgElement(document, 'text', {
    x: plot.left, y: 12, fill: '#a0a898', stroke: 'none', 'font-size': 11,
  }, unit));
  container.append(svg);
  return { svg, document, plot, y };
}

function xLabel(frame, date, x, anchor = 'middle', includeYear = false) {
  const text = shortDate.format(new Date(`${date}T00:00:00Z`));
  frame.svg.append(svgElement(frame.document, 'text', {
    x, y: frame.plot.bottom + 25, 'text-anchor': anchor, fill: '#a0a898', stroke: 'none', 'font-size': 11,
  }, `${text}${includeYear ? ` '${date.slice(2, 4)}` : ''}`));
}

/** Tekent alleen gemeten punten; de x-as volgt echte kalenderafstanden. */
export function renderLineChart(container, input, options = {}) {
  const points = checkedPoints(input);
  const frame = chartFrame(container, points, options);
  if (!frame) return null;
  const { svg, document, plot, y } = frame;
  const first = points[0].day;
  const last = points.at(-1).day;
  const x = day => first === last ? (plot.left + plot.right) / 2 :
    plot.left + (day - first) / (last - first) * (plot.right - plot.left);
  if (points.length > 1) svg.append(svgElement(document, 'polyline', {
    points: points.map(point => `${x(point.day).toFixed(2)},${y(point.value).toFixed(2)}`).join(' '),
    fill: 'none', stroke: '#cefa69', 'stroke-width': 2.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
  }));
  const markers = points.length <= 40 ? points : [points[0], points.at(-1)];
  for (const point of markers) {
    const marker = svgElement(document, 'circle', {
      cx: x(point.day), cy: y(point.value), r: points.length === 1 ? 4.5 : 3.5,
      fill: '#cefa69', stroke: '#151714', 'stroke-width': 1.5,
    });
    marker.append(svgElement(document, 'title', {},
      `${fullDate.format(new Date(point.day * DAY))}: ${number.format(point.value)}${options.unit ? ` ${options.unit}` : ''}`));
    svg.append(marker);
  }
  const includeYear = points[0].date.slice(0, 4) !== points.at(-1).date.slice(0, 4);
  if (first === last) xLabel(frame, points[0].date, x(first));
  else {
    xLabel(frame, points[0].date, plot.left, 'start', includeYear);
    xLabel(frame, points.at(-1).date, plot.right, 'end', includeYear);
  }
  return svg;
}

export function renderBarChart(container, input, options = {}) {
  const points = checkedPoints(input);
  if (points.some(point => point.value < 0 || !Number.isInteger(point.value))) {
    throw new RangeError('Trainingstellingen moeten positieve hele getallen of nul zijn.');
  }
  const frame = chartFrame(container, points, options, true);
  if (!frame) return null;
  const { svg, document, plot, y } = frame;
  const slot = (plot.right - plot.left) / points.length;
  const barWidth = Math.min(32, slot * 0.64);
  for (const [index, point] of points.entries()) {
    const x = plot.left + slot * (index + 0.5);
    if (point.value > 0) {
      const bar = svgElement(document, 'rect', {
        x: x - barWidth / 2, y: y(point.value), width: barWidth,
        height: y(0) - y(point.value), rx: Math.min(4, barWidth / 3), fill: '#cefa69', stroke: 'none',
      });
      bar.append(svgElement(document, 'title', {}, `Week van ${fullDate.format(new Date(point.day * DAY))}: ${point.value} trainingen`));
      svg.append(bar);
    }
    if (points.length <= 12) svg.append(svgElement(document, 'text', {
      x, y: y(point.value) - 8, 'text-anchor': 'middle', fill: '#f2f4ed', stroke: 'none', 'font-size': 11,
    }, number.format(point.value)));
    // Keep labels readable on an iPhone, including when a longer period is used.
    if (points.length <= 3 || index === 0 || index === points.length - 1 ||
        (points.length > 5 && index === Math.floor((points.length - 1) / 2))) {
      xLabel(frame, point.date, x, index === 0 ? 'start' : index === points.length - 1 ? 'end' : 'middle',
        points[0].date.slice(0, 4) !== points.at(-1).date.slice(0, 4));
    }
  }
  return svg;
}
