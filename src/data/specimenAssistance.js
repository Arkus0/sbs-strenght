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

function sourceBlock(block) {
  const title = block.raw.split('\n').find(Boolean) || block.id
  return {
    ...block,
    title,
    role: block.source.role,
    sourceLabel: `${block.source.label} W${block.source.week}D${block.source.day} ${block.source.role}`,
    prescription: block.raw,
    shortPrescription: shortPrescription(block.raw),
    notes: `Fuente real: ${block.source.label} W${block.source.week}D${block.source.day}, ${block.source.role}.`
  }
}

// Curated only from C:/Users/Usuario/Documents/training-montage/src/data/*_program.json.
// Keep source metadata with every block; no invented assistance prescriptions here.
const UPPER_SOURCE_BLOCKS = [
  sourceBlock({
    id: 'rpm2-w1d2-assistance',
    tags: ['pull', 'row'],
    source: { program: 'rpm2', label: 'RPM2', week: 1, day: 2, sessionIndex: 1, mainLift: 'squat', role: 'assistance' },
    timer: { type: 'emom', duration_sec: 600, interval_sec: 60, rounds: 10 },
    raw: `Gorilla Rows (MEDIUM) Or Barbell Rows
At the Top of Every Minute for 10 Minutes, Complete:
5-6 Gorilla Rows (Each Side) @ 50-55% of Your 1RM
Take the Remainder of the Minute to Rest
or Add Floor Presses during the Remainder of the Minute`
  }),
  sourceBlock({
    id: 'rpm2-w1d3-assistance',
    tags: ['pull', 'vertical_pull', 'calisthenics'],
    source: { program: 'rpm2', label: 'RPM2', week: 1, day: 3, sessionIndex: 2, mainLift: 'deadlift', role: 'assistance' },
    timer: { type: 'emom', duration_sec: 600, interval_sec: 60, rounds: 10 },
    raw: `Weighted Pull-Ups (HEAVY) (Pull-Downs if Necessary)
At the Top of Every Minute for 10 Minutes, Complete:
3-4 Weighted Pull-Ups @ 60-65% of Your 1RM
Take the Remainder of the Minute to Rest
or Add Push-Ups during the Remainder of the Minute`
  }),
  sourceBlock({
    id: 'rpm2-w2d2-assistance',
    tags: ['pull', 'row'],
    source: { program: 'rpm2', label: 'RPM2', week: 2, day: 2, sessionIndex: 5, mainLift: 'squat', role: 'assistance' },
    timer: { type: 'emom', duration_sec: 600, interval_sec: 60, rounds: 10 },
    raw: `Deadlift Rows (HEAVY) or Barbell Rows
At the Top of Every Minute for 10 Minutes, Complete:
3-4 Deadlift Rows @ 60-65% of Your 1RM
Take the Remainder of the Minute to Rest
or Add Floor Presses/Push-Ups during the Remainder of the Minute`
  }),
  sourceBlock({
    id: 'rpm2-w2d3-assistance',
    tags: ['pull', 'vertical_pull', 'calisthenics'],
    source: { program: 'rpm2', label: 'RPM2', week: 2, day: 3, sessionIndex: 6, mainLift: 'deadlift', role: 'assistance' },
    timer: { type: 'emom', duration_sec: 600, interval_sec: 60, rounds: 10 },
    raw: `Weighted Chin-Ups (LIGHT) (Pull-Downs [supinated grip] if Necessary)
At the Top of Every Minute for 10 Minutes, Complete:
5-6 Chin-Ups @ 40-45% Of Your 1RM
Take the Remainder of the Minute to Rest
or Add Push-Ups during the Remainder of the Minute`
  }),
  sourceBlock({
    id: 'rpm2-w3d2-assistance',
    tags: ['pull', 'row'],
    source: { program: 'rpm2', label: 'RPM2', week: 3, day: 2, sessionIndex: 9, mainLift: 'squat', role: 'assistance' },
    timer: { type: 'emom', duration_sec: 600, interval_sec: 60, rounds: 10 },
    raw: `Meadows Rows (LIGHT) or Dumbbell Rows
At the Top of Every Minute for 10 Minutes, Complete:
:20 Seconds Meadows Rows (Left) 1 Second Pauses at the Top
:20 Seconds Meadows Rows (Right) 1 Second Pauses at the Top
:20 Seconds Rest
@ 40-45% of Your 1RM`
  }),
  sourceBlock({
    id: 'powerbuilder-w1d1-assistance',
    tags: ['pull', 'row', 'core'],
    source: { program: 'powerbuilder', label: 'Powerbuilder', week: 1, day: 1, sessionIndex: 0, mainLift: 'deadlift', role: 'assistance' },
    timer: { type: 'rounds', rest_sec: 90, rounds: 3 },
    raw: `3 Rounds of the Following Giant Set
16 Rack Deadlifts (Just above the Knee - As Heavy As possible)
14 Krock Rows (Each Side)
10 Hanging Leg Raises
***No Rest between exercises.  Take :90 Seconds Rest after you have finished all 3 and get right back to it.`
  }),
  sourceBlock({
    id: 'powerbuilder-lite-w1d1-assistance',
    tags: ['pull', 'row', 'hinge'],
    source: { program: 'powerbuilder_lite', label: 'Powerbuilder Lite', week: 1, day: 1, sessionIndex: 0, mainLift: 'deadlift', role: 'assistance' },
    timer: { type: 'amrap', duration_sec: 600 },
    raw: `As many Rounds as Possible in 10 Minutes
8 Single Arm Dumbbell Rows (each side)
8 RDL's (Moderate Weight)
8 Glute Ham Raises or Nordic Hamstring Curls`
  }),
  sourceBlock({
    id: 'linear-w1d1-accessory',
    tags: ['pull', 'row', 'core'],
    source: { program: 'linear', label: 'Linear', week: 1, day: 1, sessionIndex: 0, mainLift: 'deadlift', role: 'accessory' },
    timer: { type: 'rounds', rest_sec: 90, rounds: 3 },
    raw: `Use 3-4 Rounds of the Secondary Giant Set (Warm-up Rounds do not Count) to Work up to your Heaviest set of 8 Reps on the Stiff Leg or Romanian Deadlift.
B1. 8 Deadlift Rows (Tutorial on my Youtube Channel)
B2. 8 Stiff Leg OR Romanian Deadlifts
B3. :15-:60 Second RKC Plank (Depending on your level)
90-120 Seconds to REST, ADD weight and get back after it.`
  }),
  sourceBlock({
    id: 'edc-w6d1-assistance',
    tags: ['pull', 'row', 'complex'],
    source: { program: 'edc', label: 'EDC', week: 6, day: 1, sessionIndex: 20, mainLift: 'deadlift', role: 'assistance' },
    timer: { type: 'rounds', rounds: 4 },
    raw: `10 Minutes to Build up to Your Heaviest Row Complex - A COMPLEX means that you Complete ALL
Reps of ALL exercise before Releasing the Bar.
4 Rounds - Aiming for the Heaviest Round Possible - Add Weight Every Round You Can
5 Strict Pendlay Rows
5 Barbell Rows
5 Deadlift Rows
Rest as Long As you Think you need Between Rounds`
  }),
  sourceBlock({
    id: 'edc-w8d2-assistance',
    tags: ['pull', 'press', 'calisthenics'],
    source: { program: 'edc', label: 'EDC', week: 8, day: 2, sessionIndex: 29, mainLift: 'ohp', role: 'assistance' },
    timer: { type: 'amrap', duration_sec: 600 },
    raw: `Complete As Many Rounds As possible in 10 Minutes
4 Wide Grip Pull-Ups (Depending On Your Level)
8 Neutral Grip Dumbbell Strict Presses
10 Dips (15 push-Ups if Necessary)
12 Face Pulls
Rest as little as need to complete as Many Rounds as You Can.`
  }),
  sourceBlock({
    id: 'edc-w5d3-sandbag-carry',
    tags: ['sandbag', 'upper_back', 'carry', 'legs'],
    source: { program: 'edc', label: 'EDC', week: 5, day: 3, sessionIndex: 18, mainLift: 'squat', role: 'carry' },
    timer: { type: 'amrap', duration_sec: 600 },
    raw: `As Many Rounds As Possible in 10 minutes:
3 Sandbag Picks. *Pick up to Chest height and hold for 1 Count. (Heavy Sandbag)
7 Sandbag Squats - DEEP Squeeze Butt and Upper Back Every Rep (Same Sandbag)
50 Foot Carry (Bearhug Position) - Same Sandbag
Rest as long as needed Between Rounds but You are trying to complete as many Rounds as You can
in the Given 10 minutes:
SCORE:______________`
  }),
  sourceBlock({
    id: 'edc-w9d2-sandbag-turnarounds',
    tags: ['sandbag', 'upper_back', 'pull', 'press'],
    source: { program: 'edc', label: 'EDC', week: 9, day: 2, sessionIndex: 33, mainLift: 'ohp', role: 'strength' },
    timer: { type: 'rounds', rounds: 7, rest_sec: 90 },
    raw: `7 Rounds of the Following Giant Set
A. 3 Weighted Pull-Ups or 10 Bodyweight PU's / 25 Inverted Rows
B. 2 Strict Presses or Push Presses (Goal is 85-95%+ of your 1RM)
C. :30 Seconds Sandbag Turn Arounds (Heavy) - Each Side *Pick Up Sandbag to Chest Height, Turn 180
Degrees, Drop it. Pick it Back up, turn in the opposite Direction, Drop it = 1 Rep
D. D. :90 Seconds Rest to Manipulate and Record Weights`
  }),
  sourceBlock({
    id: 'edc-w12d3-sandbag-tempo-squats',
    tags: ['sandbag', 'upper_back', 'legs'],
    source: { program: 'edc', label: 'EDC', week: 12, day: 3, sessionIndex: 46, mainLift: 'squat', role: 'assistance' },
    timer: { type: 'rounds', rounds: 5, rest_sec: 60 },
    raw: `TEMPO Reps (4 Sec Descent, 4 Sec Pause, 4 Sec Ascent, 4 Sec Pause)
5 TEMPO Squats @ 65% of Your 1RM
5 TEMPO Sandbag Squats @ Bodyweight - Upper Back & Butt Squeeze Each Rep
Rest one minute and change the Weights
4 TEMPO Squats @ 70% of Your 1RM
4 TEMPO Sandbag Squats @ Bodyweight - Upper Back & Butt Squeeze Each Rep
Rest one minute and change the Weights
3 TEMPO Squats @ 75% of Your 1RM
3 TEMPO Sandbag Squats @ Bodyweight - Upper Back & Butt Squeeze Each Rep
Rest one minute and change the Weights
2 TEMPO Squats @ 80% of Your 1RM
2 TEMPO Sandbag Squats @ Bodyweight - Upper Back & Butt Squeeze Each Rep
Rest one minute and change the Weights
1 TEMPO Squat @ 85% of Your 1RM
1 TEMPO Sandbag Squat @ Bodyweight - Upper Back & Butt Squeeze Each Rep`
  })
]

const ASSISTANCE_SOURCE_BLOCKS = [
  sourceBlock({
    id: 'edc-w1d1-conditioning',
    tags: ['calisthenics', 'press', 'legs'],
    source: { program: 'edc', label: 'EDC', week: 1, day: 1, sessionIndex: 0, mainLift: 'deadlift', role: 'conditioning' },
    timer: { type: 'emom', duration_sec: 600, interval_sec: 60, rounds: 10 },
    raw: `At the Top of Every Minute for 10-15 Minutes depending on your level
5 Burpees
5 Squats
5 Push-Ups
15 Mountain Climbers
15 Jumping Jacks
If you want more rest, move faster. Advanced athletes will get this done in 25-30 seconds. If you
cannot fit all of this into the minute then drop the reps to 3/3/3/12/12 Respectively.`
  }),
  sourceBlock({
    id: 'edc-w1d2-conditioning',
    tags: ['calisthenics', 'pull', 'press', 'legs'],
    source: { program: 'edc', label: 'EDC', week: 1, day: 2, sessionIndex: 1, mainLift: 'ohp', role: 'conditioning' },
    timer: { type: 'amrap', duration_sec: 600 },
    raw: `Get As Far As you Can in 10 Minutes
1 Pull-Up
2 Dips or Push-Ups
3 Squats
2 Pull-Ups
4 Dips or Push-Ups
6 Squats
4 Pull-Up
8 Dips or Push-Ups
12 Squats
5 Pull-Ups
16 Dips or Push-Ups
24 Squats...
Continue to Double the Reps of Each Exercise, Each Round - Get as Far as you Can in 10 minutes.`
  }),
  sourceBlock({
    id: 'edc-w1d4-conditioning',
    tags: ['calisthenics', 'pull', 'press', 'legs'],
    source: { program: 'edc', label: 'EDC', week: 1, day: 4, sessionIndex: 3, mainLift: 'bench', role: 'conditioning' },
    timer: { type: 'emom', duration_sec: 1200, interval_sec: 30, rounds: 40 },
    raw: `Every :30 Seconds for 10-15 Minutes Depending on your level
3 Pull-Ups
7 Push-Ups
12 Squats`
  }),
  sourceBlock({
    id: 'edc-w2d1-conditioning',
    tags: ['calisthenics', 'pull', 'press', 'legs'],
    source: { program: 'edc', label: 'EDC', week: 2, day: 1, sessionIndex: 4, mainLift: 'deadlift', role: 'conditioning' },
    timer: { type: 'sequence', duration_sec: 300, rounds: 5 },
    raw: `In Front of a Running Clock - Use Inverted Rows if You can't Do Pull-Ups
Minute 1: 1 Pull-Up/2 Burpees/3 Push-Ups/4 Squats
Minute 2: 2 Pull-Ups/3 Burpees/4 Push-Ups/5 Squats
Minute 3: 3 Pull-Ups/4 Burpees/5 Push-Ups/6 Squats
Minute 4: 4 Pull-Ups/5 Burpees/6 Push-Ups/7 Squats
Minute 5: 5 Pull-Ups/6 Burpees/7 Push-Ups/8 Squats
...Continue to add reps every minute until you can no longer keep up with the clock. If you aren't
tired enough, work your way back down the ladder.
MINUTES COMPLETED: _________________`
  }),
  sourceBlock({
    id: 'edc-w2d4-conditioning',
    tags: ['calisthenics', 'press', 'locomotion'],
    source: { program: 'edc', label: 'EDC', week: 2, day: 4, sessionIndex: 7, mainLift: 'bench', role: 'conditioning' },
    timer: { type: 'rounds', rounds: 3 },
    raw: `3 Rounds with as Little rest as Possible
:60 Seconds Max Reps Push-Ups - Full Out Effort!
100 Foot Bear Walk
100 Foot Gator Walk
100 Foot Crab Walk
Get Right back to your Push-Ups.`
  }),
  sourceBlock({
    id: 'edc-w4d2-conditioning',
    tags: ['calisthenics', 'pull', 'press', 'legs'],
    source: { program: 'edc', label: 'EDC', week: 4, day: 2, sessionIndex: 13, mainLift: 'ohp', role: 'conditioning' },
    timer: { type: 'for_time' },
    raw: `As Fast As you Can
15 Pull-Ups or 25 inverted Rows
15 Dips or Bench Dips If Necessary
15 Squat Jumps
10 Pull-Ups or 20 inverted Rows
10 Dips or Bench Dips If Necessary
10 Squat Jumps
5 Pull-Ups or 10 inverted Rows
5 Dips or Bench Dips If Necessary
5 Squat Jumps`
  }),
  sourceBlock({
    id: 'edc-w7d2-conditioning',
    tags: ['calisthenics', 'pull', 'press', 'core'],
    source: { program: 'edc', label: 'EDC', week: 7, day: 2, sessionIndex: 25, mainLift: 'ohp', role: 'conditioning' },
    timer: { type: 'rounds', rounds: 10 },
    raw: `10 Rounds
:10 Seconds Pull-Ups or Inverted Rows
:20 Dips or Deficit Push-Ups
:30 Seconds Plank`
  }),
  sourceBlock({
    id: 'edc-w8d2-conditioning',
    tags: ['calisthenics', 'pull', 'press'],
    source: { program: 'edc', label: 'EDC', week: 8, day: 2, sessionIndex: 29, mainLift: 'ohp', role: 'conditioning' },
    timer: { type: 'sequence', duration_sec: 600, rounds: 10 },
    raw: `For 10 Rounds
:20 Seconds Max Reps Pull-Ups or Inverted Rows
:20 Seconds Max Reps Burpees or Hand Release Push-Ups
:20 Seconds Rest`
  }),
  sourceBlock({
    id: 'edc-w2d3-assistance',
    tags: ['legs', 'pull', 'calisthenics'],
    source: { program: 'edc', label: 'EDC', week: 2, day: 3, sessionIndex: 6, mainLift: 'squat', role: 'assistance' },
    timer: { type: 'amrap', duration_sec: 300 },
    raw: `Grab a Pair of Light(ish) Dumbbells
For the next 5 Minutes You can choose between Lunges or Step-Ups. There are no sets - You just
move for 5 Minutes.
But Every time you need to stop, you owe 4 Pull-Ups or 8 Inverted Rows before you can return to the
Lunges.
A good Goal would be 40 (Total) Lunges per minute or 200 Total Reps.
SCORE:__________________`
  }),
  sourceBlock({
    id: 'edc-w2d1-carry',
    tags: ['carry', 'calisthenics', 'grip'],
    source: { program: 'edc', label: 'EDC', week: 2, day: 1, sessionIndex: 4, mainLift: 'deadlift', role: 'carry' },
    timer: { type: 'emom', duration_sec: 600, interval_sec: 60, rounds: 10 },
    raw: `At the Top of Every Minute for 10 minutes
3 Burpees (Optional)
100 Foot Farmer's Walk @ 70% of Your 1RM 50ft Walk without Drops
Take the Remainder of the Minute to Rest`
  }),
  sourceBlock({
    id: 'edc-w17d3-sandbag-burpee-carry',
    tags: ['carry', 'sandbag', 'calisthenics', 'conditioning'],
    source: { program: 'edc', label: 'EDC', week: 17, day: 3, sessionIndex: 66, mainLift: 'squat', role: 'carry' },
    timer: { type: 'emom', duration_sec: 600, interval_sec: 60, rounds: 10 },
    raw: `At the Top of Every Minute for 10 minutes Complete
50 Foot Sandbag Carry (Lighter Sandbag)
3 Burpees
50 Foot Sandbag Carry Back (Heavier Sandbag)
Take the Remainder of the Minute to Rest`
  }),
  sourceBlock({
    id: 'edc-w18d3-sandbag-farmer-carry',
    tags: ['carry', 'sandbag', 'grip'],
    source: { program: 'edc', label: 'EDC', week: 18, day: 3, sessionIndex: 70, mainLift: 'squat', role: 'carry' },
    timer: { type: 'emom', duration_sec: 600, interval_sec: 60, rounds: 10 },
    raw: `At the Top of Every Minute for 10 Minutes Complete:
50 Foot Sandbag Carry (At Bodyweight or Heavier)
50 Foot Farmer's Carry (At 70-80% of your 1RM 50ft Carry)
Take the Remainder of the Minute to Rest`
  }),
  sourceBlock({
    id: 'rpm2-w2d1-sandbag-front-carry',
    tags: ['carry', 'sandbag', 'grip'],
    source: { program: 'rpm2', label: 'RPM2', week: 2, day: 1, sessionIndex: 4, mainLift: 'deadlift', role: 'carry' },
    timer: { type: 'emom', duration_sec: 600, interval_sec: 60, rounds: 10 },
    raw: `Sandbag, Loading Pin, Keg, Stone, Plates, Odd Object Front Carry (MEDIUM)
At the Top of Every Minute for 10 Minutes, Complete:
100 Foot Front Carry (Bear Hug Position) @ 50-55% of Your 50 ft Maximum Carry weight.
Take the Remainder of the Minute to Rest
or Add Burpees or Push-Ups during the Remainder of the Minute
*If Not Possible, Replace the Carry with Marching in place or your Favorite Deadlift or Row Variation but utilize the same reps & Intensity.`
  }),
  sourceBlock({
    id: 'rpm2-w4d1-sandbag-extensions',
    tags: ['hinge', 'sandbag', 'conditioning'],
    source: { program: 'rpm2', label: 'RPM2', week: 4, day: 1, sessionIndex: 12, mainLift: 'deadlift', role: 'conditioning' },
    timer: { type: 'emom', duration_sec: 600, interval_sec: 60, rounds: 10 },
    raw: `1 Motion Sandbag Extensions or Kettlebell/Dumbbell Snatches
At the Top of Every Minute for 10 Minutes, Complete:
5-8 (1 Motion) Sandbag Extensions
Or
8-10 Single Arm Kettlebell Snatches (Each Side)`
  }),
  sourceBlock({
    id: 'powerbuilder-w2d1-odd-object-carry',
    tags: ['carry', 'sandbag', 'grip'],
    source: { program: 'powerbuilder', label: 'Powerbuilder', week: 2, day: 1, sessionIndex: 4, mainLift: 'deadlift', role: 'conditioning' },
    timer: { type: 'for_time' },
    raw: `1 Mile Odd Object Carry (Plates, Dumbbells, Sandbag, Farmer's, etc). Make it heavy.  Get uncomfortable. Become Better.`
  }),
  sourceBlock({
    id: 'powerbuilder-lite-w2d3-strongman',
    tags: ['strongman', 'sandbag', 'carry', 'legs'],
    source: { program: 'powerbuilder_lite', label: 'Powerbuilder Lite', week: 2, day: 3, sessionIndex: 6, mainLift: 'squat', role: 'strongman' },
    timer: { type: 'rounds', rounds: 4, rest_sec: 120 },
    raw: `3-4 Rounds Depending on how heavy you go
Feel Free to use a sandbag or any other strongman implement if you have access!!
Hold a HEAVY DB's or KB's in Front Rack Position
Squat 8 Times
Carry the DB/KB's 50ft and
Squat 8 more times
Now Carry the DB/KB's 50ft back home.
Place them on the ground and take 2 Minutes Rest Between Rounds`
  }),
  sourceBlock({
    id: 'massbuilder-w2d3-sandbag-deadlift-power',
    tags: ['hinge', 'sandbag', 'carry', 'core'],
    source: { program: 'massbuilder', label: 'Massbuilder', week: 2, day: 3, sessionIndex: 6, mainLift: 'deadlift', role: 'strength' },
    timer: { type: 'rounds', rounds: 3, rest_sec: 90 },
    raw: `Deadlift Focus (Power)
Set 1: 3 Sandbag/Medicine Ball Over Shoulder (As Close to Body Weight As possible) or 5 Max
Distance Broad Jumps
10 Paused Deadlifts (1" Off Floor) @ 60% Of your 1RM
50 Foot Single Arm Farmer's Carry (Each Side) Goal is .75% Bodyweight but do what you can do.
8 Ring Layouts or Ab Wheel/Barbell Roll-Outs
Rest 90 Seconds and get right back to your Deadlifts
Set 2: 3 Sandbag/Medicine Ball Over Shoulder (As Close to Body Weight As possible) or 5 Max
Distance Broad Jumps
8 Paused Deadlifts (1" Off Floor) @ 70% Of your 1RM
50 Foot Single Arm Farmer's Carry (Each Side) Goal is .75% Bodyweight but do what you can do.
8 Ring Layouts or Ab Wheel/Barbell Roll-Outs
:90 Seconds Rest
Set 3: 3 Sandbag/Medicine Ball Over Shoulder (As Close to Body Weight As possible) or 5 Max
Distance Broad Jumps
As Many Paused Deadlifts (1" Off Floor) As Possible @ 80% Of your 1RM (Goal 6+)
50 Foot Single Arm Farmer's Carry (Each Side) Goal is .75% Bodyweight but do what you can do.
8 Ring Layouts or Ab Wheel/Barbell Roll-Outs
:90 Seconds Rest`
  }),
  sourceBlock({
    id: 'rpm2-w1d2-conditioning',
    tags: ['calisthenics', 'pull', 'press', 'legs'],
    source: { program: 'rpm2', label: 'RPM2', week: 1, day: 2, sessionIndex: 1, mainLift: 'squat', role: 'conditioning' },
    timer: { type: 'emom', duration_sec: 600, interval_sec: 60, rounds: 10 },
    raw: `Pull-Ups, Push-Ups & Lunges
At the Top of Every Minute for 10 Minutes, Complete:
5 Pull-Ups or Inverted Rows x2
5 Push-Ups
5 Lunges (Each Side)
Take the Remainder of the Minute to Rest`
  }),
  sourceBlock({
    id: 'rpm2-w3d1-conditioning',
    tags: ['calisthenics', 'pull', 'press', 'legs'],
    source: { program: 'rpm2', label: 'RPM2', week: 3, day: 1, sessionIndex: 8, mainLift: 'deadlift', role: 'conditioning' },
    timer: { type: 'amrap', duration_sec: 600 },
    raw: `Get as Far as You Can in 10 Minutes
1 Pull-Up (or Inverted Row)
2 Dips (or Bench Dips)
3 Push-Ups
4 Squats
2 Pull-Ups (or Inverted Rows)
3 Dips (or Bench Dips)
4 Push-Ups
5 Squats
3 Pull-Up (or Inverted Row)
4 Dips (or Bench Dips)
5 Push-Ups
6 Squats
Continue to add 1 Rep per Exercise, per Round for the allotted 10 Minutes`
  }),
  sourceBlock({
    id: 'rpm2-w5d4-conditioning',
    tags: ['calisthenics', 'press', 'legs'],
    source: { program: 'rpm2', label: 'RPM2', week: 5, day: 4, sessionIndex: 19, mainLift: 'squat', role: 'conditioning' },
    timer: { type: 'for_time' },
    raw: `Bring Sally Up
Choose a Bodyweight Exercise such as Squats, Push-Ups, Dips, etc
Then, search for the song "Flower" by Moby on youtube. Push play and follow the lyrics of the song.
Every time the song says, "Bring Sally Down" - Drop into the bottom of your squat or push-up position (DON'T LET CHEST TOUCH!) and Stay there until you hear the song say, "Bring Sally up". At that time, return to starting position. It is only 30+ Reps but it is hard. If it is too Easy, Add Weight or choose a weighted exercise.`
  }),
  sourceBlock({
    id: 'rpm2-w1d1-carry',
    tags: ['carry', 'grip', 'calisthenics'],
    source: { program: 'rpm2', label: 'RPM2', week: 1, day: 1, sessionIndex: 0, mainLift: 'deadlift', role: 'carry' },
    timer: { type: 'emom', duration_sec: 600, interval_sec: 60, rounds: 10 },
    raw: `Farmer's Walk (LIGHT)
At the Top of Every Minute for 10 Minutes, Complete:
150 Foot Farmer's Carry @ 40-45% of Your 50 ft Maximum Carry weight.
Take the Remainder of the Minute to Rest
or Add 3-5 Burpees during the Remainder of the Minute
*If Carrying or Marching in place is Not Possible, Replace the Carry with your Favorite Deadlift or Row Variation but utilize the same reps & Intensity.`
  }),
  sourceBlock({
    id: 'powerbuilder-w2d3-conditioning',
    tags: ['calisthenics', 'pull', 'press'],
    source: { program: 'powerbuilder', label: 'Powerbuilder', week: 2, day: 3, sessionIndex: 6, mainLift: 'squat', role: 'conditioning' },
    timer: { type: 'emom', duration_sec: 600, interval_sec: 60, rounds: 10 },
    raw: `At the Start of Every Minute
Minute 1: 1 Pull-Up, 2 Burpees, 3 Push-Ups, 4 Mountain Climbers
Minute 2: 2 Pull-Ups, 4 Burpees, 6 Push-Ups, 8 Mountain Climbers
Minute 3: 3 Pull-Ups, 6 Burpees, 9 Push-Ups, 12 Mountain Climbers
Minute 4: 4 Pull-Ups, 8 Burpees, 12 Push-Ups, 16 Mountain Climbers
Minute 5: 5 Pull-Ups, 10 Burpees, 15 Push-Ups, 20 Mountain Climbers
Minute 6: 5 Pull-Ups, 10 Burpees, 15 Push-Ups, 20 Mountain Climbers
Minute 7: 4 Pull-Ups, 8 Burpees, 12 Push-Ups, 16 Mountain Climbers
Minute 8: 3 Pull-Ups, 6 Burpees, 9 Push-Ups, 12 Mountain Climbers
Minute 9: 2 Pull-Ups, 4 Burpees, 6 Push-Ups, 8 Mountain Climbers
Minute 10: 1 Pull-Up, 2 Burpees, 3 Push-Ups, 4 Mountain Climbers`
  }),
  sourceBlock({
    id: 'powerbuilder-w3d4-conditioning',
    tags: ['calisthenics', 'pull', 'press'],
    source: { program: 'powerbuilder', label: 'Powerbuilder', week: 3, day: 4, sessionIndex: 11, mainLift: 'bench', role: 'conditioning' },
    timer: { type: 'rounds', rounds: 3 },
    raw: `20, 15, 10 Reps of
Pull-Ups
Ring Dips
Run 400 Meters Between Rounds`
  }),
  sourceBlock({
    id: 'powerbuilder-w1d4-assistance',
    tags: ['press', 'calisthenics'],
    source: { program: 'powerbuilder', label: 'Powerbuilder', week: 1, day: 4, sessionIndex: 3, mainLift: 'bench', role: 'assistance' },
    timer: { type: 'rounds', rest_sec: 90, rounds: 4 },
    raw: `4 Rounds of the Following Giant Set
15 Neutral Grip Dumbbell Bench Presses (As Heavy As Possible - Ramping)
15 Dips (Bench Dips if Necessary)
20 Band or Cable Trice Extensions (As Heavy As Possible)
***No Rest between exercises.  Take :90 Seconds Rest after you have finished all 3 and get right back to it.`
  }),
  sourceBlock({
    id: 'powerbuilder-lite-w1d2-conditioning',
    tags: ['calisthenics', 'pull', 'press', 'carry'],
    source: { program: 'powerbuilder_lite', label: 'Powerbuilder Lite', week: 1, day: 2, sessionIndex: 1, mainLift: 'ohp', role: 'conditioning' },
    timer: { type: 'rounds', rounds: 3 },
    raw: `3 Rounds
5 Pull-Ups or 20 Inverted Rows
50ft DB or KB Waiter's Walk (Left Side)
10 Burpees or 30 Push-Ups
50ft DB or KB Waiter's Walk (Right Side)`
  }),
  sourceBlock({
    id: 'powerbuilder-lite-w1d3-conditioning',
    tags: ['calisthenics', 'legs'],
    source: { program: 'powerbuilder_lite', label: 'Powerbuilder Lite', week: 1, day: 3, sessionIndex: 2, mainLift: 'squat', role: 'conditioning' },
    timer: { type: 'amrap', duration_sec: 420 },
    raw: `As Many Rounds As possible in 7 Minutes
20 Bodyweight Squats
20 Bodyweight Stepping Lunges
20 Bodyweight Jumping Lunges (Just barely leave the ground)
10 Bodyweight Jumping Squats (Just barely leave the ground)`
  }),
  sourceBlock({
    id: 'powerbuilder-lite-w1d4-conditioning',
    tags: ['calisthenics', 'press'],
    source: { program: 'powerbuilder_lite', label: 'Powerbuilder Lite', week: 1, day: 4, sessionIndex: 3, mainLift: 'bench', role: 'conditioning' },
    timer: { type: 'ladder' },
    raw: `Go As Far as You Can
Drop & Complete 1 Push-Up, then Stand.
Drop & Complete 2 Push-Ups, then Stand.
Drop & Complete 3 Push-Ups, then Stand.
Continue this pattern until you can no longer complete Push-ups. You can follow the ladder back down if you so desire.`
  }),
  sourceBlock({
    id: 'massbuilder-w1d2-conditioning',
    tags: ['press', 'calisthenics'],
    source: { program: 'massbuilder', label: 'Massbuilder', week: 1, day: 2, sessionIndex: 1, mainLift: 'ohp', role: 'conditioning' },
    timer: { type: 'interval', work_sec: 90, rest_sec: 90 },
    raw: `In Front of A running Clock
:90 Seconds Max Reps Close Grip Push-Ups
:90 Seconds Rest
:60 Seconds Max Reps Close Grip Push-Ups
:60 Seconds Rest
:30 Seconds Max Reps Close Grip Push-Ups
:30 Seconds Rest
:90 Seconds Max Reps Deficit Push-Ups
:90 Seconds Rest
:60 Seconds Max Reps Deficit Push-Ups
:60 Seconds Rest
:30 Seconds Max Reps Deficit Push-Ups
:30 Seconds Rest
:90 Seconds Max Reps Hand Release Push-Ups
:90 Seconds Rest
:60 Seconds Max Reps Hand Release Push-Ups
:60 Seconds Rest
:30 Seconds Max Reps Hand Release Push-Ups
:30 Seconds Rest`
  }),
  sourceBlock({
    id: 'linear-w10d3-conditioning',
    tags: ['calisthenics', 'press', 'legs'],
    source: { program: 'linear', label: 'Linear', week: 10, day: 3, sessionIndex: 38, mainLift: 'squat', role: 'conditioning' },
    timer: { type: 'emom', duration_sec: 720, interval_sec: 60, rounds: 12 },
    raw: `At the Top of Every Minute for 12 Minutes
3-5 Burpees
3-5 Squats (Bodyweight)
3-5 Push-Ups
10-15 Mountain Climbers
10-15 Jumping Jacks`
  })
]

function shortPrescription(raw) {
  const lines = raw.split('\n').map((line) => line.trim()).filter(Boolean)
  return lines.slice(1, 4).join(' / ') || lines[0] || ''
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
  return {
    week: Number(week),
    day: Number(day),
    frequency: Number(frequency),
    phase: phaseForWeek(Number(week), deload),
    primaryFocus: focusList[0] || 'general',
    focusList,
    focusSet,
    hasHinge: focusSet.has('hinge'),
    hasSquat: focusSet.has('squat'),
    hasPress: focusSet.has('press'),
    hasOverhead: focusSet.has('overhead'),
    density: frequency >= 5 ? 'baja' : frequency === 4 ? 'media' : 'alta'
  }
}

function scoreCandidate(candidate, profile, kind) {
  let score = 100
  const tags = candidate.tags || []

  if (kind === 'assistance' && tags.includes('calisthenics')) score += 18
  if (kind === 'upper' && tags.includes('upper_back')) score += 14
  if (tags.includes('sandbag')) score += kind === 'upper' ? 10 : 8
  if (tags.includes('sandbag') && candidate.source.program.startsWith('powerbuilder')) score += 18
  if (tags.includes('pull') && (profile.hasPress || profile.hasOverhead)) score += 8
  if (tags.includes('legs') && profile.hasSquat) score += 7
  if (tags.includes('press') && (profile.hasPress || profile.hasOverhead)) score += 5
  if (tags.includes('carry') && !profile.hasHinge) score += 5
  if (candidate.source.mainLift === profile.primaryFocus) score += 5
  if (profile.phase === 'deload' && candidate.timer?.duration_sec && candidate.timer.duration_sec > 720) score -= 6
  if (profile.phase === 'peak' && tags.includes('carry')) score -= 4

  return score
}

function deterministicBias(index, seed) {
  return (((seed + 11) * (index + 3) * 17) % 23) / 10
}

function pickOptions(pool, profile, seed, count, kind) {
  const scored = pool
    .map((candidate, index) => ({
      candidate,
      score: scoreCandidate(candidate, profile, kind) + deterministicBias(index, seed)
    }))
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.candidate)

  const windowSize = Math.min(scored.length, Math.max(count * 3, 8))
  const window = scored.slice(0, windowSize)
  const offset = seed % window.length
  const rotated = [...window.slice(offset), ...window.slice(0, offset)]
  const picked = []

  for (const candidate of rotated) {
    const primary = candidate.tags?.[0] || candidate.role
    const alreadyHasPrimary = picked.some((item) => (item.tags?.[0] || item.role) === primary)
    if (picked.length < 2 || !alreadyHasPrimary) picked.push(candidate)
    if (picked.length >= count) break
  }
  for (const candidate of rotated) {
    if (picked.length >= count) break
    if (!picked.some((item) => item.id === candidate.id)) picked.push(candidate)
  }

  return picked
}

function tagText(tags = []) {
  const labels = {
    calisthenics: 'calistenia',
    pull: 'tiron',
    press: 'empuje',
    legs: 'pierna',
    row: 'remo',
    core: 'core',
    carry: 'carry',
    grip: 'agarre',
    locomotion: 'locomocion',
    vertical_pull: 'dominadas',
    complex: 'complex',
    hinge: 'bisagra',
    sandbag: 'sandbag',
    upper_back: 'espalda alta',
    conditioning: 'conditioning',
    strongman: 'strongman'
  }
  return tags.map((tag) => labels[tag] || tag).join(' / ')
}

function dayRationale(profile, upperBackOptions, assistanceOptions) {
  const focusText = profile.focusList.length ? profile.focusList.join(', ') : 'general'
  return [
    `Dia ${focusText}; fase ${profile.phase}; dosis ${profile.density}.`,
    'Todas las opciones salen de bloques reales de training-montage.',
    `Upper back: ${upperBackOptions.map((item) => item.sourceLabel).join(' | ')}.`,
    `Asistencia: ${assistanceOptions.map((item) => item.sourceLabel).join(' | ')}.`
  ]
}

export function specimenTemplateForSession({ week, day, frequency, deload, lifts = [] }) {
  const profile = sessionProfile({ week, day, frequency, deload, lifts })
  const seed = (profile.week - 1) * profile.frequency + (profile.day - 1)
  const upperBackOptions = pickOptions(UPPER_SOURCE_BLOCKS, profile, seed, 3, 'upper').map((item) => ({
    ...item,
    emphasis: `${tagText(item.tags)} - ${item.sourceLabel}`
  }))
  const assistanceOptions = pickOptions(ASSISTANCE_SOURCE_BLOCKS, profile, seed + 5, 5, 'assistance').map((item) => ({
    ...item,
    type: item.role,
    emphasis: `${tagText(item.tags)} - ${item.sourceLabel}`
  }))

  return {
    id: `specimen-W${week}D${day}`,
    title: 'Training Montage templates',
    density: profile.density,
    phase: profile.phase,
    profile: {
      primaryFocus: profile.primaryFocus,
      focusList: profile.focusList
    },
    sourcePolicy: 'training-montage',
    upperBackOptions,
    assistanceOptions,
    upperBack: upperBackOptions[0],
    assistance: assistanceOptions[0],
    rationale: dayRationale(profile, upperBackOptions, assistanceOptions)
  }
}

export function timerFromSpecimen(specimen) {
  const timer = specimen?.assistance?.timer
  if (!timer) return { label: 'Descanso 3:00', seconds: 180, mode: 'countdown' }
  if (timer.type === 'emom') {
    const seconds = timer.duration_sec || (timer.rounds || 10) * (timer.interval_sec || 60)
    return { label: `EMOM ${Math.round(seconds / 60)}:00`, seconds, mode: 'emom' }
  }
  if (timer.type === 'amrap') {
    const seconds = timer.duration_sec || 600
    return { label: `AMRAP ${Math.round(seconds / 60)}:00`, seconds, mode: 'countdown' }
  }
  if (timer.type === 'sequence') {
    const seconds = timer.duration_sec || 600
    return { label: `Secuencia ${Math.round(seconds / 60)}:00`, seconds, mode: 'countdown' }
  }
  if (timer.type === 'interval') {
    const seconds = timer.duration_sec || ((timer.work_sec || 20) + (timer.rest_sec || 10)) * (timer.rounds || 8)
    return { label: `Intervalos ${timer.work_sec || 20}/${timer.rest_sec || 10}`, seconds, mode: 'countdown' }
  }
  if (timer.type === 'rounds') return { label: `${timer.rounds || 3} rondas`, seconds: timer.rest_sec || 90, mode: 'countdown' }
  if (timer.type === 'for_time') return { label: 'For time', seconds: 0, mode: 'stopwatch' }
  return { label: 'Cronometro', seconds: 0, mode: 'stopwatch' }
}

export function alsruheConditioningCatalog() {
  return ASSISTANCE_SOURCE_BLOCKS.filter((block) => !/sled|trineo/i.test(`${block.title}\n${block.prescription}`))
}

export function timerFromConditioning(block) {
  return timerFromSpecimen({ assistance: block })
}
