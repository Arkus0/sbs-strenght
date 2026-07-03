const SLOT_FOCUS = {
  main_1: 'squat',
  aux_1: 'squat',
  aux_2: 'squat',
  main_3: 'hinge',
  aux_5: 'hinge',
  main_2: 'press',
  aux_3: 'press',
  aux_4: 'press',
  main_4: 'overhead',
  aux_6: 'overhead'
}

const UPPER_BACK_POOL = [
  {
    id: 'weighted-pull-up',
    title: 'Dominada pesada',
    prescription: '4-5 series de 4-6 dominadas lastradas o 6-8 estrictas. Descanso completo.',
    fallback: 'Jalon neutro pesado 4x8 si no hay dominada solida.',
    emphasis: 'Traccion vertical pesada sin convertir la sesion en otra biserie.',
    tags: ['vertical_pull', 'grip', 'heavy'],
    prefer: ['press', 'overhead'],
    avoid: [],
    phase: ['base', 'build'],
    fatigue: 'moderate',
    source: 'EDC/Powerbuilder: weighted pull-ups, chin-ups.'
  },
  {
    id: 'chest-supported-row',
    title: 'Remo pecho apoyado',
    prescription: '4 series de 8-12 reps pesado y estricto.',
    fallback: 'Seal row, remo en maquina o remo con mancuerna apoyado.',
    emphasis: 'Espalda alta y lats sin cargar erectores tras sentadilla/deadlift.',
    tags: ['horizontal_pull', 'supported', 'upper_back'],
    prefer: ['hinge', 'squat', 'press'],
    avoid: [],
    phase: ['base', 'build', 'peak'],
    fatigue: 'low',
    source: 'Powerbuilder: chest supported rows, seal rows.'
  },
  {
    id: 'kroc-row',
    title: 'Kroc row controlado',
    prescription: '3 series de 12-20 reps por lado, pesado pero sin straps si puedes.',
    fallback: 'Landmine row unilateral o chest-supported DB row.',
    emphasis: 'Agarre, dorsales y upper back con transferencia a carries.',
    tags: ['horizontal_pull', 'grip', 'unilateral'],
    prefer: ['press', 'overhead'],
    avoid: ['hinge'],
    phase: ['base', 'build'],
    fatigue: 'moderate',
    source: 'EDC/Powerbuilder: single-arm DB/KB rows, Kroc rows, landmine rows.'
  },
  {
    id: 'dead-hang',
    title: 'Dead hang',
    prescription: '5-7 minutos acumulados de dead hang. Descansa lo necesario.',
    fallback: 'Towel hang o farmer hold si no hay barra.',
    emphasis: 'Agarre, hombro sano y tolerancia mental.',
    tags: ['grip', 'shoulder_health', 'low_eccentric'],
    prefer: ['hinge', 'peak'],
    avoid: [],
    phase: ['base', 'build', 'peak'],
    fatigue: 'low',
    source: 'EDC: 7 minute dead hang with burpee penalty.'
  },
  {
    id: 'pendlay-row',
    title: 'Pendlay row',
    prescription: '5 series de 5-8 reps explosivas desde el suelo, dejando 1-2 reps en recamara.',
    fallback: 'Barbell row desde bloques si el suelo no encaja.',
    emphasis: 'Upper back fuerte y transferencia a tirar objetos pesados.',
    tags: ['horizontal_pull', 'barbell', 'lumbar'],
    prefer: ['press'],
    avoid: ['hinge', 'squat', 'peak'],
    phase: ['base'],
    fatigue: 'high',
    source: 'Powerbuilder: Pendlay rows.'
  },
  {
    id: 'lat-pulldown-volume',
    title: 'Jalon neutro',
    prescription: '4 series de 10-15 reps con pausa abajo.',
    fallback: 'Band lat pulldown arrodillado o dominada asistida.',
    emphasis: 'Dorsal y depresion escapular con baja fatiga sistemica.',
    tags: ['vertical_pull', 'supported', 'low_eccentric'],
    prefer: ['hinge', 'squat', 'peak'],
    avoid: [],
    phase: ['base', 'build', 'peak'],
    fatigue: 'low',
    source: 'Powerbuilder: pull-downs and pull-up variations.'
  },
  {
    id: 'inverted-row',
    title: 'Inverted row pies elevados',
    prescription: '5 series de 8-15 reps estrictas, pecho a la barra.',
    fallback: 'Ring row o TRX row con tempo 3s bajada.',
    emphasis: 'Escapulas, romboides y control corporal.',
    tags: ['horizontal_pull', 'calisthenics', 'upper_back'],
    prefer: ['press', 'overhead'],
    avoid: [],
    phase: ['base', 'build'],
    fatigue: 'low',
    source: 'EDC/Powerbuilder: inverted rows, bodyweight rows.'
  },
  {
    id: 'landmine-row',
    title: 'Landmine row unilateral',
    prescription: '4 series de 8-12 reps por lado.',
    fallback: 'Remo mancuerna a una mano o cable row unilateral.',
    emphasis: 'Lats, oblicuos y agarre con carga asimetrica.',
    tags: ['horizontal_pull', 'unilateral', 'core'],
    prefer: ['press', 'overhead'],
    avoid: ['hinge'],
    phase: ['base', 'build'],
    fatigue: 'moderate',
    source: 'EDC/Powerbuilder: landmine rows, unilateral rows.'
  },
  {
    id: 'seal-row',
    title: 'Seal row',
    prescription: '4 series de 8-10 reps con pausa contra el banco.',
    fallback: 'Remo pecho apoyado con mancuernas.',
    emphasis: 'Espalda alta pesada sin hacer trampa con lumbar.',
    tags: ['horizontal_pull', 'supported', 'heavy'],
    prefer: ['hinge', 'squat'],
    avoid: [],
    phase: ['base', 'build'],
    fatigue: 'low',
    source: 'Powerbuilder: seal rows.'
  },
  {
    id: 'straight-arm-pulldown',
    title: 'Straight-arm pull-down',
    prescription: '3-4 series de 15-20 reps, bombeo fuerte sin fallo.',
    fallback: 'Pullover con banda, cable o mancuerna.',
    emphasis: 'Dorsales y extension de hombro con fatiga baja.',
    tags: ['lat_isolation', 'low_eccentric'],
    prefer: ['hinge', 'peak'],
    avoid: [],
    phase: ['build', 'peak'],
    fatigue: 'low',
    source: 'Powerbuilder: band/cable pull-downs.'
  },
  {
    id: 'face-pull-rear-delt',
    title: 'Face pull',
    prescription: '4 series de 15-25 reps, pausa 1s con escapulas atras.',
    fallback: 'Band pull-aparts o rear-delt row ligero.',
    emphasis: 'Deltoide posterior, manguito y salud de hombro para tanto pressing.',
    tags: ['rear_delt', 'shoulder_health', 'low_eccentric'],
    prefer: ['press', 'overhead', 'peak'],
    avoid: [],
    phase: ['base', 'build', 'peak'],
    fatigue: 'low',
    source: 'Powerbuilder: face pulls, band pull-aparts.'
  },
  {
    id: 'two-step-back',
    title: 'Remo + jalon separados',
    prescription: 'Remo maquina 3x10-12. Descansa. Despues jalon recto 2x15-20.',
    fallback: 'Cualquier remo apoyado + pullover con banda.',
    emphasis: 'Dos angulos de espalda sin formato biserie ni densidad agresiva.',
    tags: ['horizontal_pull', 'lat_isolation', 'supported'],
    prefer: ['press'],
    avoid: ['hinge'],
    phase: ['base', 'build'],
    fatigue: 'moderate',
    source: 'Powerbuilder: row plus lat isolation as assistance.'
  }
]

const ASSISTANCE_POOL = [
  {
    id: 'farmer-emom',
    title: 'Farmer carry EMOM',
    type: 'carry',
    prescription: '10 minutos EMOM: 50 ft farmer carry pesado. Resto del minuto descanso.',
    notes: 'Empieza moderado; sube carga si completas todas las rondas sin drops.',
    timer: { mode: 'emom', minutes: 10, intervalSec: 60 },
    emphasis: 'Agarre, traps, core y fuerza bruta transportando carga.',
    tags: ['carry', 'grip', 'core', 'low_eccentric'],
    prefer: ['press', 'overhead', 'base'],
    avoid: ['hinge'],
    fatigue: 'moderate',
    source: 'EDC/Powerbuilder: 50-150 ft farmer walk EMOM.'
  },
  {
    id: 'sandbag-bearhug',
    title: 'Sandbag bear-hug carry',
    type: 'odd_object',
    prescription: '8 rondas: 50 ft bear-hug sandbag carry o march in place pesado.',
    notes: 'Si no hay sandbag: Zercher carry, plate hug carry o keg/odd object.',
    timer: { mode: 'emom', minutes: 8, intervalSec: 60 },
    emphasis: 'Upper back isometrico, brace y objeto raro.',
    tags: ['odd_object', 'carry', 'brace', 'upper_back'],
    prefer: ['press', 'base'],
    avoid: ['hinge', 'squat', 'peak'],
    fatigue: 'high',
    source: 'EDC: sandbag carry, odd object front carry, bear hug position.'
  },
  {
    id: 'pull-push-squat-ladder',
    title: 'Ladder calistenico',
    type: 'conditioning',
    prescription: '10 minutos: 1 pull-up, 2 burpees, 3 push-ups, 4 squats. Sube 1/2/3/4 cada minuto hasta fallar tecnico.',
    notes: 'Usa inverted rows si las dominadas rompen el ritmo. Para semanas pesadas, corta en RPE 8.',
    timer: { mode: 'amrap', minutes: 10 },
    emphasis: 'Motor, calistenia y espalda sin interferir demasiado con SBS.',
    tags: ['conditioning', 'calisthenics', 'mixed'],
    prefer: ['squat', 'base'],
    avoid: ['overhead', 'peak'],
    fatigue: 'moderate',
    source: 'EDC/Powerbuilder: pull-up/burpee/push-up/squat running-clock ladders.'
  },
  {
    id: 'bodyweight-density',
    title: 'Density cada 30 segundos',
    type: 'conditioning',
    prescription: '10 minutos: cada 30s completa 3 pull-ups, 7 push-ups, 12 squats.',
    notes: 'Escala a 2/5/8 o inverted rows. El objetivo es no perder el reloj.',
    timer: { mode: 'interval', minutes: 10, workSec: 30, restSec: 0 },
    emphasis: 'Capacidad de trabajo tipo Alsruhe sin material.',
    tags: ['conditioning', 'calisthenics', 'mixed'],
    prefer: ['base'],
    avoid: ['peak'],
    fatigue: 'moderate',
    source: 'EDC: every 30 seconds, pull-ups/push-ups/squats.'
  },
  {
    id: 'waiter-farmer',
    title: 'Waiter + farmer walk unilateral',
    type: 'carry',
    prescription: '4 rondas: 100 ft waiter walk izq, 100 ft farmer walk der, cambia lados y repite.',
    notes: 'Manten costillas abajo y bloquea overhead. Descansa 90s entre rondas.',
    timer: { mode: 'rounds', rounds: 4, restSec: 90 },
    emphasis: 'Estabilidad overhead, oblicuos, agarre y anti-flexion.',
    tags: ['carry', 'overhead_stability', 'grip', 'unilateral'],
    prefer: ['squat', 'press'],
    avoid: ['overhead'],
    fatigue: 'moderate',
    source: 'EDC: waiter walk/farmer walk unilateral AMRAP.'
  },
  {
    id: 'odd-object-medley',
    title: 'Medley objeto raro',
    type: 'odd_object',
    prescription: '4 rondas: 50 ft single-arm farmer izq, 50 ft sandbag bear-hug, 50 ft single-arm farmer der.',
    notes: 'Descansa 90-120s. Anade peso solo si no se degrada la postura.',
    timer: { mode: 'rounds', rounds: 4, restSec: 120 },
    emphasis: 'Fuerza bruta, conditioning y grip bajo fatiga.',
    tags: ['odd_object', 'carry', 'conditioning', 'grip'],
    prefer: ['base'],
    avoid: ['hinge', 'squat', 'peak'],
    fatigue: 'high',
    source: 'EDC: farmer/sandbag/farmer medley.'
  },
  {
    id: 'hinge-row-core',
    title: 'Posterior + row + core',
    type: 'assistance',
    prescription: '10-12 minutos AMRAP: 8 RDL ligero/moderado, 12 rows, 10 hanging knee raises.',
    notes: 'Evita hacerlo pesado en semanas de deadlift duro; debe sentirse atletico.',
    timer: { mode: 'amrap', minutes: 12 },
    emphasis: 'Cadena posterior, lats y trunk sin competir con el lift principal.',
    tags: ['hinge', 'row', 'core'],
    prefer: ['press'],
    avoid: ['hinge', 'squat', 'peak'],
    fatigue: 'high',
    source: 'Powerbuilder: RDL/rows/hanging raises AMRAP patterns.'
  },
  {
    id: 'pushup-crawl',
    title: 'Push-up + locomotion',
    type: 'conditioning',
    prescription: '3 rondas: 45-60s max push-ups, 100 ft bear walk, 100 ft gator walk, 100 ft crab walk.',
    notes: 'Descanso minimo, pero manten hombros estables. Reduce push-ups si hubo mucho bench.',
    timer: { mode: 'rounds', rounds: 3, restSec: 60 },
    emphasis: 'Calistenia, hombros, core y acondicionamiento raro.',
    tags: ['conditioning', 'calisthenics', 'locomotion', 'pressing'],
    prefer: ['squat', 'hinge'],
    avoid: ['press', 'overhead', 'peak'],
    fatigue: 'moderate',
    source: 'EDC: push-ups, bear/gator/crab walks.'
  },
  {
    id: 'backward-walk-stepup',
    title: 'Backward walk + step-up',
    type: 'conditioning',
    prescription: '8 rondas: 45s caminata atras en cuesta o cinta inclinada, 10 step-ups por pierna, descanso 60-75s.',
    notes: 'Sin impacto y sin trineo. Usa chaleco o mancuernas ligeras solo si no cambia la mecanica.',
    timer: { mode: 'rounds', rounds: 8, restSec: 75 },
    emphasis: 'Piernas, pulmones y rodillas felices sin eccentric brutal.',
    tags: ['conditioning', 'legs', 'low_eccentric'],
    prefer: ['press', 'overhead', 'peak'],
    avoid: [],
    fatigue: 'low',
    source: 'Adaptacion sin sled de patrones EDC/Powerbuilder de drag/push.'
  },
  {
    id: 'zercher-carry',
    title: 'Zercher carry',
    type: 'odd_object',
    prescription: '6 rondas: 30-50m Zercher carry pesado.',
    notes: 'Usa sandbag/front carry si los codos protestan. Brace brutal, pasos cortos.',
    timer: { mode: 'rounds', rounds: 6, restSec: 90 },
    emphasis: 'Core, upper back y fuerza de objeto incomodo.',
    tags: ['odd_object', 'carry', 'brace', 'upper_back'],
    prefer: ['press', 'base'],
    avoid: ['hinge', 'squat', 'peak'],
    fatigue: 'high',
    source: 'EDC: front carry, bear-hug and odd-object loading.'
  },
  {
    id: 'burpee-pullup-emom',
    title: 'Burpee pull-up EMOM',
    type: 'conditioning',
    prescription: '10 minutos EMOM: 3 burpee pull-ups o 5 burpees + 3 inverted rows.',
    notes: 'Debe ser sostenible; no lo conviertas en fallo desde el minuto 3.',
    timer: { mode: 'emom', minutes: 10, intervalSec: 60 },
    emphasis: 'Motor, calistenia y traccion bajo fatiga.',
    tags: ['conditioning', 'calisthenics', 'vertical_pull'],
    prefer: ['squat', 'base'],
    avoid: ['overhead', 'peak'],
    fatigue: 'moderate',
    source: 'EDC: burpees, pull-ups and running-clock conditioning.'
  },
  {
    id: 'suitcase-carry',
    title: 'Suitcase carry pesado',
    type: 'carry',
    prescription: '5 rondas por lado: 40-60m suitcase carry pesado.',
    notes: 'Cadera nivelada, costillas abajo. Cambia de mano despues de cada tramo.',
    timer: { mode: 'rounds', rounds: 5, restSec: 75 },
    emphasis: 'Agarre, oblicuos y anti-inclinacion.',
    tags: ['carry', 'grip', 'core', 'unilateral'],
    prefer: ['press', 'overhead', 'build'],
    avoid: ['hinge'],
    fatigue: 'moderate',
    source: 'EDC: unilateral loaded carries.'
  },
  {
    id: 'sandbag-to-shoulder',
    title: 'Sandbag to shoulder',
    type: 'odd_object',
    prescription: '10 minutos: 2 sandbag to shoulder por lado al inicio de cada minuto.',
    notes: 'Carga moderada. Si no hay saco: DB/KB clean alterno pesado.',
    timer: { mode: 'emom', minutes: 10, intervalSec: 60 },
    emphasis: 'Triple extension, brace y objeto raro.',
    tags: ['odd_object', 'power', 'hinge'],
    prefer: ['press', 'base'],
    avoid: ['hinge', 'squat', 'peak'],
    fatigue: 'high',
    source: 'EDC: sandbag loading and odd-object clean patterns.'
  },
  {
    id: 'chinup-dip-density',
    title: 'Chin-up + dip density',
    type: 'assistance',
    prescription: '10-12 minutos alternando: 4-6 chin-ups y 6-10 dips o push-ups.',
    notes: 'No falles. Mantiene volumen de torso con reloj, pero controlado.',
    timer: { mode: 'amrap', minutes: 12 },
    emphasis: 'Calistenia pesada, dorsales y empuje sin mucho montaje.',
    tags: ['calisthenics', 'vertical_pull', 'pressing'],
    prefer: ['squat', 'hinge', 'base'],
    avoid: ['press', 'overhead', 'peak'],
    fatigue: 'moderate',
    source: 'Powerbuilder: chin-ups, dips, density blocks.'
  },
  {
    id: 'bike-sprint-carry',
    title: 'Bike sprint + carry',
    type: 'conditioning',
    prescription: '8 rondas: 20s bike sprint, 40m farmer carry moderado, descanso 80s.',
    notes: 'Sin bici: assault runner, remo o shuttle sprint corto.',
    timer: { mode: 'rounds', rounds: 8, restSec: 80 },
    emphasis: 'Motor alactico, agarre y recuperacion entre esfuerzos.',
    tags: ['conditioning', 'carry', 'grip', 'low_eccentric'],
    prefer: ['build', 'peak'],
    avoid: ['hinge'],
    fatigue: 'low',
    source: 'EDC: sprint intervals and loaded carry pairing.'
  },
  {
    id: 'empty-bar-bench-emom',
    title: 'Bench vacio EMOM',
    type: 'conditioning',
    prescription: '8 minutos: 5 burpees al inicio de cada minuto, resto del minuto reps de bench con barra vacia.',
    notes: 'Solo si el dia no tuvo press pesado. Corta si los hombros se degradan.',
    timer: { mode: 'emom', minutes: 8, intervalSec: 60 },
    emphasis: 'Conditioning de torso estilo Alsruhe con carga minima.',
    tags: ['conditioning', 'pressing'],
    prefer: ['squat', 'hinge', 'base'],
    avoid: ['press', 'overhead', 'peak'],
    fatigue: 'moderate',
    source: 'Powerbuilder: burpee plus empty-bar bench minute work.'
  },
  {
    id: 'odd-object-mile-lite',
    title: 'Odd object carry largo',
    type: 'carry',
    prescription: '12-20 minutos continuo: carry incomodo moderado, cambia agarre cada 40-60m.',
    notes: 'No busques maximo. Es motor, agarre y cabeza.',
    timer: { mode: 'amrap', minutes: 16 },
    emphasis: 'Base aerobica especifica con objeto raro.',
    tags: ['carry', 'odd_object', 'zone2', 'grip'],
    prefer: ['base'],
    avoid: ['peak'],
    fatigue: 'low',
    source: 'Powerbuilder/EDC: mile odd-object carry concepts.'
  },
  {
    id: 'core-brace-circuit',
    title: 'Brace circuit',
    type: 'assistance',
    prescription: '3-4 rondas: 30s front rack hold, 10 hanging knee raises, 30s plank pesado.',
    notes: 'Cero fallo. Que te deje mas estable, no destruido.',
    timer: { mode: 'rounds', rounds: 4, restSec: 60 },
    emphasis: 'Trunk, respiracion bajo carga y transferencia a squat/deadlift.',
    tags: ['core', 'brace', 'low_eccentric'],
    prefer: ['squat', 'hinge', 'peak'],
    avoid: [],
    fatigue: 'low',
    source: 'EDC/Powerbuilder: loaded holds, hanging raises and trunk work.'
  }
]

const DELOAD_UPPER_BACK = {
  id: 'deload-back',
  title: 'Remo ligero',
  prescription: '2-3 series faciles de 12-15 reps, tempo limpio y sin fallo.',
  fallback: 'Band row, face pull o jalon ligero.',
  emphasis: 'Mantener sangre en espalda y hombros sin deuda de recuperacion.',
  tags: ['supported', 'pump', 'recovery'],
  source: 'SBS deload + upper-back pump ligero.'
}

const DELOAD_ASSISTANCE = {
  id: 'deload-specimen',
  title: 'Deload specimen',
  type: 'deload',
  prescription: '2-3 rondas faciles: 10 inverted rows, 10 push-ups, 20-30m carry ligero, 30s hollow hold.',
  notes: 'Sin fallo, sin heroicidades. Mantener tejido y patron.',
  timer: { mode: 'amrap', minutes: 8 },
  emphasis: 'Movimiento, bombeo y grip sin deuda de recuperacion.',
  tags: ['recovery', 'pump', 'carry'],
  source: 'SBS deload + patrones ligeros de EDC.'
}

function inferLiftFocus(lift = {}) {
  const slotFocus = SLOT_FOCUS[lift.slotId]
  if (slotFocus) return slotFocus
  const text = `${lift.name || ''} ${lift.label || ''}`.toLowerCase()
  if (/deadlift|sumo|rdl|hinge|good morning|pull/.test(text)) return 'hinge'
  if (/squat|lunge|front squat|paused squat/.test(text)) return 'squat'
  if (/ohp|overhead|push press|strict press/.test(text)) return 'overhead'
  if (/bench|press|incline|dip/.test(text)) return 'press'
  return 'general'
}

function phaseForWeek(week, deload) {
  if (deload) return 'deload'
  if (week <= 6) return 'base'
  if (week <= 13) return 'build'
  return 'peak'
}

function sessionProfile({ week, day, frequency, deload, lifts = [] }) {
  const focusList = lifts.map(inferLiftFocus)
  const focusSet = new Set(focusList)
  const phase = phaseForWeek(Number(week), deload)
  const primaryFocus = focusList[0] || 'general'
  const lowerCount = focusList.filter((focus) => focus === 'squat' || focus === 'hinge').length
  const pressCount = focusList.filter((focus) => focus === 'press' || focus === 'overhead').length
  const hasHinge = focusSet.has('hinge')
  const hasSquat = focusSet.has('squat')
  const hasPress = focusSet.has('press')
  const hasOverhead = focusSet.has('overhead')
  const density = frequency >= 5 ? 'baja' : frequency === 4 ? 'media' : 'alta'

  return {
    week: Number(week),
    day: Number(day),
    frequency: Number(frequency),
    phase,
    primaryFocus,
    focusList,
    focusSet,
    lowerCount,
    pressCount,
    hasHinge,
    hasSquat,
    hasPress,
    hasOverhead,
    density
  }
}

function scoreCandidate(candidate, profile) {
  let score = 100
  const avoid = candidate.avoid || []
  const prefer = candidate.prefer || []
  const tags = candidate.tags || []

  for (const focus of profile.focusSet) {
    if (prefer.includes(focus)) score += 18
    if (avoid.includes(focus)) score -= 36
  }
  if (prefer.includes(profile.phase)) score += 16
  if (avoid.includes(profile.phase)) score -= 34
  if (candidate.phase && !candidate.phase.includes(profile.phase)) score -= 12

  if (profile.hasHinge && (tags.includes('hinge') || tags.includes('lumbar'))) score -= 34
  if (profile.hasHinge && tags.includes('carry') && candidate.fatigue !== 'low') score -= 18
  if (profile.hasHinge && tags.includes('grip') && candidate.fatigue !== 'low') score -= 8
  if (profile.lowerCount >= 2 && tags.includes('conditioning') && !tags.includes('low_eccentric')) score -= 18
  if (profile.hasSquat && tags.includes('legs')) score -= 18
  if ((profile.hasPress || profile.hasOverhead) && tags.includes('pressing')) score -= 26
  if (profile.hasOverhead && tags.includes('overhead_stability')) score -= 16
  if (profile.pressCount >= 2 && (tags.includes('rear_delt') || tags.includes('shoulder_health'))) score += 18
  if (profile.lowerCount >= 2 && tags.includes('supported')) score += 20
  if (profile.phase === 'peak' && candidate.fatigue === 'high') score -= 42
  if (profile.phase === 'build' && candidate.fatigue === 'high') score -= 12
  if (profile.frequency >= 5 && candidate.fatigue === 'high') score -= 34
  if (profile.frequency >= 5 && candidate.fatigue === 'moderate') score -= 12
  if (profile.frequency <= 3 && candidate.fatigue === 'low') score += 4
  if (profile.phase === 'peak' && tags.includes('low_eccentric')) score += 14
  if (tags.includes('grip') && !profile.hasHinge) score += 6

  return score
}

function deterministicBias(index, seed) {
  return (((seed + 11) * (index + 3) * 17) % 19) / 10
}

function pickContextual(pool, profile, seed) {
  const scored = pool
    .map((candidate, index) => ({
      candidate,
      score: scoreCandidate(candidate, profile) + deterministicBias(index, seed)
    }))
    .sort((a, b) => b.score - a.score)
  const contenders = scored.filter((entry) => entry.score >= 80).slice(0, 6)
  return contenders[seed % contenders.length]?.candidate || scored[0]?.candidate
}

function dayRationale(profile, upperBack, assistance) {
  const focusText = profile.focusList.length ? profile.focusList.join(', ') : 'general'
  const phaseText = {
    base: 'base de volumen',
    build: 'bloque medio',
    peak: 'fase pesada',
    deload: 'deload'
  }[profile.phase]
  const notes = [`Dia ${focusText}; fase ${phaseText}; dosis ${profile.density}.`]
  if (profile.hasHinge) notes.push('Se evita sumar bisagras/lumbar pesado despues de deadlift.')
  if (profile.hasSquat) notes.push('Se controla la fatiga de piernas y se prioriza espalda que no robe recuperacion.')
  if (profile.hasPress || profile.hasOverhead) notes.push('Se compensa el pressing con traccion, rear delts, agarre o carries.')
  if (profile.phase === 'peak') notes.push('En semanas pesadas se favorece trabajo corto, bajo en excentrica y sin fallo.')
  notes.push(`Upper back: ${upperBack.emphasis}`)
  notes.push(`Asistencia: ${assistance.emphasis}`)
  return notes
}

export function specimenTemplateForSession({ week, day, frequency, deload, lifts = [] }) {
  const profile = sessionProfile({ week, day, frequency, deload, lifts })
  const seed = (profile.week - 1) * profile.frequency + (profile.day - 1)
  const upperBack = deload ? DELOAD_UPPER_BACK : pickContextual(UPPER_BACK_POOL, profile, seed)
  const assistance = deload ? DELOAD_ASSISTANCE : pickContextual(ASSISTANCE_POOL, profile, seed + 5)

  return {
    id: `specimen-W${week}D${day}`,
    title: 'Specimen work',
    density: profile.density,
    phase: profile.phase,
    profile: {
      primaryFocus: profile.primaryFocus,
      focusList: profile.focusList
    },
    upperBack,
    assistance,
    rationale: dayRationale(profile, upperBack, assistance)
  }
}

export function timerFromSpecimen(specimen) {
  const timer = specimen?.assistance?.timer
  if (!timer) return { label: 'Descanso 3:00', seconds: 180, mode: 'countdown' }
  if (timer.mode === 'emom') return { label: `EMOM ${timer.minutes}:00`, seconds: timer.minutes * 60, mode: 'emom' }
  if (timer.mode === 'amrap') return { label: `AMRAP ${timer.minutes}:00`, seconds: timer.minutes * 60, mode: 'countdown' }
  if (timer.mode === 'interval') return { label: `${timer.minutes}:00 cada ${timer.workSec}s`, seconds: timer.minutes * 60, mode: 'interval' }
  if (timer.mode === 'rounds') return { label: `${timer.rounds} rondas`, seconds: timer.restSec || 90, mode: 'countdown' }
  return { label: 'Descanso 3:00', seconds: 180, mode: 'countdown' }
}
