# Auto-Resolve On-Call Pages When a Case Is Closed

This guide walks through configuring Datadog Workflow Automation so that closing a Case Management case automatically resolves the associated On-Call page.

## Prerequisites

- A Datadog account with **Workflow Automation** enabled
- A **Datadog On-Call** team configured ([On-Call docs](https://docs.datadoghq.com/service_management/on-call/))
- A **Case Management** project set up ([Case Management docs](https://docs.datadoghq.com/service_management/case_management/))

## Step 1: Link Cases to On-Call Pages

Before building the workflow, ensure cases automatically create On-Call pages so there is a page to resolve.

1. Go to **Case Management > Settings** (gear icon on your project)
2. Under **Integrations**, find **Datadog On-Call**
3. Toggle **"Automatically page cases to On-Call"**
4. Configure paging rules:
   - **Query filter** — which cases trigger a page (e.g., by priority or attribute)
   - **Team** — which On-Call team receives the page
5. Save

Now every matching case will automatically create an On-Call page.

## Step 2: Create the Workflow

1. Navigate to **Datadog > Workflow Automation > New Workflow**
2. Name it something descriptive, e.g. `Auto-resolve page on case close`
3. Set the **Trigger**:
   - Source: **Case Management**
   - Event: **Status Transitioned**

## Step 3: Add a Condition Step

Filter so the workflow only fires when a case is moved to **Closed**:

1. Click **+ Add Step** and select **Condition**
2. Set the condition:
   ```
   Source.case.attributes.status == "closed"
   ```
3. Place all subsequent steps inside the **true** branch

## Step 4: Add the Resolve Page Action

1. Inside the condition's true branch, click **+ Add Step**
2. Search for **Datadog On-Call** and select the **Resolve Page** action
3. Map the **Page ID** from the trigger payload:
   ```
   Source.case.attributes.oncall_page_id
   ```
   > The exact field path depends on how your Case Management project exposes the linked On-Call page. Inspect the trigger payload in the workflow editor to find the correct reference.
4. Save the workflow and toggle it **On**

## Step 5: Test End-to-End

1. Start the demo app to generate alert events:
   ```sh
   bun index.ts
   ```
2. In Datadog, verify an event appears and a **Case** is created (either automatically via a Case Management rule or manually from the event)
3. Confirm an **On-Call page** is triggered for the case
4. **Close the case** in Case Management
5. Verify the On-Call page is **automatically resolved**

## Troubleshooting

| Symptom | Check |
|---|---|
| Workflow doesn't fire | Confirm the trigger is set to **Case Management > Status Transitioned** and the workflow is enabled |
| Condition never matches | Inspect the trigger payload in the workflow run history — verify the status field name and value |
| Page not resolved | Confirm the Page ID mapping is correct; check On-Call page status in the On-Call dashboard |
| No page created when case opens | Verify the On-Call integration is enabled in Case Management project settings and paging rules match |

## Architecture

```
Alert Event (error)
  └─> Case Management (case created)
        └─> On-Call Page (auto-paged via integration)

Alert Event (resolved to "ok")
  └─> index.ts closes case via API
        └─> Workflow Automation fires (Status Transitioned → CLOSED)
              └─> Condition: status == "closed"
                    └─> Datadog On-Call: Resolve Page
```
