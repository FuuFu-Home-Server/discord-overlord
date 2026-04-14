import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Hydration Reminder
// Nodes   : 2  |  Connections: 1
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// ScheduleTrigger                    scheduleTrigger            
// NotifyHydration                    httpRequest                
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// ScheduleTrigger
//    → NotifyHydration
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: "kQVDRh97IcXn2S0v",
    name: "Hydration Reminder",
    active: true,
    settings: { executionOrder: "v1", callerPolicy: "workflowsFromSameOwner", availableInMCP: false }
})
export class HydrationReminderWorkflow {

    // =====================================================================
// CONFIGURATION DES NOEUDS
// =====================================================================

    @node({
        id: "c3000001-0000-0000-0000-000000000001",
        name: "Schedule Trigger",
        type: "n8n-nodes-base.scheduleTrigger",
        version: 1,
        position: [0, 0]
    })
    ScheduleTrigger = {
        rule: {
            interval: [
                {
                    field: "cronExpression",
                    expression: "0 1-15/2 * * 1-5"
                }
            ]
        }
    };

    @node({
        id: "c3000002-0000-0000-0000-000000000002",
        name: "Notify Hydration",
        type: "n8n-nodes-base.httpRequest",
        version: 4,
        position: [240, 0]
    })
    NotifyHydration = {
        method: "POST",
        url: "http://host.docker.internal:3001/webhook",
        sendHeaders: true,
        headerParameters: {
            parameters: [
                {
                    name: "Authorization",
                    value: "=Bearer ae9a28762250d7b72812114db22f52a3"
                },
                {
                    name: "Content-Type",
                    value: "application/json"
                }
            ]
        },
        sendBody: true,
        specifyBody: "json",
        jsonBody: `{
  "event": "health.hydration.reminder",
  "via": "priestess",
  "message": "Hydration reminder — it's been 2 hours, remind FuuFu to drink a glass of water. Keep it short and warm, one sentence."
}`,
        options: {
            timeout: 8000
        }
    };


    // =====================================================================
// ROUTAGE ET CONNEXIONS
// =====================================================================

    @links()
    defineRouting() {
        this.ScheduleTrigger.out(0).to(this.NotifyHydration.in(0));
    }
}