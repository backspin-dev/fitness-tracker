// Gecontroleerde oefeningen: ACE/NASM-bibliotheken, geraadpleegd 14 oktober 2026.
// Alleen namen/zekere aliassen; geen gekopieerde instructies, afbeeldingen of runtimeverzoeken.
// https://www.nasm.org/resource-center/exercise-library
// https://www.acefitness.org/resources/everyone/exercise-library/
// https://www.acefitness.org/resources/pros/expert-articles/5875/5-variations-of-the-body-weight-squat/
// https://www.acefitness.org/resources/everyone/blog/5694/build-your-biceps-workout/
// https://www.acefitness.org/resources/pros/expert-articles/9074/smart-shoulder-solutions-an-evidence-based-approach-to-training-the-deltoids/
// https://www.acefitness.org/resources/everyone/exercise-library/equipment/trx/
// Bestaande sleutels en aliassen blijven behouden: materiaal wordt nooit generiek weggefilterd.
// Alleen expliciete aliassen delen een ranglijst. Materiaal en varianten blijven behouden.
export const EXERCISE_CATALOG = Object.freeze([
  { key: 'ex:squat', label: 'Squat', aliases: ['Squats'] },
  { key: 'ex:back-squat', label: 'Back squat', aliases: ['Back squats', 'Barbell back squat', 'Barbell back squats'] },
  { key: 'ex:front-squat', label: 'Front squat', aliases: ['Front squats', 'Barbell front squat', 'Barbell front squats'] },
  { key: 'ex:goblet-squat', label: 'Goblet squat', aliases: ['Goblet squats'] },
  { key: 'ex:leg-press', label: 'Leg press', aliases: ['Legpress', 'Leg press machine', 'Leg press apparaat', 'Benenpers'] },
  { key: 'ex:leg-extension', label: 'Leg extension', aliases: ['Leg extensions', 'Leg extension machine', 'Leg extension apparaat'] },
  { key: 'ex:seated-leg-curl', label: 'Seated leg curl', aliases: ['Seated leg curls', 'Seated leg curl machine', 'Zittende leg curl'] },
  { key: 'ex:lying-leg-curl', label: 'Lying leg curl', aliases: ['Lying leg curls', 'Lying leg curl machine', 'Liggende leg curl'] },
  { key: 'ex:standing-calf-raise-machine', label: 'Standing calf raise machine', aliases: ['Standing calf raises machine', 'Standing calf raise apparaat'] },
  { key: 'ex:deadlift', label: 'Deadlift', aliases: ['Deadlifts'] },
  { key: 'ex:romanian-deadlift', label: 'Romanian deadlift', aliases: ['Romanian deadlifts', 'Roemeense deadlift', 'Roemeense deadlifts', 'RDL'] },
  { key: 'ex:bench-press', label: 'Bench press', aliases: ['Benchpress', 'Barbell bench press', 'Bench press barbell', 'Bankdrukken', 'Bankdrukken halter'] },
  { key: 'ex:dumbbell-bench-press', label: 'Dumbbell bench press', aliases: ['Dumbbell benchpress', 'Bench press dumbbell', 'Bench press dumbbells', 'Dumbbell bankdrukken'] },
  { key: 'ex:bench-press-machine', label: 'Bench press machine', aliases: ['Benchpress machine', 'BenchPressMachine', 'Bench press apparaat', 'Bankdrukken machine'] },
  { key: 'ex:incline-bench-press', label: 'Incline bench press', aliases: ['Incline bench', 'Incline benchpress', 'Incline barbell bench press', 'Incline bench press barbell'] },
  { key: 'ex:incline-dumbbell-bench-press', label: 'Incline dumbbell bench press', aliases: ['Incline dumbbell press', 'Incline bench press dumbbell', 'Incline bench press dumbbells'] },
  { key: 'ex:chest-press-machine', label: 'Chest press machine', aliases: ['Chest press apparaat', 'Chestpress machine', 'Chestpress apparaat'] },
  { key: 'ex:chest-fly-machine', label: 'Chest fly machine', aliases: ['Fly machine', 'Chest fly apparaat', 'Pec deck', 'Pecdeck', 'Butterfly machine'] },
  { key: 'ex:dumbbell-chest-fly', label: 'Dumbbell chest fly', aliases: ['Dumbbell chest flys', 'Dumbbell chest flies', 'Dumbbell fly', 'Dumbbell flies', 'Chest fly dumbbell'] },
  { key: 'ex:shoulder-press-machine', label: 'Shoulder press machine', aliases: ['Shoulder press apparaat', 'Shoulderpress machine', 'Schouderpress machine'] },
  { key: 'ex:dumbbell-shoulder-press', label: 'Dumbbell shoulder press', aliases: ['Shoulder press dumbbell', 'Shoulder press dumbbells', 'Dumbbell schouderpress'] },
  { key: 'ex:barbell-overhead-press', label: 'Barbell overhead press', aliases: ['Overhead press barbell', 'Barbell shoulder press', 'Shoulder press barbell'] },
  { key: 'ex:dumbbell-lateral-raise', label: 'Dumbbell lateral raise', aliases: ['Dumbbell lateral raises', 'Lateral raise dumbbell', 'Lateral raises dumbbell', 'Side raise dumbbell', 'Side raises dumbbell', 'Dumbbell side raise', 'Dumbbell side raises'] },
  { key: 'ex:lat-pulldown', label: 'Lat pulldown', aliases: ['Lat pull down', 'Lat pulldowns', 'Lat pull downs', 'Latpulldown'] },
  { key: 'ex:pull-up', label: 'Pull-up', aliases: ['Pull ups', 'Pullups', 'Pullup'] },
  { key: 'ex:seated-cable-row', label: 'Seated cable row', aliases: ['Seated cable rows', 'Cable seated row', 'Zittende kabelroeien'] },
  { key: 'ex:barbell-row', label: 'Barbell row', aliases: ['Barbell rows', 'Bent over barbell row', 'Bent over barbell rows', 'Bent over row barbell'] },
  { key: 'ex:dumbbell-row', label: 'Dumbbell row', aliases: ['Dumbbell rows', 'One arm dumbbell row', 'One arm dumbbell rows', 'Dumbbell roeien'] },
  { key: 'ex:barbell-biceps-curl', label: 'Barbell biceps curl', aliases: ['Barbell biceps curls', 'Barbell curl', 'Barbell curls', 'Bicep curl barbell'] },
  { key: 'ex:dumbbell-biceps-curl', label: 'Dumbbell biceps curl', aliases: ['Dumbbell biceps curls', 'Dumbbell curl', 'Dumbbell curls', 'Bicep curl dumbbell'] },
  { key: 'ex:triceps-pushdown-bar', label: 'Triceps pushdown bar', aliases: ['Tricep push down bar', 'Triceps push down bar', 'Tricep pushdown bar', 'Triceps pushdown stang', 'Tricep pushdown stang'] },
  { key: 'ex:triceps-pushdown-rope', label: 'Triceps pushdown rope', aliases: ['Tricep push down rope', 'Triceps push down rope', 'Tricep pushdown rope', 'Triceps pushdown touw', 'Tricep pushdown touw'] },
  { key: 'ex:skull-crusher', label: 'Skull crusher', aliases: ['Skull crushers', 'Skullcrusher', 'Skullcrushers'] },
  { key: 'ex:push-up', label: 'Push-up', aliases: ['Push ups', 'Pushup', 'Pushups', 'Opdrukken'] },

  // Aanvullende, bestaande oefeningen uit de bovenstaande primaire bibliotheken.
  {"key": "ex:bodyweight-squat", "label": "Bodyweight squat", "aliases": ["Body weight squat", "Bodyweight squats", "Air squat", "Air squats", "Squat lichaamsgewicht"]},
  {"key": "ex:prisoner-squat", "label": "Prisoner squat", "aliases": ["Prisoner squats"]},
  {"key": "ex:jump-squat", "label": "Jump squat", "aliases": ["Jump squats", "Squat jump", "Squat jumps"]},
  {"key": "ex:sumo-squat", "label": "Sumo squat", "aliases": ["Sumo squats"]},
  {"key": "ex:dumbbell-sumo-squat", "label": "Dumbbell sumo squat", "aliases": ["Dumbbell sumo squats", "Sumo squat dumbbell"]},
  {"key": "ex:dumbbell-front-squat", "label": "Dumbbell front squat", "aliases": ["Dumbbell front squats", "Front squat dumbbells"]},
  {"key": "ex:kettlebell-front-squat", "label": "Kettlebell front squat", "aliases": ["Kettlebell front squats", "Front squat kettlebell"]},
  {"key": "ex:dumbbell-goblet-squat", "label": "Dumbbell goblet squat", "aliases": ["Goblet squat dumbbell", "Dumbbell goblet squats"]},
  {"key": "ex:kettlebell-goblet-squat", "label": "Kettlebell goblet squat", "aliases": ["Goblet squat kettlebell", "Kettlebell goblet squats"]},
  {"key": "ex:single-leg-squat", "label": "Single-leg squat", "aliases": ["Single leg squats", "Eenbenige squat"]},
  {"key": "ex:bulgarian-split-squat", "label": "Bulgarian split squat", "aliases": ["Bulgarian split squats", "Bulgaarse split squat"]},
  {"key": "ex:dumbbell-bulgarian-split-squat", "label": "Dumbbell Bulgarian split squat", "aliases": ["Bulgarian split squat dumbbell", "Bulgarian split squat dumbbells"]},
  {"key": "ex:bodyweight-split-squat", "label": "Bodyweight split squat", "aliases": ["Body weight split squat", "Bodyweight split squats"]},
  {"key": "ex:forward-lunge", "label": "Forward lunge", "aliases": ["Forward lunges", "Voorwaartse lunge", "Voorwaartse lunges"]},
  {"key": "ex:reverse-lunge", "label": "Reverse lunge", "aliases": ["Reverse lunges", "Rear lunge", "Rear lunges", "Achterwaartse lunge"]},
  {"key": "ex:lateral-lunge", "label": "Lateral lunge", "aliases": ["Lateral lunges", "Side lunge", "Side lunges", "Zijwaartse lunge"]},
  {"key": "ex:barbell-forward-lunge", "label": "Barbell forward lunge", "aliases": ["Barbell forward lunges", "Forward lunge barbell"]},
  {"key": "ex:dumbbell-forward-lunge", "label": "Dumbbell forward lunge", "aliases": ["Dumbbell forward lunges", "Forward lunge dumbbells"]},
  {"key": "ex:dumbbell-lateral-lunge", "label": "Dumbbell lateral lunge", "aliases": ["Dumbbell side lunge", "Dumbbell lateral lunges", "Side lunge dumbbells"]},
  {"key": "ex:dumbbell-step-up", "label": "Dumbbell step-up", "aliases": ["Dumbbell step ups", "Step up dumbbells"]},
  {"key": "ex:bodyweight-step-up", "label": "Bodyweight step-up", "aliases": ["Body weight step up", "Bodyweight step ups"]},
  {"key": "ex:single-leg-press", "label": "Single-leg press", "aliases": ["Single leg leg press", "Single leg presses", "Eenbenige leg press"]},
  {"key": "ex:leg-press-calf-raise", "label": "Leg press calf raise", "aliases": ["Leg press calf raises", "Calf raise leg press"]},
  {"key": "ex:glute-bridge", "label": "Glute bridge", "aliases": ["Glute bridges", "Floor bridge", "Floor bridges", "Bilbrug"]},
  {"key": "ex:barbell-glute-bridge", "label": "Barbell glute bridge", "aliases": ["Barbell hip bridge", "Barbell glute bridges", "Glute bridge barbell"]},
  {"key": "ex:barbell-hip-thrust", "label": "Barbell hip thrust", "aliases": ["Barbell hip thrusts", "Hip thrust barbell"]},
  {"key": "ex:side-lying-hip-abduction", "label": "Side-lying hip abduction", "aliases": ["Side lying hip abductions", "Liggende heupabductie"]},
  {"key": "ex:quadruped-hip-extension", "label": "Quadruped hip extension", "aliases": ["Quadruped hip extensions", "Donkey kick", "Donkey kicks"]},
  {"key": "ex:glute-press-machine", "label": "Glute press machine", "aliases": ["Glute press apparaat", "Machine glute press"]},
  {"key": "ex:dumbbell-romanian-deadlift", "label": "Dumbbell Romanian deadlift", "aliases": ["Dumbbell RDL", "Dumbbell Romanian deadlifts", "Romanian deadlift dumbbells"]},
  {"key": "ex:kettlebell-deadlift", "label": "Kettlebell deadlift", "aliases": ["Kettlebell deadlifts", "Deadlift kettlebell"]},
  {"key": "ex:barbell-good-morning", "label": "Barbell good morning", "aliases": ["Barbell good mornings", "Good morning barbell"]},
  {"key": "ex:stability-ball-leg-curl", "label": "Stability ball leg curl", "aliases": ["Stability ball hamstring curl", "Stability ball hamstring curls", "Swiss ball leg curl"]},
  {"key": "ex:standing-band-hip-abduction", "label": "Standing band hip abduction", "aliases": ["Band standing hip abduction", "Standing hip abduction resistance band"]},
  {"key": "ex:close-grip-bench-press", "label": "Close-grip bench press", "aliases": ["Close grip benchpress", "Close grip barbell bench press", "Smal bankdrukken"]},
  {"key": "ex:dumbbell-floor-press", "label": "Dumbbell floor press", "aliases": ["Floor press dumbbells"]},
  {"key": "ex:single-arm-dumbbell-bench-press", "label": "Single-arm dumbbell bench press", "aliases": ["Single arm dumbbell chest press", "One arm dumbbell bench press"]},
  {"key": "ex:single-arm-incline-dumbbell-bench-press", "label": "Single-arm incline dumbbell bench press", "aliases": ["Single arm incline dumbbell chest press"]},
  {"key": "ex:incline-dumbbell-fly", "label": "Incline dumbbell fly", "aliases": ["Incline dumbbell flies", "Incline dumbbell flys", "Incline chest fly dumbbell"]},
  {"key": "ex:cable-crossover", "label": "Cable crossover", "aliases": ["Cable crossovers", "Bent forward cable crossover"]},
  {"key": "ex:standing-cable-chest-fly", "label": "Standing cable chest fly", "aliases": ["Standing cable fly", "Standing cable flyes", "Two arm standing cable fly"]},
  {"key": "ex:standing-band-chest-press", "label": "Standing band chest press", "aliases": ["Resistance band standing chest press", "Standing chest press resistance band"]},
  {"key": "ex:standing-band-chest-fly", "label": "Standing band chest fly", "aliases": ["Resistance band chest fly", "Standing chest fly resistance band"]},
  {"key": "ex:seated-cable-chest-press", "label": "Seated cable chest press", "aliases": ["Seated cable press"]},
  {"key": "ex:seated-incline-cable-press", "label": "Seated incline cable press", "aliases": ["Seated incline cable chest press"]},
  {"key": "ex:seated-decline-cable-press", "label": "Seated decline cable press", "aliases": ["Seated decline cable chest press"]},
  {"key": "ex:close-grip-chest-press-machine", "label": "Close-grip chest press machine", "aliases": ["Seated close grip chest press machine", "Close grip chest press apparaat"]},
  {"key": "ex:chin-up", "label": "Chin-up", "aliases": ["Chin ups", "Chinup", "Chinups"]},
  {"key": "ex:band-assisted-pull-up", "label": "Band-assisted pull-up", "aliases": ["Band assisted pull ups", "Pull up with resistance band"]},
  {"key": "ex:negative-pull-up", "label": "Negative pull-up", "aliases": ["Negative pull ups", "Eccentric pull up"]},
  {"key": "ex:kneeling-cable-lat-pulldown", "label": "Kneeling cable lat pulldown", "aliases": ["Kneeling lat pulldown cable", "Kneeling cable lat pull down"]},
  {"key": "ex:seated-row-machine", "label": "Seated row machine", "aliases": ["Seated machine row", "Seated row apparaat"]},
  {"key": "ex:high-row-machine", "label": "High row machine", "aliases": ["Seated high back row machine", "Seated high back rows machine"]},
  {"key": "ex:seated-high-cable-row", "label": "Seated high cable row", "aliases": ["Seated cable high row", "Seated high back cable row"]},
  {"key": "ex:standing-band-row", "label": "Standing band row", "aliases": ["Standing tubing row", "Resistance band standing row"]},
  {"key": "ex:single-arm-cable-row", "label": "Single-arm cable row", "aliases": ["Single arm cable rows", "One arm cable row"]},
  {"key": "ex:incline-dumbbell-row", "label": "45-degree incline dumbbell row", "aliases": ["45 degree incline row dumbbell", "Incline dumbbell row 45 degrees"]},
  {"key": "ex:dumbbell-renegade-row", "label": "Dumbbell renegade row", "aliases": ["Dumbbell renegade rows", "Renegade row dumbbells"]},
  {"key": "ex:dumbbell-front-raise", "label": "Dumbbell front raise", "aliases": ["Dumbbell front raises", "Front raise dumbbell"]},
  {"key": "ex:incline-dumbbell-reverse-fly", "label": "Incline dumbbell reverse fly", "aliases": ["Incline reverse fly dumbbell", "Incline dumbbell reverse flies"]},
  {"key": "ex:seated-dumbbell-rear-lateral-raise", "label": "Seated dumbbell rear lateral raise", "aliases": ["Seated rear lateral raise dumbbell", "Seated dumbbell rear lateral raises"]},
  {"key": "ex:cable-diagonal-raise", "label": "Cable diagonal raise", "aliases": ["Diagonal raise cable"]},
  {"key": "ex:barbell-upright-row", "label": "Barbell upright row", "aliases": ["Barbell upright rows", "Upright row barbell"]},
  {"key": "ex:cable-face-pull", "label": "Cable face pull", "aliases": ["Cable face pulls", "Face pull cable", "Face pull rope", "Face pulls rope"]},
  {"key": "ex:dumbbell-arnold-press", "label": "Dumbbell Arnold press", "aliases": ["Arnold press dumbbell", "Arnold press", "Arnold presses"]},
  {"key": "ex:dumbbell-push-press", "label": "Dumbbell push press", "aliases": ["Push press dumbbell", "Dumbbell push presses"]},
  {"key": "ex:seated-dumbbell-shoulder-press", "label": "Seated dumbbell shoulder press", "aliases": ["Seated dumbbell overhead press", "Seated overhead press dumbbells"]},
  {"key": "ex:lateral-raise-machine", "label": "Lateral raise machine", "aliases": ["Lateral shoulder raise machine", "Lateral raise apparaat"]},
  {"key": "ex:barbell-shrug", "label": "Barbell shrug", "aliases": ["Barbell shrugs", "Shrug barbell"]},
  {"key": "ex:dumbbell-hammer-curl", "label": "Dumbbell hammer curl", "aliases": ["Dumbbell hammer curls", "Hammer curl dumbbell", "Hammer curls dumbbells"]},
  {"key": "ex:dumbbell-concentration-curl", "label": "Dumbbell concentration curl", "aliases": ["Concentration curl dumbbell", "Dumbbell concentration curls"]},
  {"key": "ex:incline-dumbbell-curl", "label": "Incline dumbbell curl", "aliases": ["Incline dumbbell curls", "Incline curl dumbbell"]},
  {"key": "ex:preacher-curl", "label": "Preacher curl", "aliases": ["Preacher curls"]},
  {"key": "ex:cable-biceps-curl", "label": "Cable biceps curl", "aliases": ["Cable bicep curl", "Cable biceps curls", "Cable curl", "Cable curls"]},
  {"key": "ex:ez-bar-biceps-curl", "label": "EZ-bar biceps curl", "aliases": ["EZ bar curl", "EZ curl", "EZ bar bicep curl"]},
  {"key": "ex:wide-grip-ez-bar-curl", "label": "Wide-grip EZ-bar curl", "aliases": ["EZ curl wide grip", "Wide grip EZ curl"]},
  {"key": "ex:close-grip-ez-bar-curl", "label": "Close-grip EZ-bar curl", "aliases": ["EZ curl narrow grip", "Narrow grip EZ bar curl", "Close grip EZ curl"]},
  {"key": "ex:barbell-reverse-curl", "label": "Barbell reverse curl", "aliases": ["Reverse barbell curl", "Reverse bicep curl barbell"]},
  {"key": "ex:dumbbell-zottman-curl", "label": "Dumbbell Zottman curl", "aliases": ["Zottman curl dumbbell", "Zottman curl", "Zottman curls"]},
  {"key": "ex:dumbbell-cross-body-curl", "label": "Dumbbell cross-body curl", "aliases": ["Cross body curl dumbbell", "Dumbbell cross body curls"]},
  {"key": "ex:biceps-curl-machine", "label": "Biceps curl machine", "aliases": ["Seated biceps curl machine", "Bicep curl machine", "Biceps curl apparaat"]},
  {"key": "ex:lying-barbell-triceps-extension", "label": "Lying barbell triceps extension", "aliases": ["Lying barbell triceps extensions", "Barbell skull crusher", "Barbell skullcrushers"]},
  {"key": "ex:dumbbell-triceps-kickback", "label": "Dumbbell triceps kickback", "aliases": ["Dumbbell tricep kickback", "Triceps kickback dumbbell"]},
  {"key": "ex:dumbbell-wrist-extension", "label": "Dumbbell wrist extension", "aliases": ["Wrist curl extension dumbbell", "Dumbbell wrist extensions"]},
  {"key": "ex:dumbbell-wrist-flexion", "label": "Dumbbell wrist flexion", "aliases": ["Wrist curl flexion dumbbell", "Dumbbell wrist curls"]},
  {"key": "ex:cable-triceps-pushdown", "label": "Cable triceps pushdown", "aliases": ["Cable tricep pushdown", "Cable triceps press down"]},
  {"key": "ex:band-triceps-extension", "label": "Band triceps extension", "aliases": ["Resistance band triceps extension", "Triceps extension resistance band"]},
  {"key": "ex:dumbbell-overhead-triceps-extension", "label": "Dumbbell overhead triceps extension", "aliases": ["Overhead triceps extension dumbbell", "Dumbbell overhead tricep extension"]},
  {"key": "ex:crunch", "label": "Crunch", "aliases": ["Crunches", "Abdominal crunch", "Buikspiercrunch"]},
  {"key": "ex:reverse-crunch", "label": "Reverse crunch", "aliases": ["Reverse crunches"]},
  {"key": "ex:bicycle-crunch", "label": "Bicycle crunch", "aliases": ["Bicycle crunches", "Bicycle maneuver"]},
  {"key": "ex:stability-ball-crunch", "label": "Stability ball crunch", "aliases": ["Crunch on exercise ball", "Swiss ball crunch"]},
  {"key": "ex:hanging-knee-raise", "label": "Hanging knee raise", "aliases": ["Hanging knee raises"]},
  {"key": "ex:hanging-leg-raise", "label": "Hanging leg raise", "aliases": ["Hanging leg raises", "Hanging straight leg raise"]},
  {"key": "ex:dead-bug", "label": "Dead bug", "aliases": ["Dead bugs", "Deadbug"]},
  {"key": "ex:bird-dog", "label": "Bird dog", "aliases": ["Bird dogs", "Birddog"]},
  {"key": "ex:crunch-machine", "label": "Crunch machine", "aliases": ["Seated crunch machine", "Abdominal crunch machine", "Ab crunch machine"]},
  {"key": "ex:vertical-leg-crunch", "label": "Vertical leg crunch", "aliases": ["Vertical leg crunches"]},
  {"key": "ex:kneeling-cable-wood-chop", "label": "Kneeling cable wood chop", "aliases": ["Kneeling wood chop cable"]},
  {"key": "ex:plank-walkup", "label": "Plank walkup", "aliases": ["Plank walk up", "Plank up down", "Up down plank"]},
  {"key": "ex:trx-row", "label": "TRX row", "aliases": ["TRX back row", "TRX rows", "Suspension trainer row"]},
  {"key": "ex:trx-biceps-curl", "label": "TRX biceps curl", "aliases": ["TRX bicep curl", "TRX biceps curls"]},
  {"key": "ex:trx-chest-press", "label": "TRX chest press", "aliases": ["Suspension trainer chest press"]},
  {"key": "ex:trx-triceps-extension", "label": "TRX overhead triceps extension", "aliases": ["TRX triceps extension", "TRX overhead tricep extension"]},
  {"key": "ex:trx-hamstring-curl", "label": "TRX hamstring curl", "aliases": ["TRX hamstrings curl", "TRX hamstring curls"]},
  {"key": "ex:trx-squat", "label": "TRX squat", "aliases": ["TRX squats", "Suspension trainer squat"]},
  {"key": "ex:kettlebell-clean-and-press", "label": "Kettlebell clean and press", "aliases": ["Kettlebell clean press"]},
  {"key": "ex:single-arm-kettlebell-overhead-press", "label": "Single-arm kettlebell overhead press", "aliases": ["Single arm overhead press kettlebell"]},
  {"key": "ex:kettlebell-halo", "label": "Kettlebell halo", "aliases": ["Kettlebell halos", "Halo kettlebell"]},
  {"key": "ex:incline-push-up", "label": "Incline push-up", "aliases": ["Incline push ups", "Incline pushup"]},
  {"key": "ex:decline-push-up", "label": "Decline push-up", "aliases": ["Decline push ups", "Decline pushup"]},
  {"key": "ex:kneeling-push-up", "label": "Kneeling push-up", "aliases": ["Knee push up", "Bent knee push up", "Kneeling push ups"]},
  {"key": "ex:pike-push-up", "label": "Pike push-up", "aliases": ["Pike push ups", "Pike pushup"]},
  {"key": "ex:plyometric-push-up", "label": "Plyometric push-up", "aliases": ["Plyometric push ups", "Clapping push up", "Clap push up"]},
  {"key": "ex:bench-dip", "label": "Bench dip", "aliases": ["Bench dips"]},
  {"key": "ex:parallel-bar-dip", "label": "Parallel-bar dip", "aliases": ["Parallel bar dips"]},
].map(item => Object.freeze({ ...item, aliases: Object.freeze(item.aliases) })));

export function normalizeExerciseName(name) {
  if (typeof name !== 'string') return '';
  const base = name.normalize('NFKC').toLowerCase();
  const normalized = base.replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  // Ook bestaande namen die alleen uit emoji/symbolen bestaan blijven bruikbaar.
  return normalized || base.trim().replace(/\s+/gu, ' ');
}

const byKey = new Map(EXERCISE_CATALOG.map(item => [item.key, item]));
const byAlias = new Map();
for (const item of EXERCISE_CATALOG) {
  for (const alias of [item.label, ...item.aliases]) {
    const normalized = normalizeExerciseName(alias);
    if (byAlias.has(normalized) && byAlias.get(normalized).key !== item.key) {
      throw new Error('Een oefenalias mag niet bij verschillende ranglijsten horen.');
    }
    byAlias.set(normalized, item);
  }
}

export function detectExercise(name) {
  return byAlias.get(normalizeExerciseName(name)) ?? null;
}

export function resolveRankingExercise(exercise) {
  const known = byKey.get(exercise?.rankingKey) ?? detectExercise(exercise?.name);
  if (known) return { key: known.key, label: known.label };
  const normalized = normalizeExerciseName(exercise?.name);
  const key = `custom:${normalized}`;
  if (!normalized || key.length > 4096) throw new Error('Deze oefennaam kan niet als ranglijstnaam worden gebruikt.');
  const capitalized = normalized.charAt(0).toUpperCase() + normalized.slice(1);
  // Sommige hoofdletters breiden uit (ß → SS); het label mag de identiteit niet wijzigen.
  const label = normalizeExerciseName(capitalized) === normalized ? capitalized : normalized;
  return { key, label };
}

export function suggestExercises(query) {
  const normalized = normalizeExerciseName(query);
  if (!normalized) return [];
  const words = normalized.split(/\s+/u);
  return EXERCISE_CATALOG.filter(item => [item.label, ...item.aliases]
    .some(alias => words.every(word => normalizeExerciseName(alias).includes(word)))).slice(0, 8);
}
