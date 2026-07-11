export const BODYBUILDING_CATALOG = [
  { id: 'chest-supported-row', name: 'Chest-supported row', role: 'back', category: 'horizontal_pull', tags: ['back', 'upper_back', 'horizontal_pull', 'supported'], repMin: 8, repMax: 12, loadMode: 'weight' },
  { id: 'machine-row', name: 'Machine row', role: 'back', category: 'horizontal_pull', tags: ['back', 'upper_back', 'horizontal_pull', 'supported'], repMin: 8, repMax: 12, loadMode: 'weight' },
  { id: 'seated-cable-row', name: 'Seated cable row', role: 'back', category: 'horizontal_pull', tags: ['back', 'upper_back', 'horizontal_pull', 'supported'], repMin: 8, repMax: 12, loadMode: 'weight' },
  { id: 'one-arm-cable-row', name: 'One-arm cable row', role: 'back', category: 'horizontal_pull', tags: ['back', 'lats', 'horizontal_pull', 'unilateral'], repMin: 8, repMax: 12, loadMode: 'weight' },
  { id: 'one-arm-db-row', name: 'One-arm dumbbell row', role: 'back', category: 'horizontal_pull', tags: ['back', 'lats', 'horizontal_pull', 'unilateral'], repMin: 8, repMax: 12, loadMode: 'weight' },
  { id: 'neutral-pulldown', name: 'Neutral-grip pulldown', role: 'back', category: 'vertical_pull', tags: ['back', 'lats', 'vertical_pull'], repMin: 8, repMax: 12, loadMode: 'weight' },
  { id: 'supinated-pulldown', name: 'Supinated pulldown', role: 'back', category: 'vertical_pull', tags: ['back', 'lats', 'biceps', 'vertical_pull'], repMin: 8, repMax: 12, loadMode: 'weight' },
  { id: 'weighted-pull-up', name: 'Weighted pull-up', role: 'back', category: 'vertical_pull', tags: ['back', 'lats', 'bodyweight', 'vertical_pull'], repMin: 6, repMax: 10, loadMode: 'added_weight' },
  { id: 'weighted-chin-up', name: 'Weighted chin-up', role: 'back', category: 'vertical_pull', tags: ['back', 'lats', 'biceps', 'bodyweight', 'vertical_pull'], repMin: 6, repMax: 10, loadMode: 'added_weight' },

  { id: 'leg-extension', name: 'Leg extension', role: 'accessory', category: 'quads', tags: ['legs', 'quads', 'isolation'], repMin: 10, repMax: 15, loadMode: 'weight' },
  { id: 'leg-press', name: 'Leg press', role: 'accessory', category: 'quads', tags: ['legs', 'quads', 'compound'], repMin: 8, repMax: 12, loadMode: 'weight' },
  { id: 'hack-squat', name: 'Hack squat', role: 'accessory', category: 'quads', tags: ['legs', 'quads', 'compound'], repMin: 8, repMax: 12, loadMode: 'weight' },
  { id: 'bulgarian-split-squat', name: 'Bulgarian split squat', role: 'accessory', category: 'quads', tags: ['legs', 'quads', 'glutes', 'unilateral'], repMin: 8, repMax: 12, loadMode: 'weight' },
  { id: 'seated-leg-curl', name: 'Seated leg curl', role: 'accessory', category: 'hamstrings', tags: ['legs', 'hamstrings', 'isolation'], repMin: 10, repMax: 15, loadMode: 'weight' },
  { id: 'lying-leg-curl', name: 'Lying leg curl', role: 'accessory', category: 'hamstrings', tags: ['legs', 'hamstrings', 'isolation'], repMin: 10, repMax: 15, loadMode: 'weight' },
  { id: 'hip-thrust', name: 'Hip thrust', role: 'accessory', category: 'glutes', tags: ['legs', 'glutes', 'compound'], repMin: 8, repMax: 12, loadMode: 'weight' },
  { id: 'back-extension', name: '45-degree back extension', role: 'accessory', category: 'glutes', tags: ['legs', 'glutes', 'hamstrings', 'hinge'], repMin: 10, repMax: 15, loadMode: 'weight' },
  { id: 'standing-calf-raise', name: 'Standing calf raise', role: 'accessory', category: 'calves', tags: ['legs', 'calves', 'isolation'], repMin: 12, repMax: 20, loadMode: 'weight' },
  { id: 'seated-calf-raise', name: 'Seated calf raise', role: 'accessory', category: 'calves', tags: ['legs', 'calves', 'isolation'], repMin: 12, repMax: 20, loadMode: 'weight' },

  { id: 'pec-deck', name: 'Pec deck', role: 'accessory', category: 'chest', tags: ['press', 'chest', 'isolation'], repMin: 10, repMax: 15, loadMode: 'weight' },
  { id: 'cable-fly', name: 'Cable fly', role: 'accessory', category: 'chest', tags: ['press', 'chest', 'isolation'], repMin: 10, repMax: 15, loadMode: 'weight' },
  { id: 'machine-chest-press', name: 'Machine chest press', role: 'accessory', category: 'chest', tags: ['press', 'chest', 'triceps', 'compound'], repMin: 8, repMax: 12, loadMode: 'weight' },
  { id: 'cable-lateral-raise', name: 'Cable lateral raise', role: 'accessory', category: 'lateral_delts', tags: ['shoulders', 'lateral_delts', 'isolation'], repMin: 12, repMax: 20, loadMode: 'weight' },
  { id: 'db-lateral-raise', name: 'Dumbbell lateral raise', role: 'accessory', category: 'lateral_delts', tags: ['shoulders', 'lateral_delts', 'isolation'], repMin: 12, repMax: 20, loadMode: 'weight' },
  { id: 'reverse-pec-deck', name: 'Reverse pec deck', role: 'accessory', category: 'rear_delts', tags: ['shoulders', 'rear_delts', 'upper_back', 'isolation'], repMin: 12, repMax: 20, loadMode: 'weight' },
  { id: 'cable-rear-delt-fly', name: 'Cable rear-delt fly', role: 'accessory', category: 'rear_delts', tags: ['shoulders', 'rear_delts', 'upper_back', 'isolation'], repMin: 12, repMax: 20, loadMode: 'weight' },
  { id: 'rope-pressdown', name: 'Rope pressdown', role: 'accessory', category: 'triceps', tags: ['arms', 'triceps', 'press', 'isolation'], repMin: 10, repMax: 15, loadMode: 'weight' },
  { id: 'overhead-cable-extension', name: 'Overhead cable triceps extension', role: 'accessory', category: 'triceps', tags: ['arms', 'triceps', 'press', 'isolation'], repMin: 10, repMax: 15, loadMode: 'weight' },
  { id: 'ez-skull-crusher', name: 'EZ-bar skull crusher', role: 'accessory', category: 'triceps', tags: ['arms', 'triceps', 'press', 'isolation'], repMin: 10, repMax: 15, loadMode: 'weight' },
  { id: 'preacher-curl', name: 'Preacher curl', role: 'accessory', category: 'biceps', tags: ['arms', 'biceps', 'pull', 'isolation'], repMin: 10, repMax: 15, loadMode: 'weight' },
  { id: 'incline-db-curl', name: 'Incline dumbbell curl', role: 'accessory', category: 'biceps', tags: ['arms', 'biceps', 'pull', 'isolation'], repMin: 10, repMax: 15, loadMode: 'weight' },
  { id: 'hammer-curl', name: 'Hammer curl', role: 'accessory', category: 'biceps', tags: ['arms', 'biceps', 'grip', 'pull'], repMin: 8, repMax: 12, loadMode: 'weight' },
  { id: 'cable-curl', name: 'Cable curl', role: 'accessory', category: 'biceps', tags: ['arms', 'biceps', 'pull', 'isolation'], repMin: 10, repMax: 15, loadMode: 'weight' },
  { id: 'cable-crunch', name: 'Cable crunch', role: 'accessory', category: 'core', tags: ['core', 'isolation'], repMin: 10, repMax: 15, loadMode: 'weight' }
]

export const BACK_EXERCISES = BODYBUILDING_CATALOG.filter((exercise) => exercise.role === 'back')
export const ACCESSORY_EXERCISES = BODYBUILDING_CATALOG.filter((exercise) => exercise.role === 'accessory')

export function bodybuildingExercise(exerciseId) {
  return BODYBUILDING_CATALOG.find((exercise) => exercise.id === exerciseId) || null
}
