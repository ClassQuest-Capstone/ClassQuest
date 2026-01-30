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
- dynamic recent activity feed
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
1. Login & logout implementation (Alsmost Done)
2. Signup implementation (Almost done)
3. Quest creation implementation (started)
4. adding quests to students side

Dynamic (TODO:)

Dynamic XP scaling

Dynamic question generation / question pools

Dynamic class/party assignment

Dynamic profile syncing (Cognito → DynamoDB)

Dynamic UI components (React/Tailwind)

Dynamic quest/event triggers

Dynamic teacher dashboards