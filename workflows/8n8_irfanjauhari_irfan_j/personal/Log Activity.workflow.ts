import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Log Activity
// Nodes   : 15  |  Connections: 14
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// OnDemandApiTrigger                 webhook                    [creds]
// ReadPendingFailedTasks             postgres                   [creds]
// FilterTasksByStatus                function                   
// AreThereTasksToProcess             if                         
// SplitTasksIntoBatches              splitOut                   
// PrepareJiraPayload                 function                   
// CreateJiraTicket                   jira                       [creds]
// LogTimeSpent                       httpRequest                [creds]
// MoveJiraTicketToDone               jira                       [creds]
// UpdateDbStatusSuccess              postgres                   [creds]
// SendDashboardNotificationSuccess   httpRequest                
// LogWorkflowSummary                 function                   
// LogNoTasksFound                    function                   
// MoveJiraTicketToDone1              httpRequest                [creds]
// SendDashboardNotificationFailure   httpRequest                
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// OnDemandApiTrigger
//    → ReadPendingFailedTasks
//      → FilterTasksByStatus
//        → AreThereTasksToProcess
//          → SplitTasksIntoBatches
//            → PrepareJiraPayload
//              → CreateJiraTicket
//                → LogTimeSpent
//                  → MoveJiraTicketToDone
//                    → MoveJiraTicketToDone1
//                      → UpdateDbStatusSuccess
//                        → SendDashboardNotificationSuccess
//                          → LogWorkflowSummary
//         .out(1) → LogNoTasksFound
// SendDashboardNotificationFailure
//    → LogWorkflowSummary (↩ loop)
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: "QCKpB3rjHFa7WunvfC9g8",
    name: "Log Activity",
    active: true,
    settings: { executionOrder: "v1", availableInMCP: false }
})
export class LogActivityWorkflow {

    // =====================================================================
// CONFIGURATION DES NOEUDS
// =====================================================================

    @node({
        id: "a770dae1-1719-4087-8251-e912db6a15c5",
        webhookId: "e967e00d-8e98-4ea6-a8c9-df7b02e5c0ae",
        name: "On-Demand API Trigger",
        type: "n8n-nodes-base.webhook",
        version: 1,
        position: [-384, 1456],
        credentials: {httpBasicAuth:{id:"s7dUrGqut3lG9PMW",name:"Overlord"}}
    })
    OnDemandApiTrigger = {
        httpMethod: "POST",
        path: "trigger-report",
        authentication: "basicAuth",
        options: {
            responseData: "json"
        }
    };

    @node({
        id: "1fb38563-9588-4974-896b-06fdc87588ff",
        name: "Read Pending & Failed Tasks",
        type: "n8n-nodes-base.postgres",
        version: 2,
        position: [-160, 1456],
        credentials: {postgres:{id:"Wg9gdo6b0HeKl6is",name:"Report DB"}}
    })
    ReadPendingFailedTasks = {
        operation: "executeQuery",
        query: "SELECT id, summary, description, \"startDate\", \"endDate\", \"durationStr\", \"status\", \"webhookStatus\", \"userId\", \"createdAt\" FROM \"Task\" WHERE \"status\" IN ('pending', 'failed') ORDER BY \"createdAt\" ASC;",
        options: {}
    };

    @node({
        id: "0938d984-64f3-4885-a6ff-1176b037c362",
        name: "Filter Tasks by Status",
        type: "n8n-nodes-base.function",
        version: 1,
        position: [64, 1456]
    })
    FilterTasksByStatus = {
        functionCode: `// SQL already filtered for webhookStatus IN ('pending','failed').
// Just reshape the individual Postgres items into a single {tasks, count}
// so the IF node can check .count.
if (items.length === 0) {
  return [{ json: { tasks: [], count: 0 } }];
}
return [{ json: { tasks: items.map(i => i.json), count: items.length } }];`
    };

    @node({
        id: "ece81550-7158-449c-bc45-0d1dab3af010",
        name: "Are there tasks to process?",
        type: "n8n-nodes-base.if",
        version: 1,
        position: [288, 1456]
    })
    AreThereTasksToProcess = {
        conditions: {
            number: [
                {
                    value1: "={{ $json.count }}",
                    operation: "larger"
                }
            ]
        }
    };

    @node({
        id: "fa73273e-08e0-4900-990b-5f3bf5069bf7",
        name: "Split Tasks into Batches",
        type: "n8n-nodes-base.splitOut",
        version: 1,
        position: [512, 1360]
    })
    SplitTasksIntoBatches = {
        fieldToSplitOut: "tasks",
        options: {}
    };

    @node({
        id: "611873dd-a88d-43ac-9940-e2f08e21aa48",
        name: "Prepare Jira Payload",
        type: "n8n-nodes-base.function",
        version: 1,
        position: [736, 1360],
        alwaysOutputData: false,
        executeOnce: false
    })
    PrepareJiraPayload = {
        functionCode: `// Process EVERY item — using $json only reads item[0] and drops the rest.
return items.map(item => {
  const t = item.json;

  const startMs  = new Date(t.startDate).getTime();
  const endMs    = new Date(t.endDate).getTime();
  const diffSecs = Math.round((endMs - startMs) / 1000);
  const timeSpentSeconds = diffSecs > 0 ? diffSecs : 0;

  const h = t.hours   || 0;
  const m = t.minutes || 0;
  const s = t.seconds || 0;
  const durationStr = t.durationStr ||
    [h ? \`\${h}h\` : '', m ? \`\${m}m\` : '', s ? \`\${s}s\` : ''].filter(Boolean).join(' ') ||
    \`\${timeSpentSeconds}s\`;

  const startedJira = new Date(t.startDate).toISOString().replace('Z', '+0000');

  const worklogBody = {
    timeSpentSeconds,
    started: startedJira,
    comment: {
      type: 'doc',
      version: 1,
      content: [{
        type: 'paragraph',
        content: [{ type: 'text', text: \`Logged from WorkTask dashboard. Duration: \${durationStr}\` }]
      }]
    }
  };

  const adfDescription = {
    version: 1,
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: t.description || t.summary }]
      },
      {
        type: 'paragraph',
        content: [{ type: 'text', text: \`Duration: \${durationStr}\`, marks: [{ type: 'strong' }] }]
      },
      {
        type: 'paragraph',
        content: [{ type: 'text', text: \`Start: \${new Date(t.startDate).toISOString()}  →  End: \${new Date(t.endDate).toISOString()}\` }]
      }
    ]
  };

  return {
    json: {
      summary:           t.summary,
      description:       adfDescription,
      timeSpentSeconds,
      startedJira,
      durationStr,
      worklogBody,
      dueDate:           t.endDate ? new Date(t.endDate).toISOString().split('T')[0] : null,
      _raw: t
    }
  };
});`
    };

    @node({
        id: "514b5b15-8c2e-42f7-85b6-097c25f87f08",
        name: "Create Jira Ticket",
        type: "n8n-nodes-base.jira",
        version: 1,
        position: [960, 1360],
        credentials: {jiraSoftwareCloudApi:{id:"snTT7GGO5iFkIMUW",name:"My Jira"}}
    })
    CreateJiraTicket = {
        project: {
            __rl: true,
            value: "10127",
            mode: "list",
            cachedResultName: "GTP Timesheet"
        },
        issueType: {
            __rl: true,
            value: "10073",
            mode: "list",
            cachedResultName: "Task"
        },
        summary: "={{ $json.summary }}",
        additionalFields: {
            description: "={{ JSON.stringify($json.description) }}"
        }
    };

    @node({
        id: "b69f7708-8fdc-4fd1-b8d4-7f30b66824db",
        name: "Log Time Spent",
        type: "n8n-nodes-base.httpRequest",
        version: 4,
        position: [1184, 1360],
        credentials: {jiraSoftwareCloudApi:{id:"snTT7GGO5iFkIMUW",name:"My Jira"}}
    })
    LogTimeSpent = {
        method: "POST",
        url: "=https://govtech-lkpp.atlassian.net/rest/api/3/issue/{{ $json.key }}/worklog",
        authentication: "predefinedCredentialType",
        nodeCredentialType: "jiraSoftwareCloudApi",
        sendBody: true,
        specifyBody: "json",
        jsonBody: `={{ JSON.stringify($node["Prepare Jira Payload"].json.worklogBody) }}
`,
        options: {
            response: {
                response: {
                    responseFormat: "json"
                }
            },
            timeout: 15000
        }
    };

    @node({
        id: "1599a4b6-6ffe-42ee-8ada-6645ff20fae9",
        name: "Move Jira Ticket to Done",
        type: "n8n-nodes-base.jira",
        version: 1,
        position: [1408, 1360],
        credentials: {jiraSoftwareCloudApi:{id:"snTT7GGO5iFkIMUW",name:"My Jira"}}
    })
    MoveJiraTicketToDone = {
        operation: "transitions",
        issueKey: "={{ $node[\"Create Jira Ticket\"].json.key }}",
        additionalFields: {
            transitionId: "21"
        }
    };

    @node({
        id: "bebfdc33-b281-4db6-bd1a-4aa70af1e4be",
        name: "Update DB Status (Success)",
        type: "n8n-nodes-base.postgres",
        version: 2,
        position: [1856, 1360],
        credentials: {postgres:{id:"Wg9gdo6b0HeKl6is",name:"Report DB"}}
    })
    UpdateDbStatusSuccess = {
        operation: "executeQuery",
        query: "UPDATE \"Task\" SET \"status\" = 'completed', \"webhookStatus\" = 'sent', \"updatedAt\" = NOW() WHERE id = '{{ $('Prepare Jira Payload').item.json._raw.id }}' RETURNING *;",
        options: {}
    };

    @node({
        id: "6a75d274-5ade-4701-b629-d28768900728",
        name: "Send Dashboard Notification (Success)",
        type: "n8n-nodes-base.httpRequest",
        version: 4,
        position: [2080, 1360]
    })
    SendDashboardNotificationSuccess = {
        method: "POST",
        url: "=https://dashboard.irfanjauhari.com/api/notifications",
        sendHeaders: true,
        headerParameters: {
            parameters: [
                {
                    name: "Content-Type",
                    value: "application/json"
                },
                {
                    name: "x-notification-secret",
                    value: "aU1PazFNcnpvd3FkY0diOTdRelRZNkNaYkhiRGdKWUg="
                }
            ]
        },
        sendBody: true,
        specifyBody: "json",
        jsonBody: `={
  "taskId": "{{ $json.id }}",
  "type": "task_completed",
  "title": "Jira Ticket {{ $('Create Jira Ticket').item.json.key }} Created and Set to Done",
  "message": "Task",
  "status": "completed"
} `,
        options: {
            allowUnauthorizedCerts: false,
            response: {
                response: {
                    responseFormat: "json"
                }
            },
            timeout: 10000
        }
    };

    @node({
        id: "62da79a0-e590-4325-bc6b-a9add963c857",
        name: "Log Workflow Summary",
        type: "n8n-nodes-base.function",
        version: 1,
        position: [2304, 1456]
    })
    LogWorkflowSummary = {
        functionCode: `const total  = $input.all().length;
const taskIds = $input.all().map(i => i.json._raw?.id || i.json.taskId).filter(Boolean);
return [{ json: { message: \`Workflow done. Notified dashboard for \${total} task(s).\`, taskIds } }];`
    };

    @node({
        id: "ffe30d45-5d3c-4e16-ab98-203f76506f19",
        name: "Log No Tasks Found",
        type: "n8n-nodes-base.function",
        version: 1,
        position: [512, 1552]
    })
    LogNoTasksFound = {
        functionCode: "return [{ json: { message: `No pending/failed tasks found. Nothing to process.` } }];"
    };

    @node({
        id: "526a8456-f56d-4474-a2f9-da2d0c74a5dc",
        name: "Move Jira Ticket to Done1",
        type: "n8n-nodes-base.httpRequest",
        version: 4,
        position: [1632, 1360],
        credentials: {jiraSoftwareCloudApi:{id:"snTT7GGO5iFkIMUW",name:"My Jira"}}
    })
    MoveJiraTicketToDone1 = {
        method: "POST",
        url: "=https://govtech-lkpp.atlassian.net/rest/api/3/issue/{{ $('Create Jira Ticket').item.json.key }}/transitions",
        authentication: "predefinedCredentialType",
        nodeCredentialType: "jiraSoftwareCloudApi",
        sendBody: true,
        specifyBody: "json",
        jsonBody: `{
  "transition": {
    "id": "21" 
  }
}`,
        options: {
            response: {
                response: {
                    responseFormat: "text"
                }
            },
            timeout: 15000
        }
    };

    @node({
        id: "39014e42-1083-4c56-af87-edc21eed577e",
        name: "Send Dashboard Notification (Failure)",
        type: "n8n-nodes-base.httpRequest",
        version: 4,
        position: [2080, 1552]
    })
    SendDashboardNotificationFailure = {
        method: "POST",
        url: "={{ $env.NEXTAUTH_URL }}/api/notifications",
        sendHeaders: true,
        headerParameters: {
            parameters: [
                {
                    name: "Content-Type",
                    value: "application/json"
                }
            ]
        },
        sendBody: true,
        bodyParameters: {
            parameters: [
                {}
            ]
        },
        options: {
            response: {
                response: {
                    responseFormat: "json"
                }
            },
            timeout: 10000
        }
    };


    // =====================================================================
// ROUTAGE ET CONNEXIONS
// =====================================================================

    @links()
    defineRouting() {
        this.OnDemandApiTrigger.out(0).to(this.ReadPendingFailedTasks.in(0));
        this.ReadPendingFailedTasks.out(0).to(this.FilterTasksByStatus.in(0));
        this.FilterTasksByStatus.out(0).to(this.AreThereTasksToProcess.in(0));
        this.AreThereTasksToProcess.out(0).to(this.SplitTasksIntoBatches.in(0));
        this.AreThereTasksToProcess.out(1).to(this.LogNoTasksFound.in(0));
        this.SplitTasksIntoBatches.out(0).to(this.PrepareJiraPayload.in(0));
        this.PrepareJiraPayload.out(0).to(this.CreateJiraTicket.in(0));
        this.CreateJiraTicket.out(0).to(this.LogTimeSpent.in(0));
        this.LogTimeSpent.out(0).to(this.MoveJiraTicketToDone.in(0));
        this.MoveJiraTicketToDone.out(0).to(this.MoveJiraTicketToDone1.in(0));
        this.UpdateDbStatusSuccess.out(0).to(this.SendDashboardNotificationSuccess.in(0));
        this.SendDashboardNotificationSuccess.out(0).to(this.LogWorkflowSummary.in(0));
        this.MoveJiraTicketToDone1.out(0).to(this.UpdateDbStatusSuccess.in(0));
        this.SendDashboardNotificationFailure.out(0).to(this.LogWorkflowSummary.in(0));
    }
}