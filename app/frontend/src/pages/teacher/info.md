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
- makequest connect with backend to add questions and answers
- make quest properly function with backend
- 
