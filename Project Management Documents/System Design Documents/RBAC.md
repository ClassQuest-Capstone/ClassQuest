**Role Based Access Control Chart**
```mermaid
flowchart LR

    %% Roles
    A[Student]:::role
    B[Teacher]:::role
    C[Admin]:::role

    %% Student Permissions
    A --> A1[Join Class with class code]
    A --> A2[Customize Character]
    A --> A3[Participate in Quests & Boss Battles]
    A --> A4[Earn XP & Badges]
    A --> A5[View Own Progress]

    %% Teacher Permissions
    B --> B1[Create / Manage Classes]
    B --> B2[Generate Class Code]
    B --> B3[View Class Roster]
    B --> B4[Manage Students - XP, Badges, Quests]
    B --> B5[Create Boss Battles / Quests]
    B --> B6[View Student Progress]
    B --> B7[Edit Own Profile]

    %% Admin Permissions
    C --> C1[View All Classes & Users]
    C --> C2[Modify Any Class or Profile]
    C --> C3[Access Logs & Analytics]
    C --> C4[Manage Subscriptions]
    C --> C5[Override Permissions]

    %% Styling
    classDef role fill:#4C8BF5,stroke:#1A4BB3,color:#fff,font-weight:bold, font-size:50px;
    classDef perm fill:#E8F0FE,stroke:#4C8BF5,color:#000, font-size:25px;

    class A,B,C,D role;
    class A1,A2,A3,A4,A5 perm;
    class B1,B2,B3,B4,B5,B6,B7 perm;
    class C1,C2,C3,C4,C5 perm;
```

**Roles**
| Role | Description |
| ----------- | ----------- |
| Student | Join class using teachers class code to participate in quests and boss battles |
| Teacher | Create classes, generate class codes, and manage students |
| Admin | Internal system administrators for debugging, moderation, or support |

**Permissions Table**
| Action | Student | Teacher | Admin |
| ----------- | ----------- | ----------- | ----------- |
| Sign up | :heavy_check_mark: | :heavy_check_mark: | :heavy_check_mark: |
| Log in | :heavy_check_mark: | :heavy_check_mark: | :heavy_check_mark: |
| Join Class | :heavy_check_mark: | :heavy_multiplication_x: | :heavy_multiplication_x: |
| View Profile | :heavy_check_mark: | :heavy_check_mark: | :heavy_multiplication_x: |
| Edit Own Profile | :heavy_multiplication_x: | :heavy_check_mark: | :heavy_check_mark: |
| Create/Delete class | :heavy_multiplication_x: | :heavy_check_mark: | :heavy_check_mark: |
| Generate Class Code | :heavy_multiplication_x: | :heavy_check_mark: | :heavy_multiplication_x: |
| View student list | :heavy_multiplication_x: | :heavy_check_mark: | :heavy_check_mark: |
| Manage students | :heavy_multiplication_x: | :heavy_check_mark: | :heavy_check_mark: |
| Access admin panel | :heavy_multiplication_x: | :heavy_multiplication_x: | :heavy_check_mark: |
| Manage application data | :heavy_multiplication_x: | :heavy_multiplication_x: | :heavy_check_mark: |
