for teachers page quests page will show previous quests and students performance stats in graph form

Assign profile pictures to students based off which of the 3 characters to select

**Create QuestButton should save tags and still create quests**


TODO:
Teachers:
Dashboard: 
- profile picture to pick from 
- dynamic recent activity feed (Almost done)
- dynamic student cards (top student)

Quests (subjects):
- makequest connect with backend to add questions and answers (TODO: fix)
- make quest properly function with backend
- Quest does not add tags from creation currently (TODO: fix)
- make timer on quests optional 
- make quest difficulty with a set value for gold & XP for each difficulty level as a **suggestion**

Guardians protect individual members
mage protects the entire guild  (keep it simple)

post question all guilds answer then reveal guild who is supposed to answer the question (and take damage for wrong questions or boss takes damage for wrong questions) (give teachers the option to keep boss battle public or private and quests and edit other teachers quests also)

Guilds page still missing 

all giulds should have the same hearts per boss battle (one set of hearts for all members)

Settings: (DONE)
- tab on table one for students other for performance stats

for boss fight
- if boss fight assign boss based on subject
for teachers page quests page will show previous quests and students performance stats in graph form

Assign profile pictures to students based off which of the 3 characters to select

**Create QuestButton should save tags and still create quests**


Frontend has error handling: teacherService.tsx falls back to default values.
Infrastructure is set up: DynamoDB table, API Gateway, and Lambda functions exist.
Signup endpoints are commented out, so they won’t break.

ISSUES
Not compatible. The frontend calls /api/teacher/${teacherId}/stats, but the backend doesn’t define it. The dashboard will show zeros and console errors. Add the missing endpoint in the infrastructure stack to make it work.


TODO:
Teachers:
Dashboard: 
- profile picture to pick from 
- dynamic recent activity feed (80% done)
- dynamic student cards (top student)

Quests (subjects):
- makequest connect with backend to add questions and answers (TODO: fix)
- make quest properly function with backend
- Quest does not add tags from creation currently (TODO: fix)
- make timer on quests optional 
- make quest difficulty with a set value for gold & XP for each difficulty level as a **suggestion**

Guardians protect individual members
mage protects the entire guild  (keep it simple)

post question all guilds answer then reveal guild who is supposed to answer the question (and take damage for wrong questions or boss takes damage for wrong questions) (give teachers the option to keep boss battle public or private and quests and edit other teachers quests also)

Guilds page still missing (Done TODO: backend connection & )

all giulds should have the same hearts per boss battle (one set of hearts for all members)

Settings: (DONE)
- tab on table one for students other for performance stats

for boss fight
- if boss fight assign boss based on subject

Current TODO:
1. Login & logout implementation (DONE)
2. Signup implementation (DONE)
3. Quest creation implementation (DONE)
4. adding quests to students side (DONE)
5. adding quests to teachers side (DONE)
6. adding students to classes alongside their xp, gold and level to make this editable(DONE)
7. adding rewards to classes & creating custom rewards for classes
8. Boss Battle students side 
9. Leaderboards teachers side
10. Leader boards students side
11. Student's shop


Dynamic (TODO:)

GOLD: +30 per quests / +100 per boss battles (remove individual dolg reward option from quests creation)


Dynamic question generation / question pools (Future work)

Dynamic profile syncing (Cognito → DynamoDB) (DONE)

Dynamic UI components (React/Tailwind) (DONE)


Dynamic teacher dashboards (Almost done waiting on backend)

TODO: fix gold reward from per question to total gold form subjects

infra ---> stacks ---> api.ts folder

TODO:

Document tutorial and fix so it only shows on first signup (DONE)

TODO: fix the missing information on classes page and start work on restructuring quests apge and implementing backend (DONE)

TODO: Remove my subjects for students (class Rewards) (DONE)

TODO: system architecture diagram (DONE)

TODO: fix sequence diagram (DONE)

SCRUM NOTES

TODO: Student management page (teachers) & integration with backend (DONE)

TODO: call the hearts regen function in characters and let it populate backend (DONE)

TODO: look into XP not being added to students teacher management (DONE)

TODO: Active tabs should call from backend (DONE)

TODO: Top 3 students should call from backend (DONE)

TODO: Adjust quest cards so that it shows date/ time more clearly and progress bar updates (DONE)

TODO: Boss battle implementation for teachers & students side (IN PROGRESS)

TODO: Assist alvin with boss battle and correct minor errors in student tutorial, editing quest question 

TODO: recent activity display of 5 latest activities on teachers page (DONE)

TODO: recent activity tracks rewards transactiions (Almost DONE)

TODO: stats should be leader boards for all classes

TODO: reshape rewards creation so that theachers can issue class rewards like phone time etc.

TODO: 

TODO: check date so that quest only shows up on the date its assigned if it date is not reached it stays as draft until the start date is reached (DONE)

TODO: Students join waiting room, each guild should only show active players (only ones with rewards) this should happen when the click join fighr on guilds page using modal then on modal when teacher clicks start battle it auto directs to bossfight page.

students load on waiting screen awaiting teachers to click start 

each vote on answers

view guilds perfromance at end like kahoot 



NOTE: Heart timer stacks on it self on logout (tell team)

TODO: greyed out & invisible armours/ equipments

npx sst dev --stage local1

pwd: Dev12345!

pwd student: Student50!


EXTRA TIME: (TODO:)

IF TIME ALLOWED: (REMOVE CLASS FROM DB)

