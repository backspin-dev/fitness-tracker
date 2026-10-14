import { detectExercise } from './exercise-catalog.js';

// Gecontroleerd op 14 oktober 2026; volledige broncontrole staat in video-sources.json.
// Alleen verwijzingen: de video's worden nooit lokaal opgeslagen.
export const EXERCISE_VIDEOS = Object.freeze(Object.fromEntries(Object.entries({
  "ex:squat": {
    "id": "l83R5PblSMA",
    "source": "PureGym"
  },
  "ex:back-squat": {
    "id": "rrJIyZGlK8c",
    "source": "PureGym"
  },
  "ex:front-squat": {
    "id": "Q1Ypb8ZNzI4",
    "source": "PureGym"
  },
  "ex:goblet-squat": {
    "id": "zBV3ceGyAxw",
    "source": "PureGym"
  },
  "ex:leg-press": {
    "id": "qCR9bN3G1t4",
    "source": "PureGym"
  },
  "ex:leg-extension": {
    "id": "4ZDm5EbiFI8",
    "source": "PureGym"
  },
  "ex:seated-leg-curl": {
    "id": "_2Kd0d-JEUM",
    "source": "NASM"
  },
  "ex:lying-leg-curl": {
    "id": "SbSNUXPRkc8",
    "source": "PureGym"
  },
  "ex:standing-calf-raise-machine": {
    "id": "g_E7_q1z2bo",
    "source": "Hammer Strength"
  },
  "ex:deadlift": {
    "id": "GxsLrTzyGUU",
    "source": "PureGym"
  },
  "ex:romanian-deadlift": {
    "id": "zU-f6DMCdAI",
    "source": "PureGym"
  },
  "ex:bench-press": {
    "id": "CjHIKDQ4RQo",
    "source": "PureGym"
  },
  "ex:dumbbell-bench-press": {
    "id": "AduT4Eq-iP0",
    "source": "PureGym"
  },
  "ex:bench-press-machine": {
    "id": "kPi1grOKflU",
    "source": "Life Fitness / Hammer Strength"
  },
  "ex:incline-bench-press": {
    "id": "2jFFCy8JBU8",
    "source": "PureGym"
  },
  "ex:incline-dumbbell-bench-press": {
    "id": "oZVCBM9f8Eo",
    "source": "PureGym"
  },
  "ex:chest-press-machine": {
    "id": "CIykDiF4sfg",
    "source": "PureGym"
  },
  "ex:chest-fly-machine": {
    "id": "eGjt4lk6g34",
    "source": "PureGym"
  },
  "ex:dumbbell-chest-fly": {
    "id": "Nhvz9EzdJ4U",
    "source": "PureGym"
  },
  "ex:shoulder-press-machine": {
    "id": "GcY6TZxfS0k",
    "source": "PureGym"
  },
  "ex:dumbbell-shoulder-press": {
    "id": "aI2hGzsAMXs",
    "source": "PureGym"
  },
  "ex:barbell-overhead-press": {
    "id": "Y0Bxr57uPbk",
    "source": "PureGym"
  },
  "ex:dumbbell-lateral-raise": {
    "id": "z-kOn7flIZg",
    "source": "PureGym"
  },
  "ex:lat-pulldown": {
    "id": "JGeRYIZdojU",
    "source": "PureGym"
  },
  "ex:pull-up": {
    "id": "PHdHnZcbsB8",
    "source": "PureGym"
  },
  "ex:seated-cable-row": {
    "id": "k0cTJCfxa0Y",
    "source": "NASM"
  },
  "ex:barbell-row": {
    "id": "FsK19s8eGFs",
    "source": "PureGym"
  },
  "ex:dumbbell-row": {
    "id": "ZRSGpBUVcNw",
    "source": "PureGym"
  },
  "ex:barbell-biceps-curl": {
    "id": "N5x5M1x1Gd0",
    "source": "PureGym"
  },
  "ex:dumbbell-biceps-curl": {
    "id": "MtXdEcW3Eog",
    "source": "PureGym"
  },
  "ex:triceps-pushdown-bar": {
    "id": "LXkCrxn3caQ",
    "source": "PureGym"
  },
  "ex:triceps-pushdown-rope": {
    "id": "DdLwDdTSGoY",
    "source": "Exercise.com"
  },
  "ex:skull-crusher": {
    "id": "sDxcKjCqXAo",
    "source": "PureGym"
  },
  "ex:push-up": {
    "id": "Env8gAr_QnE",
    "source": "PureGym"
  },
  "ex:bodyweight-squat": {
    "id": "l83R5PblSMA",
    "source": "PureGym"
  },
  "ex:prisoner-squat": {
    "id": "bAhzgJ5Ayu0",
    "source": "PureGym"
  },
  "ex:jump-squat": {
    "id": "BRfxI2Es2lE",
    "source": "PureGym"
  },
  "ex:sumo-squat": {
    "id": "qiQAsB0x-7k",
    "source": "PureGym"
  },
  "ex:dumbbell-sumo-squat": {
    "id": "vBA3vyOxJv0",
    "source": "OPEX Fitness"
  },
  "ex:dumbbell-front-squat": {
    "id": "hZI8Yy5elZs",
    "source": "NASM"
  },
  "ex:kettlebell-front-squat": {
    "id": "OCTkFBXqsnw",
    "source": "OPEX Fitness"
  },
  "ex:dumbbell-goblet-squat": {
    "id": "2LnkzQ7paAc",
    "source": "IronmasterPro"
  },
  "ex:kettlebell-goblet-squat": {
    "id": "MWHIs0zxkCU",
    "source": "NASM"
  },
  "ex:single-leg-squat": {
    "id": "sSXnaFyhiZs",
    "source": "NASM"
  },
  "ex:bulgarian-split-squat": {
    "id": "TEXl2b3__S4",
    "source": "PureGym"
  },
  "ex:dumbbell-bulgarian-split-squat": {
    "id": "hbw7hdyOpq0",
    "source": "NASM"
  },
  "ex:bodyweight-split-squat": {
    "id": "rlvpaDkc76g",
    "source": "PureGym"
  },
  "ex:forward-lunge": {
    "id": "g8-Ge9S0aUw",
    "source": "PureGym"
  },
  "ex:reverse-lunge": {
    "id": "xrPteyQLGAo",
    "source": "PureGym"
  },
  "ex:lateral-lunge": {
    "id": "apsp_uuXZTU",
    "source": "PureGym"
  },
  "ex:barbell-forward-lunge": {
    "id": "jfE5UTunYik",
    "source": "Rehab My Patient"
  },
  "ex:dumbbell-forward-lunge": {
    "id": "TbZinOXXfdQ",
    "source": "thecscca"
  },
  "ex:dumbbell-lateral-lunge": {
    "id": "R8jArZG2J6Q",
    "source": "Live Lean TV"
  },
  "ex:dumbbell-step-up": {
    "id": "DxUNi119Qzs",
    "source": "PureGym"
  },
  "ex:bodyweight-step-up": {
    "id": "RbRFci8p1m8",
    "source": "Live Lean TV"
  },
  "ex:single-leg-press": {
    "id": "sxF9BcDt-yY",
    "source": "PureGym"
  },
  "ex:leg-press-calf-raise": {
    "id": "8k435cj30gc",
    "source": "NASM"
  },
  "ex:glute-bridge": {
    "id": "tqp5XQPpTxY",
    "source": "PureGym"
  },
  "ex:barbell-glute-bridge": {
    "id": "DQv1IMQDbE4",
    "source": "PureGym"
  },
  "ex:barbell-hip-thrust": {
    "id": "aweBS7K71l8",
    "source": "PureGym"
  },
  "ex:side-lying-hip-abduction": {
    "id": "k9VpIODjZbM",
    "source": "Peak Physio"
  },
  "ex:quadruped-hip-extension": {
    "id": "EtSJ8rwm5M8",
    "source": "PureGym"
  },
  "ex:glute-press-machine": {
    "id": "GzlnMzInqyI",
    "source": "NDSU Wellness Center"
  },
  "ex:dumbbell-romanian-deadlift": {
    "id": "V8Hdl1FiNt4",
    "source": "NASM"
  },
  "ex:kettlebell-deadlift": {
    "id": "LnIMaf-XOpM",
    "source": "NASM"
  },
  "ex:barbell-good-morning": {
    "id": "nWyx81AfTos",
    "source": "PureGym"
  },
  "ex:stability-ball-leg-curl": {
    "id": "Kk8dpH4ZPos",
    "source": "oxygenmagazine"
  },
  "ex:standing-band-hip-abduction": {
    "id": "iz_5KPL4JsY",
    "source": "SoheeFit"
  },
  "ex:close-grip-bench-press": {
    "id": "DzA2xZhDGeo",
    "source": "PureGym"
  },
  "ex:dumbbell-floor-press": {
    "id": "T0Y3OBF1bNI",
    "source": "PureGym"
  },
  "ex:single-arm-dumbbell-bench-press": {
    "id": "Os9UeL_YZPw",
    "source": "PureGym"
  },
  "ex:single-arm-incline-dumbbell-bench-press": {
    "id": "iJ-GwVeUuCg",
    "source": "NASM"
  },
  "ex:incline-dumbbell-fly": {
    "id": "JSDpq14vCZ8",
    "source": "PureGym"
  },
  "ex:cable-crossover": {
    "id": "QcTcWpkn_bw",
    "source": "PureGym"
  },
  "ex:standing-cable-chest-fly": {
    "id": "QcTcWpkn_bw",
    "source": "PureGym"
  },
  "ex:standing-band-chest-press": {
    "id": "6-86jEAXA08",
    "source": "Live Lean TV"
  },
  "ex:standing-band-chest-fly": {
    "id": "VvW4ppf4dTQ",
    "source": "Live Lean TV"
  },
  "ex:seated-cable-chest-press": {
    "id": "MDBdAwH9yJA",
    "source": "Dumbbells & Kneads"
  },
  "ex:seated-incline-cable-press": {
    "id": "chvZZIWje0M",
    "source": "OriGym"
  },
  "ex:seated-decline-cable-press": {
    "id": "clr5462g-I8",
    "source": "OriGym"
  },
  "ex:close-grip-chest-press-machine": {
    "id": "vKZv8RkmUb8",
    "source": "MuscleDogFitness"
  },
  "ex:chin-up": {
    "id": "GXIjKfx9nF4",
    "source": "Live Lean TV"
  },
  "ex:band-assisted-pull-up": {
    "id": "B_VkNQS5YLs",
    "source": "NASM"
  },
  "ex:negative-pull-up": {
    "id": "jBSMDqs7OzM",
    "source": "PureGym"
  },
  "ex:kneeling-cable-lat-pulldown": {
    "id": "VIJPZ8m0EDM",
    "source": "PureGym"
  },
  "ex:seated-row-machine": {
    "id": "TeFo51Q_Nsc",
    "source": "PureGym"
  },
  "ex:high-row-machine": {
    "id": "beKbbq6NhWY",
    "source": "Live Lean TV"
  },
  "ex:seated-high-cable-row": {
    "id": "djm3ruOvtZg",
    "source": "TYTAX"
  },
  "ex:standing-band-row": {
    "id": "qykwviNOIyc",
    "source": "NASM"
  },
  "ex:single-arm-cable-row": {
    "id": "_HuCbiiHGk0",
    "source": "Functional Bodybuilding"
  },
  "ex:incline-dumbbell-row": {
    "id": "Nx0TzjgsI-0",
    "source": "PureGym"
  },
  "ex:dumbbell-renegade-row": {
    "id": "Q28cLuweLv4",
    "source": "PureGym"
  },
  "ex:dumbbell-front-raise": {
    "id": "zkP0MsTcIVU",
    "source": "PureGym"
  },
  "ex:incline-dumbbell-reverse-fly": {
    "id": "6iMxSA2LeGc",
    "source": "Tap House Media"
  },
  "ex:seated-dumbbell-rear-lateral-raise": {
    "id": "nlkF7_2O_Lw",
    "source": "PureGym"
  },
  "ex:cable-diagonal-raise": {
    "id": "-VleRD3WlxU",
    "source": "Live Lean TV"
  },
  "ex:barbell-upright-row": {
    "id": "8UvsRWUb0YU",
    "source": "PureGym"
  },
  "ex:cable-face-pull": {
    "id": "0Po47vvj9g4",
    "source": "PureGym"
  },
  "ex:dumbbell-arnold-press": {
    "id": "jeJttN2EWCo",
    "source": "PureGym"
  },
  "ex:dumbbell-push-press": {
    "id": "vuaYVK8xyqo",
    "source": "NASM"
  },
  "ex:seated-dumbbell-shoulder-press": {
    "id": "tzZMsrzG_zE",
    "source": "Bodybuilding.com"
  },
  "ex:lateral-raise-machine": {
    "id": "tavibkNpZLI",
    "source": "Hammer Strength"
  },
  "ex:barbell-shrug": {
    "id": "9xGqgGFAtiM",
    "source": "Bodybuilding.com"
  },
  "ex:dumbbell-hammer-curl": {
    "id": "B4RznoFvTl4",
    "source": "PureGym"
  },
  "ex:dumbbell-concentration-curl": {
    "id": "llD6MImgqe8",
    "source": "PureGym"
  },
  "ex:incline-dumbbell-curl": {
    "id": "XVQBeug_9LU",
    "source": "PureGym"
  },
  "ex:preacher-curl": {
    "id": "Zbs3ko8ycyg",
    "source": "PureGym"
  },
  "ex:cable-biceps-curl": {
    "id": "GNlopToAZyg",
    "source": "PureGym"
  },
  "ex:ez-bar-biceps-curl": {
    "id": "S_i3SEVgKWU",
    "source": "Bodybuilding.com"
  },
  "ex:wide-grip-ez-bar-curl": {
    "id": "EK747VC37yE",
    "source": "Renaissance Periodization"
  },
  "ex:close-grip-ez-bar-curl": {
    "id": "cdmnvo3augg",
    "source": "Renaissance Periodization"
  },
  "ex:barbell-reverse-curl": {
    "id": "TUX58GM5fRQ",
    "source": "Functional Bodybuilding"
  },
  "ex:dumbbell-zottman-curl": {
    "id": "27l5XYDMNYQ",
    "source": "PureGym"
  },
  "ex:dumbbell-cross-body-curl": {
    "id": "QltplrVDy4Y",
    "source": "Functional Bodybuilding"
  },
  "ex:biceps-curl-machine": {
    "id": "rwo-3PTM8U4",
    "source": "Hammer Strength"
  },
  "ex:lying-barbell-triceps-extension": {
    "id": "BNFkT-EOeEs",
    "source": "High Performance Muscle"
  },
  "ex:dumbbell-triceps-kickback": {
    "id": "JPmbMOu4IYw",
    "source": "PureGym"
  },
  "ex:dumbbell-wrist-extension": {
    "id": "UcwgCTkVvIQ",
    "source": "PureGym"
  },
  "ex:dumbbell-wrist-flexion": {
    "id": "3VLTzIrnb5g",
    "source": "PureGym"
  },
  "ex:cable-triceps-pushdown": {
    "id": "LXkCrxn3caQ",
    "source": "PureGym"
  },
  "ex:band-triceps-extension": {
    "id": "JUhWLfrhM3M",
    "source": "Fitness Lab"
  },
  "ex:dumbbell-overhead-triceps-extension": {
    "id": "9wxRhONFsRA",
    "source": "PureGym"
  },
  "ex:crunch": {
    "id": "NnVhqMQRvmM",
    "source": "PureGym"
  },
  "ex:reverse-crunch": {
    "id": "XY8KzdDcMFg",
    "source": "PureGym"
  },
  "ex:bicycle-crunch": {
    "id": "wnuLak2onoA",
    "source": "PureGym"
  },
  "ex:stability-ball-crunch": {
    "id": "O4d3kd1ZLyc",
    "source": "PureGym"
  },
  "ex:hanging-knee-raise": {
    "id": "O7iDA3ory-w",
    "source": "PureGym"
  },
  "ex:hanging-leg-raise": {
    "id": "Yrtvs-nEnk0",
    "source": "PureGym"
  },
  "ex:dead-bug": {
    "id": "bxn9FBrt4-A",
    "source": "NASM"
  },
  "ex:bird-dog": {
    "id": "ZdAHe9_HeEw",
    "source": "NASM"
  },
  "ex:crunch-machine": {
    "id": "yUHmHlVdVqM",
    "source": "Hammer Strength"
  },
  "ex:vertical-leg-crunch": {
    "id": "c3soR1Co6Ik",
    "source": "University of Northern Colorado Cancer Rehabilitation Institute"
  },
  "ex:kneeling-cable-wood-chop": {
    "id": "aGu3CfE3LG0",
    "source": "Olly Foster Fitness"
  },
  "ex:plank-walkup": {
    "id": "6Tv4xTRPtUc",
    "source": "NASM"
  },
  "ex:trx-row": {
    "id": "yCuSGoe1gjY",
    "source": "PureGym"
  },
  "ex:trx-biceps-curl": {
    "id": "yLeI25qpD5k",
    "source": "Rowan-Virtua SOM"
  },
  "ex:trx-chest-press": {
    "id": "-vPgHzuRI7I",
    "source": "TRXtraining"
  },
  "ex:trx-triceps-extension": {
    "id": "ZwuG20LhsNA",
    "source": "CU Anschutz Health and Wellness Center"
  },
  "ex:trx-hamstring-curl": {
    "id": "OIEAPz61114",
    "source": "ExperienceLifeMag"
  },
  "ex:trx-squat": {
    "id": "DTXphTGYd0g",
    "source": "TRXtraining"
  },
  "ex:kettlebell-clean-and-press": {
    "id": "0JVD6dnJmvA",
    "source": "Xceed Fitness"
  },
  "ex:single-arm-kettlebell-overhead-press": {
    "id": "X-uFqWtjpGI",
    "source": "NASM"
  },
  "ex:kettlebell-halo": {
    "id": "03XkGQlZ1eE",
    "source": "OriGym"
  },
  "ex:incline-push-up": {
    "id": "yAbg3_pJKvw",
    "source": "PureGym"
  },
  "ex:decline-push-up": {
    "id": "QBlYp-EwHlo",
    "source": "PureGym"
  },
  "ex:kneeling-push-up": {
    "id": "X9sGmsGYYE0",
    "source": "PureGym"
  },
  "ex:pike-push-up": {
    "id": "9NLyrC2joJs",
    "source": "PureGym"
  },
  "ex:plyometric-push-up": {
    "id": "Y-uF4F3mQIs",
    "source": "Goodlife Health Clubs"
  },
  "ex:bench-dip": {
    "id": "qrS6aa0aQ9I",
    "source": "PureGym"
  },
  "ex:parallel-bar-dip": {
    "id": "2HYAeF6o7Bc",
    "source": "PureGym"
  },
  "ex:smith-machine-squat": {
    "id": "nUUWWjISN4M",
    "source": "E3 Rehab Exercise Library"
  },
  "ex:hack-squat-machine": {
    "id": "scs5XcsZuc8",
    "source": "PureGym"
  },
  "ex:hip-thrust-machine": {
    "id": "EAdDjw-k3ow",
    "source": "Life Fitness / Hammer Strength"
  },
  "ex:hip-abduction-machine": {
    "id": "G_8LItOiZ0Q",
    "source": "PureGym"
  },
  "ex:hip-adduction-machine": {
    "id": "CjAVezAggkI",
    "source": "PureGym"
  },
  "ex:seated-calf-raise-machine": {
    "id": "UoYD9G2zSMo",
    "source": "Hammer Strength"
  },
  "ex:smith-machine-calf-raise": {
    "id": "iCffD_VzWEw",
    "source": "UniSC Sport and Fitness"
  },
  "ex:standing-dumbbell-calf-raise": {
    "id": "wxwY7GXxL4k",
    "source": "Bodybuilding.com"
  },
  "ex:sumo-deadlift": {
    "id": "JbY72Him34Q",
    "source": "PureGym"
  },
  "ex:dumbbell-deadlift": {
    "id": "plb5jEO4Unw",
    "source": "PureGym"
  },
  "ex:trap-bar-deadlift": {
    "id": "FYx76NSijfU",
    "source": "OPEX Fitness"
  },
  "ex:smith-machine-hip-thrust": {
    "id": "BakGsAociA4",
    "source": "OPEX Fitness"
  },
  "ex:dumbbell-walking-lunge": {
    "id": "8fZxWTiIJWo",
    "source": "OPEX Fitness"
  },
  "ex:cable-glute-kickback": {
    "id": "SqO-VUEak2M",
    "source": "PureGym"
  },
  "ex:nordic-hamstring-curl": {
    "id": "Wo746janD2E",
    "source": "PureGym"
  },
  "ex:dumbbell-hip-thrust": {
    "id": "ETnhBWeWK74",
    "source": "PureGym"
  },
  "ex:bodyweight-hip-thrust": {
    "id": "7XuNzi5rcj4",
    "source": "PureGym"
  },
  "ex:single-leg-bodyweight-hip-thrust": {
    "id": "1u-b25VJVFU",
    "source": "PureGym"
  },
  "ex:standing-cable-hip-abduction": {
    "id": "bGlm-qTnfTI",
    "source": "Live Lean TV"
  },
  "ex:standing-cable-hip-adduction": {
    "id": "SIQrpq6YnT8",
    "source": "Live Lean TV"
  },
  "ex:smith-machine-romanian-deadlift": {
    "id": "RkXbWR9dkic",
    "source": "E3 Rehab Exercise Library"
  },
  "ex:dumbbell-reverse-lunge": {
    "id": "Q2k3kYbtOcI",
    "source": "OPEX Fitness"
  },
  "ex:barbell-walking-lunge": {
    "id": "bdbJ_aRjw-4",
    "source": "OPEX Fitness"
  },
  "ex:seated-dumbbell-calf-raise": {
    "id": "wrJmt5Keixs",
    "source": "canfitpro"
  },
  "ex:cable-lateral-raise": {
    "id": "Z5FA9aq3L6A",
    "source": "PureGym"
  },
  "ex:standing-cable-rear-delt-fly": {
    "id": "AAO_hLyDSb4",
    "source": "Delta Fitness"
  },
  "ex:smith-machine-bench-press": {
    "id": "jAFsVr-Hvsg",
    "source": "Rehab My Patient"
  },
  "ex:smith-machine-incline-bench-press": {
    "id": "rUU6_IJQ8FE",
    "source": "Rehab My Patient"
  },
  "ex:dumbbell-pullover": {
    "id": "CSkSflHdC3A",
    "source": "OPEX Fitness"
  },
  "ex:seated-dip-machine": {
    "id": "z0vMii76jRo",
    "source": "Trifocus Fitness Academy"
  },
  "ex:assisted-machine-dip": {
    "id": "kXoW6ViMKko",
    "source": "North East Derbyshire District Council"
  },
  "ex:assisted-machine-pull-up": {
    "id": "wFj808u2HWU",
    "source": "PureGym"
  },
  "ex:straight-arm-cable-pulldown": {
    "id": "ey9Fv3FGrRg",
    "source": "PureGym"
  },
  "ex:v-bar-lat-pulldown": {
    "id": "IjoFCmLX7z0",
    "source": "PureGym"
  },
  "ex:reverse-grip-cable-lat-pulldown": {
    "id": "SNiwpA13ZLU",
    "source": "PureGym"
  },
  "ex:cable-rope-hammer-curl": {
    "id": "8y2DQWWX8V4",
    "source": "OriGym"
  },
  "ex:cable-rope-overhead-triceps-extension": {
    "id": "mRozZKkGIfg",
    "source": "Bodybuilding.com"
  },
  "ex:dumbbell-shrug": {
    "id": "Ni-uEQCZxOo",
    "source": "Rehab My Patient"
  },
  "ex:dumbbell-preacher-curl": {
    "id": "zuEfTs3R3yo",
    "source": "OPEX Fitness"
  },
  "ex:decline-barbell-bench-press": {
    "id": "wZmyndA1bPg",
    "source": "E3 Rehab Exercise Library"
  },
  "ex:decline-dumbbell-bench-press": {
    "id": "4R_GwRhG0rY",
    "source": "PureGym"
  },
  "ex:cable-upright-row": {
    "id": "WNz7O59GORA",
    "source": "PureGym"
  },
  "ex:dumbbell-upright-row": {
    "id": "Rd5AsxOGqss",
    "source": "PureGym"
  },
  "ex:cable-front-raise": {
    "id": "vtH93qBItdk",
    "source": "PureGym"
  },
  "ex:cable-triceps-kickback": {
    "id": "ZvF4Oi_6Vtg",
    "source": "Live Lean TV"
  },
  "ex:chest-supported-t-bar-row": {
    "id": "CRpez9nWVH0",
    "source": "Prep Coach UK"
  },
  "ex:landmine-t-bar-row": {
    "id": "hYo72r8Ivso",
    "source": "PureGym"
  },
  "ex:single-arm-landmine-shoulder-press": {
    "id": "qPxvgth0dQQ",
    "source": "PureGym"
  },
  "ex:seated-smith-machine-shoulder-press": {
    "id": "eODNI4s18J4",
    "source": "Rehab My Patient"
  },
  "ex:low-row-machine": {
    "id": "9ZZjoyYr-Oo",
    "source": "Live Lean TV"
  },
  "ex:reverse-fly-machine": {
    "id": "WOi0cWmEMdo",
    "source": "Trifocus Fitness Academy"
  },
  "ex:bodyweight-russian-twist": {
    "id": "99T1EfpMwPA",
    "source": "PureGym"
  },
  "ex:dumbbell-russian-twist": {
    "id": "ZDQcxDR-fW0",
    "source": "24Life"
  },
  "ex:kneeling-cable-crunch": {
    "id": "3qjoXDTuyOE",
    "source": "Bodybuilding.com"
  },
  "ex:ab-wheel-rollout": {
    "id": "SBO5aFR09D4",
    "source": "PureGym"
  },
  "ex:45-degree-back-extension": {
    "id": "RaIXjcndM94",
    "source": "Functional Bodybuilding"
  },
  "ex:back-extension-machine": {
    "id": "4sla2xidkD0",
    "source": "Hammer Strength"
  },
  "ex:superman": {
    "id": "kTMBsUwEGPM",
    "source": "PureGym"
  },
  "ex:sit-up": {
    "id": "onaQ0v_J5uU",
    "source": "Nuffield Health"
  },
  "ex:decline-sit-up": {
    "id": "N7hf1_vcX5w",
    "source": "PureGym"
  },
  "ex:butterfly-sit-up": {
    "id": "ZLyOWSPnVrM",
    "source": "PureGym"
  },
  "ex:v-up": {
    "id": "cSCyyfBti7U",
    "source": "PureGym"
  },
  "ex:tuck-up": {
    "id": "vb6DC9_NDcE",
    "source": "Functional Bodybuilding"
  },
  "ex:lying-leg-raise": {
    "id": "Wp4BlxcFTkE",
    "source": "LivestrongWoman"
  },
  "ex:seated-knee-tuck": {
    "id": "d_up4yEZhFI",
    "source": "Live Lean TV"
  },
  "ex:flutter-kick": {
    "id": "parOR2UTVw0",
    "source": "FITNESS Magazine"
  },
  "ex:horizontal-scissor-kick": {
    "id": "6d8Xm0wnosY",
    "source": "Cantrell Wellness Center"
  },
  "ex:alternating-heel-touch": {
    "id": "hn3l6tcXxFc",
    "source": "PowerMonkeyFitness"
  },
  "ex:standing-cable-wood-chop": {
    "id": "iTmMPyDzeYA",
    "source": "Bodybuilding.com"
  },
  "ex:standing-cable-pallof-press": {
    "id": "syYBcVbEAFk",
    "source": "OPEX Fitness"
  },
  "ex:plank-shoulder-tap": {
    "id": "g3bsSUOn-vo",
    "source": "E3 Rehab Exercise Library"
  },
  "ex:plank-jack": {
    "id": "PR9nHQXCZMo",
    "source": "FitnessBlender"
  },
  "ex:mountain-climber": {
    "id": "kLh-uczlPLg",
    "source": "PureGym"
  },
  "ex:burpee": {
    "id": "1yPltRIm59E",
    "source": "PureGym"
  },
  "ex:jumping-jack": {
    "id": "uLVt6u15L98",
    "source": "NASM"
  }
}).map(([key, video]) => [key, Object.freeze(video)])));

export function getExerciseVideo(exercise, videos = EXERCISE_VIDEOS) {
  const known = detectExercise(exercise?.name);
  const video = known && videos[known.key];
  return video && /^[A-Za-z0-9_-]{11}$/u.test(video.id) && typeof video.source === 'string' && video.source.trim()
    ? { ...video, key: known.key, exercise: known.label } : null;
}
