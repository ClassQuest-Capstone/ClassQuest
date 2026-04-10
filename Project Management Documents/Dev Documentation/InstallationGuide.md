# ClassQuest Installation & Usage Guide


This comprehensive guide covers setup, development, and usage of ClassQuest a web-based educational RPG platform for gamifying classroom activities.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Project Structure](#project-structure)
3. [Installation](#installation)
4. [AWS Configuration](#aws-configuration)
5. [Environment Variables](#environment-variables)
6. [Development](#development)
7. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before installing ClassQuest, ensure you have the following installed on your system:

### Required Software

| Software | Minimum Version | Purpose |
|----------|-----------------|---------|
| **Node.js** | v18.x or higher | JavaScript runtime |
| **npm** | v9.x or higher | Package manager (comes with Node.js) |
| **AWS CLI** | v2.x | AWS command line interface |
| **Git** | Latest | Version control |

### AWS Requirements

- An **AWS Account** with administrative access
- **AWS CLI** configured with credentials
- IAM permissions for:
  - Lambda
  - DynamoDB
  - Cognito
  - AppSync
  - API Gateway
  - S3
  - CloudFront

### Verifying Prerequisites

```powershell
# Check Node.js version
node --version

# Check npm version
npm --version

# Check AWS CLI version
aws --version

# Verify AWS credentials
aws sts get-caller-identity
```

---

## Project Structure

```
ClassQuest/
├── package.json                    # Root package.json with deployment scripts
├── app/
│   └── frontend/                   # React + Vite frontend application
│       ├── package.json
│       ├── src/
│       │   ├── api/                # API client modules
│       │   ├── components/         # React components
│       │   ├── pages/              # Page components
│       │   ├── hooks/              # Custom React hooks
│       │   ├── types/              # TypeScript types
│       │   └── utils/              # Utility functions
│       └── public/                 # Static assets
├── infra/
│   ├── sst.config.ts               # SST configuration
│   ├── graphql/
│   │   └── schema.graphql          # AppSync GraphQL schema
│   ├── packages/
│   │   └── functions/
│   │       └── src/                # Lambda function handlers
│   └── stacks/                     # SST/CDK stack definitions
│       ├── DataStack.ts            # DynamoDB tables
│       ├── AuthStack.ts            # Cognito authentication
│       ├── ApiCoreStack.ts         # HTTP API infrastructure
│       ├── TeacherApiStack.ts      # Teacher API routes
│       ├── StudentApiStack.ts      # Student API routes
│       ├── QuestApiStack.ts        # Quest API routes
│       ├── AutomationStack.ts      # Scheduled background jobs
│       └── AppSyncStack.ts         # GraphQL real-time API
└── Project Management Documents/   # Documentation
```

---

## Installation

### Step 1: Clone the Repository

```powershell
# Clone the repository
git clone https://github.com/ClassQuest-Capstone/ClassQuest.git

# Navigate to project directory
cd ClassQuest
```

### Step 2: Install Root Dependencies

From the project root directory:

```powershell
# Install root dependencies (includes SST and dev tools)
npm install
```

### Step 3: Install Frontend Dependencies

```powershell
# Navigate to frontend directory
cd app/frontend

# Install frontend dependencies
npm install

# Return to root
cd ../..
```

### Step 4: Install Infrastructure Dependencies

```powershell
# Navigate to infra directory
cd infra

# Install infrastructure dependencies
npm install

# Return to root
cd ..
```

---

## AWS Configuration

### Step 1: Configure AWS CLI

If you haven't configured AWS CLI yet:

```powershell
aws configure
```

You will be prompted for:
- **AWS Access Key ID**: Your IAM access key
- **AWS Secret Access Key**: Your IAM secret key
- **Default region name**: `ca-central-1` (recommended for ClassQuest)
- **Default output format**: `json`

### Step 2: Verify AWS Configuration

```powershell
# Verify your AWS identity
aws sts get-caller-identity

# Expected output:
# {
#     "UserId": "AIDAXXXXXXXXXXXXXXXXX",
#     "Account": "123456789012",
#     "Arn": "arn:aws:iam::123456789012:user/your-username"
# }
```

### Step 3: IAM Permissions

Ensure your IAM user/role has the following managed policies (or equivalent permissions):

- `AWSLambda_FullAccess`
- `AmazonDynamoDBFullAccess`
- `AmazonCognitoPowerUser`
- `AWSAppSyncAdministrator`
- `AmazonAPIGatewayAdministrator`
- `AmazonS3FullAccess`
- `CloudFrontFullAccess`

---

## Environment Variables

### Frontend Environment Variables

Create a `.env.local` file in `app/frontend/`:

```powershell
# Navigate to frontend
cd app/frontend

# Create .env.local file
```

Add the following content to `.env.local`:

```env
# Required: AWS Cognito Configuration
VITE_AWS_REGION=ca-central-1
VITE_COGNITO_USER_POOL_ID=your-user-pool-id
VITE_COGNITO_USER_POOL_CLIENT_ID=your-user-pool-client-id

# Required: API Gateway URL
VITE_API_URL=https://your-api-id.execute-api.ca-central-1.amazonaws.com

# AppSync Configuration (for real-time boss battles)
VITE_APPSYNC_API_URL=https://your-appsync-id.appsync-api.ca-central-1.amazonaws.com/graphql
VITE_APPSYNC_API_KEY=your-appsync-api-key

# AWS ClouldFront URL
VITE_ASSETS_CDN_URL=https://your-cloudfront-distribution-id.cloudfront.net
```

> **Note:** These values will be output after deploying the infrastructure. You can leave this file empty initially and populate it after deployment.

---

## Development

### Running the Development Environment

ClassQuest uses SST (Serverless Stack) for local development with live Lambda reloading.

#### Step 1: Start SST Dev Mode

From the project root:

```powershell
# Start SST development mode
npm run dev
```

Or with a named stage:

```powershell
# Start with a specific stage name (e.g., your name)
npx sst dev --stage dev-yourname --config infra/sst.config.ts
```

SST will:
1. Deploy the infrastructure to AWS
2. Set up live Lambda debugging
3. Output the API URLs and Cognito configuration

#### Step 2: Copy Environment Variables

After SST deploys, copy the output values to your `.env.local`:

```
Stack ClassQuestAuthStack:
  UserPoolId: ca-central-1_XXXXXXXXX
  UserPoolClientId: XXXXXXXXXXXXXXXXXXXXXXXXXX

Stack ClassQuestApiCoreStack:
  ApiEndpoint: https://xxxxxxxxxx.execute-api.ca-central-1.amazonaws.com
```

Update `app/frontend/.env.local`:

```env
VITE_AWS_REGION=ca-central-1
VITE_COGNITO_USER_POOL_ID=ca-central-1_XXXXXXXXX
VITE_COGNITO_USER_POOL_CLIENT_ID=XXXXXXXXXXXXXXXXXXXXXXXXXX
VITE_API_URL=https://xxxxxxxxxx.execute-api.ca-central-1.amazonaws.com
```

#### Step 3: Start the Frontend

In a new terminal:

```powershell
# Navigate to frontend directory
cd app/frontend

# Start Vite development server
npm run dev
```

The frontend will be available at: **http://localhost:5000**

### Development Workflow

| Command | Location | Description |
|---------|----------|-------------|
| `npm run dev` | Root | Start SST dev mode (backend) |
| `npm run dev` | `app/frontend` | Start Vite dev server (frontend) |

---


## Troubleshooting

### Common Issues

#### 1. "Missing Cognito env vars" Error

**Cause:** Environment variables not set in frontend.

**Solution:**
```powershell
# Ensure .env.local exists in app/frontend/
# Verify it contains all required VITE_* variables
```

#### 2. Frontend Can't Connect to API

**Cause:** VITE_API_URL not set or incorrect.

**Solution:**
- Check `.env.local` for correct API URL
- Ensure API is deployed and running
- Check CORS settings in API stack

#### 3. TypeScript Errors

**Cause:** Type definitions out of sync.

**Solution:**
```powershell
# Clean and rebuild
rm -rf dist .sst
npm run dev
```

### Getting Help

1. Review [User Guide](https://github.com/ClassQuest-Capstone/ClassQuest/blob/main/Project%20Management%20Documents/Tutorials%20and%20User%20guide/userGuide.md)
2. Watch [Tutorial Video]()

---

## Technology Stack Summary

| Layer | Technology |
|-------|------------|
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS |
| **Authentication** | AWS Cognito |
| **API** | AWS API Gateway (HTTP API), GraphQL (AppSync) |
| **Backend** | AWS Lambda (Node.js/TypeScript) |
| **Database** | Amazon DynamoDB |
| **Infrastructure** | SST (Serverless Stack) |
| **Real-time** | AWS AppSync (WebSocket subscriptions) |

---

## Quick Reference Commands

```powershell
# Install everything
npm install && cd app/frontend && npm install && cd ../..

# Development (two terminals)
# Terminal 1: npm run dev
# Terminal 2: cd app/frontend && npm run dev

```

---

*University of Regina – Software Systems Engineering Capstone 2025/2026*
