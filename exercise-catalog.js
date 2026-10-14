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
  {"key": "ex:squat", "label": "Squat", "aliases": ["Squats"]},
  {"key": "ex:back-squat", "label": "Back squat", "aliases": ["Back squats", "Barbell back squat", "Barbell back squats"]},
  {"key": "ex:front-squat", "label": "Front squat", "aliases": ["Front squats", "Barbell front squat", "Barbell front squats"]},
  {"key": "ex:goblet-squat", "label": "Goblet squat", "aliases": ["Goblet squats"]},
  {"key": "ex:leg-press", "label": "Leg press", "aliases": ["Legpress", "Leg press machine", "Leg press apparaat", "Benenpers"]},
  {"key": "ex:leg-extension", "label": "Leg extension", "aliases": ["Leg extensions", "Leg extension machine", "Leg extension apparaat"]},
  {"key": "ex:seated-leg-curl", "label": "Seated leg curl", "aliases": ["Seated leg curls", "Seated leg curl machine", "Zittende leg curl"]},
  {"key": "ex:lying-leg-curl", "label": "Lying leg curl", "aliases": ["Lying leg curls", "Lying leg curl machine", "Liggende leg curl"]},
  {"key": "ex:standing-calf-raise-machine", "label": "Standing calf raise machine", "aliases": ["Standing calf raises machine", "Standing calf raise apparaat"]},
  {"key": "ex:deadlift", "label": "Deadlift", "aliases": ["Deadlifts"]},
  {"key": "ex:romanian-deadlift", "label": "Romanian deadlift", "aliases": ["Romanian deadlifts", "Roemeense deadlift", "Roemeense deadlifts", "RDL"]},
  {"key": "ex:bench-press", "label": "Bench press", "aliases": ["Benchpress", "Barbell bench press", "Bench press barbell", "Bankdrukken", "Bankdrukken halter"]},
  {"key": "ex:dumbbell-bench-press", "label": "Dumbbell bench press", "aliases": ["Dumbbell benchpress", "Bench press dumbbell", "Bench press dumbbells", "Dumbbell bankdrukken"]},
  {"key": "ex:bench-press-machine", "label": "Bench press machine", "aliases": ["Benchpress machine", "BenchPressMachine", "Bench press apparaat", "Bankdrukken machine"]},
  {"key": "ex:incline-bench-press", "label": "Incline bench press", "aliases": ["Incline bench", "Incline benchpress", "Incline barbell bench press", "Incline bench press barbell"]},
  {"key": "ex:incline-dumbbell-bench-press", "label": "Incline dumbbell bench press", "aliases": ["Incline dumbbell press", "Incline bench press dumbbell", "Incline bench press dumbbells"]},
  {"key": "ex:chest-press-machine", "label": "Chest press machine", "aliases": ["Chest press apparaat", "Chestpress machine", "Chestpress apparaat"]},
  {"key": "ex:chest-fly-machine", "label": "Chest fly machine", "aliases": ["Fly machine", "Chest fly apparaat", "Pec deck", "Pecdeck", "Butterfly machine"]},
  {"key": "ex:dumbbell-chest-fly", "label": "Dumbbell chest fly", "aliases": ["Dumbbell chest flys", "Dumbbell chest flies", "Dumbbell fly", "Dumbbell flies", "Chest fly dumbbell"]},
  {"key": "ex:shoulder-press-machine", "label": "Shoulder press machine", "aliases": ["Shoulder press apparaat", "Shoulderpress machine", "Schouderpress machine"]},
  {"key": "ex:dumbbell-shoulder-press", "label": "Dumbbell shoulder press", "aliases": ["Shoulder press dumbbell", "Shoulder press dumbbells", "Dumbbell schouderpress"]},
  {"key": "ex:barbell-overhead-press", "label": "Barbell overhead press", "aliases": ["Overhead press barbell", "Barbell shoulder press", "Shoulder press barbell"]},
  {"key": "ex:dumbbell-lateral-raise", "label": "Dumbbell lateral raise", "aliases": ["Dumbbell lateral raises", "Lateral raise dumbbell", "Lateral raises dumbbell", "Side raise dumbbell", "Side raises dumbbell", "Dumbbell side raise", "Dumbbell side raises"]},
  {"key": "ex:lat-pulldown", "label": "Lat pulldown", "aliases": ["Lat pull down", "Lat pulldowns", "Lat pull downs", "Latpulldown", "Lat pull down machine", "Lat pulldown machine", "Latpulldown machine", "Lat pull down apparaat", "Lat pulldown apparaat"]},
  {"key": "ex:pull-up", "label": "Pull-up", "aliases": ["Pull ups", "Pullups", "Pullup"]},
  {"key": "ex:seated-cable-row", "label": "Seated cable row", "aliases": ["Seated cable rows", "Cable seated row", "Zittende kabelroeien"]},
  {"key": "ex:barbell-row", "label": "Barbell row", "aliases": ["Barbell rows", "Bent over barbell row", "Bent over barbell rows", "Bent over row barbell"]},
  {"key": "ex:dumbbell-row", "label": "Dumbbell row", "aliases": ["Dumbbell rows", "One arm dumbbell row", "One arm dumbbell rows", "Dumbbell roeien"]},
  {"key": "ex:barbell-biceps-curl", "label": "Barbell biceps curl", "aliases": ["Barbell biceps curls", "Barbell curl", "Barbell curls", "Bicep curl barbell"]},
  {"key": "ex:dumbbell-biceps-curl", "label": "Dumbbell biceps curl", "aliases": ["Dumbbell biceps curls", "Dumbbell curl", "Dumbbell curls", "Bicep curl dumbbell"]},
  {"key": "ex:triceps-pushdown-bar", "label": "Triceps pushdown bar", "aliases": ["Tricep push down bar", "Triceps push down bar", "Tricep pushdown bar", "Triceps pushdown stang", "Tricep pushdown stang"]},
  {"key": "ex:triceps-pushdown-rope", "label": "Triceps pushdown rope", "aliases": ["Tricep push down rope", "Triceps push down rope", "Tricep pushdown rope", "Triceps pushdown touw", "Tricep pushdown touw"]},
  {"key": "ex:skull-crusher", "label": "Skull crusher", "aliases": ["Skull crushers", "Skullcrusher", "Skullcrushers"]},
  {"key": "ex:push-up", "label": "Push-up", "aliases": ["Push ups", "Pushup", "Pushups", "Opdrukken"]},
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
  {"key": "ex:ez-bar-biceps-curl", "label": "EZ-bar biceps curl", "aliases": ["EZ bar curl", "EZ curl", "EZ bar bicep curl", "Z bar bicep curl", "Z bar biceps curl", "Z bar curl", "Z bar curls", "Z bar bicep curls", "Z bar biceps curls", "Bicep curl Z bar", "Zbar bicep curl", "Zbar biceps curl", "EZbar bicep curl", "Biceps curl Z bar"]},
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
  {"key": "ex:smith-machine-squat", "label": "Smith machine squat", "aliases": ["Smith machine squats", "Smith squat", "Squat Smith machine", "Squat Smith apparaat"]},
  {"key": "ex:hack-squat-machine", "label": "Hack squat machine", "aliases": ["Machine hack squat", "Machine hack squats", "Hack squat apparaat", "Hack squat toestel"]},
  {"key": "ex:hip-thrust-machine", "label": "Hip thrust machine", "aliases": ["Machine hip thrust", "Machine hip thrusts", "Glute drive machine", "Machine glute drive", "Hip thrust apparaat", "Hip thrust toestel"]},
  {"key": "ex:hip-abduction-machine", "label": "Hip abduction machine", "aliases": ["Seated hip abduction machine", "Hip abductor machine", "Abductor machine", "Heupabductie machine", "Heupabductie apparaat"]},
  {"key": "ex:hip-adduction-machine", "label": "Hip adduction machine", "aliases": ["Seated hip adduction machine", "Hip adductor machine", "Adductor machine", "Heupadductie machine", "Heupadductie apparaat"]},
  {"key": "ex:seated-calf-raise-machine", "label": "Seated calf raise machine", "aliases": ["Machine seated calf raise", "Seated calf raises machine", "Seated calf raise apparaat", "Zittende kuithef machine"]},
  {"key": "ex:smith-machine-calf-raise", "label": "Smith machine calf raise", "aliases": ["Smith machine calf raises", "Smith calf raise", "Calf raise Smith machine", "Kuithef Smith machine"]},
  {"key": "ex:standing-dumbbell-calf-raise", "label": "Standing dumbbell calf raise", "aliases": ["Standing dumbbell calf raises", "Dumbbell standing calf raise", "Standing calf raise dumbbells", "Staande kuithef dumbbells"]},
  {"key": "ex:bodyweight-standing-calf-raise", "label": "Bodyweight standing calf raise", "aliases": ["Standing bodyweight calf raise", "Bodyweight standing calf raises", "Standing calf raise bodyweight", "Staande kuithef lichaamsgewicht"]},
  {"key": "ex:sumo-deadlift", "label": "Sumo deadlift", "aliases": ["Sumo deadlifts", "Barbell sumo deadlift", "Barbell sumo deadlifts", "Sumo deadlift barbell"]},
  {"key": "ex:dumbbell-deadlift", "label": "Dumbbell deadlift", "aliases": ["Dumbbell deadlifts", "Deadlift dumbbells", "Deadlift dumbbell"]},
  {"key": "ex:trap-bar-deadlift", "label": "Trap bar deadlift", "aliases": ["Trapbar deadlift", "Trap bar deadlifts", "Hex bar deadlift", "Hexbar deadlift", "Hex bar deadlifts"]},
  {"key": "ex:smith-machine-hip-thrust", "label": "Smith machine hip thrust", "aliases": ["Smith machine hip thrusts", "Hip thrust Smith machine", "Smith hip thrust"]},
  {"key": "ex:dumbbell-walking-lunge", "label": "Dumbbell walking lunge", "aliases": ["Dumbbell walking lunges", "Walking lunge dumbbells", "Walking lunges dumbbell"]},
  {"key": "ex:cable-glute-kickback", "label": "Cable glute kickback", "aliases": ["Cable glute kickbacks", "Glute kickback cable", "Cable kickback glutes", "Glute kickback kabel"]},
  {"key": "ex:nordic-hamstring-curl", "label": "Nordic hamstring curl", "aliases": ["Nordic hamstring curls", "Nordic curl", "Nordic curls", "Russian hamstring curl"]},
  {"key": "ex:dumbbell-hip-thrust", "label": "Dumbbell hip thrust", "aliases": ["Dumbbell hip thrusts", "Hip thrust dumbbell", "Hip thrust dumbbells"]},
  {"key": "ex:bodyweight-hip-thrust", "label": "Bodyweight hip thrust", "aliases": ["Bodyweight hip thrusts", "Body weight hip thrust", "Hip thrust lichaamsgewicht"]},
  {"key": "ex:single-leg-bodyweight-hip-thrust", "label": "Single-leg bodyweight hip thrust", "aliases": ["Bodyweight single leg hip thrust", "Single leg hip thrust bodyweight", "Eenbenige hip thrust lichaamsgewicht"]},
  {"key": "ex:standing-cable-hip-abduction", "label": "Standing cable hip abduction", "aliases": ["Cable standing hip abduction", "Cable hip abduction", "Standing hip abduction cable", "Heupabductie kabel"]},
  {"key": "ex:standing-cable-hip-adduction", "label": "Standing cable hip adduction", "aliases": ["Cable standing hip adduction", "Cable hip adduction", "Standing hip adduction cable", "Heupadductie kabel"]},
  {"key": "ex:smith-machine-romanian-deadlift", "label": "Smith machine Romanian deadlift", "aliases": ["Smith machine RDL", "Romanian deadlift Smith machine", "Smith Romanian deadlift"]},
  {"key": "ex:dumbbell-reverse-lunge", "label": "Dumbbell reverse lunge", "aliases": ["Dumbbell reverse lunges", "Reverse lunge dumbbells", "Dumbbell rear lunge", "Achterwaartse lunge dumbbells"]},
  {"key": "ex:barbell-walking-lunge", "label": "Barbell walking lunge", "aliases": ["Barbell walking lunges", "Walking lunge barbell", "Walking lunges barbell"]},
  {"key": "ex:seated-dumbbell-calf-raise", "label": "Seated dumbbell calf raise", "aliases": ["Seated dumbbell calf raises", "Dumbbell seated calf raise", "Seated calf raise dumbbells", "Zittende kuithef dumbbells"]},
  {"key": "ex:cable-lateral-raise", "label": "Cable lateral raise", "aliases": ["Cable lateral raises", "Lateral raise cable", "Lateral raises cable", "Cable side raise", "Cable side raises"]},
  {"key": "ex:standing-cable-rear-delt-fly", "label": "Standing cable rear delt fly", "aliases": ["Standing cable rear delt flyes", "Standing cable rear delt flies", "Standing cable reverse fly", "Cable rear delt fly standing"]},
  {"key": "ex:smith-machine-bench-press", "label": "Smith machine bench press", "aliases": ["Smith bench press", "Smith machine flat bench press", "Bench press Smith machine", "Smith machine bankdrukken"]},
  {"key": "ex:smith-machine-incline-bench-press", "label": "Smith machine incline bench press", "aliases": ["Incline Smith machine bench press", "Smith incline bench press", "Smith machine incline press", "Incline bench press Smith machine"]},
  {"key": "ex:dumbbell-pullover", "label": "Dumbbell pullover", "aliases": ["Dumbbell pull over", "Dumbbell pullovers", "Pullover dumbbell"]},
  {"key": "ex:seated-dip-machine", "label": "Seated dip machine", "aliases": ["Seated machine dip", "Seated machine dips", "Machine seated dip", "Seated dip apparaat", "Zittende dip machine"]},
  {"key": "ex:assisted-machine-dip", "label": "Assisted machine dip", "aliases": ["Machine assisted dip", "Machine assisted dips", "Assisted dip machine", "Assisted dips machine", "Dip assist machine"]},
  {"key": "ex:assisted-machine-pull-up", "label": "Assisted machine pull-up", "aliases": ["Machine assisted pull up", "Machine assisted pull ups", "Assisted pull up machine", "Assisted pull ups machine", "Pull up assist machine"]},
  {"key": "ex:straight-arm-cable-pulldown", "label": "Straight-arm cable pulldown", "aliases": ["Straight arm cable pull down", "Straight arm lat pulldown", "Straight arm lat pull down", "Cable straight arm pulldown"]},
  {"key": "ex:v-bar-lat-pulldown", "label": "V-bar lat pulldown", "aliases": ["V bar lat pull down", "V bar lat pulldowns", "Close grip V bar lat pulldown", "V handle lat pulldown"]},
  {"key": "ex:reverse-grip-cable-lat-pulldown", "label": "Reverse-grip cable lat pulldown", "aliases": ["Reverse grip lat pulldown", "Reverse grip lat pull down", "Underhand cable lat pulldown", "Underhand lat pulldown"]},
  {"key": "ex:cable-rope-hammer-curl", "label": "Cable rope hammer curl", "aliases": ["Cable rope hammer curls", "Rope cable hammer curl", "Rope hammer curl cable"]},
  {"key": "ex:cable-rope-overhead-triceps-extension", "label": "Cable rope overhead triceps extension", "aliases": ["Cable rope overhead tricep extension", "Overhead cable rope triceps extension", "Overhead triceps extension cable rope", "Cable rope overhead triceps extensions"]},
  {"key": "ex:dumbbell-shrug", "label": "Dumbbell shrug", "aliases": ["Dumbbell shrugs", "Shrug dumbbell", "Shrugs dumbbell"]},
  {"key": "ex:dumbbell-preacher-curl", "label": "Dumbbell preacher curl", "aliases": ["Dumbbell preacher curls", "Preacher curl dumbbell", "Preacher curls dumbbell"]},
  {"key": "ex:decline-barbell-bench-press", "label": "Decline barbell bench press", "aliases": ["Barbell decline bench press", "Decline bench press barbell", "Decline barbell press"]},
  {"key": "ex:decline-dumbbell-bench-press", "label": "Decline dumbbell bench press", "aliases": ["Decline dumbbell press", "Dumbbell decline bench press", "Decline bench press dumbbells"]},
  {"key": "ex:cable-upright-row", "label": "Cable upright row", "aliases": ["Cable upright rows", "Upright row cable", "Upright rows cable"]},
  {"key": "ex:dumbbell-upright-row", "label": "Dumbbell upright row", "aliases": ["Dumbbell upright rows", "Upright row dumbbell", "Upright rows dumbbells"]},
  {"key": "ex:cable-front-raise", "label": "Cable front raise", "aliases": ["Cable front raises", "Front raise cable", "Front raises cable"]},
  {"key": "ex:cable-triceps-kickback", "label": "Cable triceps kickback", "aliases": ["Cable tricep kickback", "Triceps kickback cable", "Cable triceps kickbacks", "Single arm cable triceps kickback"]},
  {"key": "ex:chest-supported-t-bar-row", "label": "Chest-supported T-bar row", "aliases": ["Chest supported T bar rows", "Chest supported Tbar row", "T bar row chest supported", "Chest supported T bar machine row"]},
  {"key": "ex:landmine-t-bar-row", "label": "Landmine T-bar row", "aliases": ["Landmine T bar rows", "T bar landmine row", "Tbar landmine row", "Landmine row"]},
  {"key": "ex:single-arm-landmine-shoulder-press", "label": "Single-arm landmine shoulder press", "aliases": ["Single arm landmine press", "One arm landmine shoulder press", "Single arm landmine shoulder presses"]},
  {"key": "ex:seated-smith-machine-shoulder-press", "label": "Seated Smith machine shoulder press", "aliases": ["Smith machine seated shoulder press", "Seated Smith shoulder press", "Seated Smith machine overhead press"]},
  {"key": "ex:low-row-machine", "label": "Low row machine", "aliases": ["Machine low row", "Lowrow machine", "Low row apparaat", "Lowrow apparaat", "Low row toestel", "Hammer Strength low row", "Iso-lateral low row"]},
  {"key": "ex:reverse-fly-machine", "label": "Reverse fly machine", "aliases": ["Machine reverse fly", "Machine reverse flyes", "Machine reverse flies", "Reverse fly apparaat", "Reverse fly toestel", "Reverse pec deck", "Reverse pec-deck machine", "Rear delt fly machine", "Machine rear delt fly", "Rear delt fly apparaat", "Reverse butterfly machine", "Omgekeerde butterfly machine"]},
  {"key": "ex:bodyweight-russian-twist", "label": "Bodyweight Russian twist", "aliases": ["Bodyweight Russian twists", "Russische twist zonder gewicht"]},
  {"key": "ex:dumbbell-russian-twist", "label": "Dumbbell Russian twist", "aliases": ["Dumbbell Russian twists", "Russian twist dumbbell", "Russian twist met dumbbell"]},
  {"key": "ex:kneeling-cable-crunch", "label": "Kneeling cable crunch", "aliases": ["Kneeling cable crunches", "Cable rope crunch", "Cable crunch", "Cable crunches", "Kabelcrunch"]},
  {"key": "ex:ab-wheel-rollout", "label": "Ab wheel rollout", "aliases": ["Ab wheel rollouts", "Ab roller rollout", "Kneeling ab wheel rollout", "Ab wheel roll out"]},
  {"key": "ex:45-degree-back-extension", "label": "45-degree back extension", "aliases": ["45 degree back extensions", "Back extension 45 degrees", "45 degree hyperextension"]},
  {"key": "ex:back-extension-machine", "label": "Back extension machine", "aliases": ["Machine back extension", "Seated back extension machine", "Rugextensie apparaat"]},
  {"key": "ex:superman", "label": "Superman", "aliases": ["Supermans", "Prone Superman", "Superman exercise"]},
  {"key": "ex:alternating-superman", "label": "Alternating Superman", "aliases": ["Alternating Supermans", "Contralateral Superman", "Opposite arm leg Superman"]},
  {"key": "ex:sit-up", "label": "Sit-up", "aliases": ["Sit ups", "Situp", "Bodyweight sit up", "Sit ups lichaamsgewicht"]},
  {"key": "ex:decline-sit-up", "label": "Decline sit-up", "aliases": ["Decline sit ups", "Decline situp", "Sit up decline bench"]},
  {"key": "ex:butterfly-sit-up", "label": "Butterfly sit-up", "aliases": ["Butterfly sit ups", "Butterfly situp"]},
  {"key": "ex:v-up", "label": "V-up", "aliases": ["V ups", "V sit up", "V sit ups"]},
  {"key": "ex:tuck-up", "label": "Tuck-up", "aliases": ["Tuck ups", "Tuck sit up", "Bent knee V up"]},
  {"key": "ex:lying-leg-raise", "label": "Lying leg raise", "aliases": ["Lying leg raises", "Supine leg raise", "Lying straight leg raise", "Liggende beenheffing"]},
  {"key": "ex:seated-knee-tuck", "label": "Seated knee tuck", "aliases": ["Seated knee tucks", "Seated leg tuck"]},
  {"key": "ex:flutter-kick", "label": "Flutter kick", "aliases": ["Flutter kicks", "Supine flutter kick", "Flutter kicks liggend"]},
  {"key": "ex:horizontal-scissor-kick", "label": "Horizontal scissor kick", "aliases": ["Horizontal scissor kicks", "Lying horizontal scissor kick", "Scissor crossover"]},
  {"key": "ex:alternating-heel-touch", "label": "Alternating heel touch", "aliases": ["Alternating heel touches", "Heel touches", "Supine heel touch", "Lying heel touch"]},
  {"key": "ex:standing-cable-wood-chop", "label": "Standing cable wood chop", "aliases": ["Standing cable woodchopper", "Cable wood chop", "Cable woodchopper", "Standing cable chop"]},
  {"key": "ex:standing-cable-pallof-press", "label": "Standing cable Pallof press", "aliases": ["Standing cable Pallof presses", "Cable Pallof press", "Pallof press cable", "Standing anti rotation cable press"]},
  {"key": "ex:plank-shoulder-tap", "label": "Plank shoulder tap", "aliases": ["Plank shoulder taps", "Tall plank shoulder taps", "High plank shoulder taps"]},
  {"key": "ex:plank-jack", "label": "Plank jack", "aliases": ["Plank jacks", "Jumping plank jack"]},
  {"key": "ex:mountain-climber", "label": "Mountain climber", "aliases": ["Mountain climbers", "Mountainclimber", "Mountainclimbers"]},
  {"key": "ex:burpee", "label": "Burpee", "aliases": ["Burpees", "Standard burpee"]},
  {"key": "ex:jumping-jack", "label": "Jumping jack", "aliases": ["Jumping jacks"]},
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

// Zoekhulp corrigeert alleen suggesties, nooit een opgeslagen naam of ranglijst.
const SEARCH_WORDS = Object.freeze({
  dumbel: 'dumbbell', dumbels: 'dumbbell', dumbell: 'dumbbell', dumbells: 'dumbbell', dumbbells: 'dumbbell',
  dumbelrow: 'dumbbell row', dumbellrow: 'dumbbell row', dumbbellrow: 'dumbbell row', bentover: 'bent over', bentoverrow: 'bent over row',
  barbel: 'barbell', barbells: 'barbell', kettlebell: 'kettlebell', kettlebel: 'kettlebell', kettlebells: 'kettlebell',
  biceps: 'bicep', triceps: 'tricep', rows: 'row', squats: 'squat', curls: 'curl', raises: 'raise',
  flys: 'fly', flyes: 'fly', flies: 'fly', lunges: 'lunge', presses: 'press', extensions: 'extension',
  one: 'single', apparaat: 'machine', toestel: 'machine', cable: 'cable', kabel: 'cable',
});
const SEARCH_HINTS = Object.freeze({ 'ex:dumbbell-row': ['Bent over dumbbell row'] });

export function normalizeExerciseSearch(value) {
  return normalizeExerciseName(value).replace(/\bpull down\b/gu, 'pulldown').replace(/\bpush down\b/gu, 'pushdown')
    .split(/\s+/u).map(word => SEARCH_WORDS[word] ?? word).join(' ');
}

// Een correct geschreven vakterm wordt nooit als typefout in een andere term gezien
// (zoals adduction/abduction: verschillende bewegingen).
const SEARCH_VOCABULARY = new Set(EXERCISE_CATALOG.flatMap(item =>
  [item.label, ...item.aliases].flatMap(name => normalizeExerciseSearch(name).split(/\s+/u))));

function oneTypingError(a, b) {
  if (a.length < 5 || b.length < 5 || Math.abs(a.length - b.length) > 1) return false;
  if (a.length === b.length) {
    const different = [...a].map((letter, index) => letter === b[index] ? -1 : index).filter(index => index >= 0);
    return different.length === 1 || different.length === 2 && different[1] === different[0] + 1 &&
      a[different[0]] === b[different[1]] && a[different[1]] === b[different[0]];
  }
  const shorter = a.length < b.length ? a : b, longer = a.length < b.length ? b : a;
  let i = 0; while (i < shorter.length && shorter[i] === longer[i]) i++;
  return shorter.slice(i) === longer.slice(i + 1);
}

export function exerciseSearchScore(query, name) {
  const needle = normalizeExerciseSearch(query), candidate = normalizeExerciseSearch(name);
  if (!needle || !candidate) return Infinity;
  const terms = candidate.split(/\s+/u);
  let errors = 0;
  for (const word of needle.split(/\s+/u)) {
    if (terms.some(term => term.startsWith(word))) continue;
    if (!SEARCH_VOCABULARY.has(word) && terms.some(term => oneTypingError(word, term))) errors++;
    else return Infinity;
  }
  if (errors) return 100 + errors * 10;
  return candidate === needle ? 0 : candidate.startsWith(needle) ? 10 : 20;
}

export function suggestExercises(query, limit = 8) {
  if (!normalizeExerciseName(query)) return [];
  return EXERCISE_CATALOG.map((item, index) => ({ item, index, score: Math.min(
    ...[item.label, ...item.aliases].map(name => exerciseSearchScore(query, name)),
    ...(SEARCH_HINTS[item.key] ?? []).map(name => exerciseSearchScore(query, name) + 5),
  ) })).filter(match => Number.isFinite(match.score))
    .sort((a, b) => a.score - b.score || a.index - b.index).slice(0, limit).map(match => match.item);
}
