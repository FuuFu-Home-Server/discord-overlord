import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Add Calendar Reminder
// Nodes   : 5  |  Connections: 4
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// WebhookTrigger                     webhook                    
// PrepareEvent                       code                       
// CreateCalendarEvent                googleCalendar             [onError→out(1)] [creds]
// NotifySuccess                      httpRequest                
// NotifyFailure                      httpRequest                
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// WebhookTrigger
//    → PrepareEvent
//      → CreateCalendarEvent
//        → NotifySuccess
//        → NotifyFailure
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: "ojZSGJkFKelZDAvk",
    name: "Add Calendar Reminder",
    active: true,
    settings: { executionOrder: "v1", callerPolicy: "workflowsFromSameOwner", availableInMCP: false }
})
export class AddCalendarReminderWorkflow {

    // =====================================================================
// CONFIGURATION DES NOEUDS
// =====================================================================

    @node({
        id: "b1a2c3d4-e5f6-7890-abcd-ef1234567890",
        webhookId: "c2b3d4e5-f6a7-8901-bcde-f12345678901",
        name: "Webhook Trigger",
        type: "n8n-nodes-base.webhook",
        version: 1,
        position: [0, 0]
    })
    WebhookTrigger = {
        httpMethod: "POST",
        path: "add-calendar-reminder",
        authentication: "none",
        options: {
            responseData: "json"
        }
    };

    @node({
        id: "d4e5f6a7-b8c9-0123-def0-123456789012",
        name: "Prepare Event",
        type: "n8n-nodes-base.code",
        version: 2,
        position: [240, 0]
    })
    PrepareEvent = {
        jsCode: `const body = $input.first().json.body ?? $input.first().json;

const title = body.title ?? 'Reminder';
const rawDatetime = body.datetime;
const description = body.description ?? '';
const durationMinutes = typeof body.duration_minutes === 'number' ? body.duration_minutes : 30;

if (!rawDatetime) {
  throw new Error('Missing required field: datetime (ISO 8601 string)');
}

const start = new Date(rawDatetime);
if (isNaN(start.getTime())) {
  throw new Error(\`Invalid datetime value: \${rawDatetime}\`);
}

const end = new Date(start.getTime() + durationMinutes * 60 * 1000);

return [{
  json: {
    title,
    description,
    start: start.toISOString(),
    end: end.toISOString(),
  }
}];`
    };

    @node({
        id: "f6a7b8c9-d0e1-2345-f012-345678901234",
        name: "Create Calendar Event",
        type: "n8n-nodes-base.googleCalendar",
        version: 1,
        position: [480, 0],
        credentials: {googleCalendarOAuth2Api:{id:"sjkY1KJUq4GeoDH6",name:"Google Calendar account"}},
        onError: "continueErrorOutput"
    })
    CreateCalendarEvent = {
        calendar: {
            __rl: true,
            value: "primary",
            mode: "list",
            cachedResultName: "Primary"
        },
        start: "={{ $json.start }}",
        end: "={{ $json.end }}",
        additionalFields: {
            description: "={{ $json.description }}"
        }
    };

    @node({
        id: "a1b2c3d4-e5f6-7890-abcd-111111111111",
        name: "Notify Success",
        type: "n8n-nodes-base.httpRequest",
        version: 4,
        position: [720, -80]
    })
    NotifySuccess = {
        method: "POST",
        url: "http://discord-overlord:3001/webhook",
        sendHeaders: true,
        headerParameters: {
            parameters: [
                {
                    name: "Authorization",
                    value: "=Bearer {{ $env.N8N_WEBHOOK_SECRET }}"
                },
                {
                    name: "Content-Type",
                    value: "application/json"
                }
            ]
        },
        sendBody: true,
        specifyBody: "json",
        jsonBody: `={
  "event": "calendar.reminder.created",
  "via": "priestess",
  "message": "Calendar event '{{ $('Prepare Event').item.json.title }}' was successfully created. It starts at {{ $('Prepare Event').item.json.start }} and ends at {{ $('Prepare Event').item.json.end }}. Google Calendar link: {{ $json.htmlLink }}"
}`,
        options: {
            timeout: 8000
        }
    };

    @node({
        id: "b2c3d4e5-f6a7-8901-bcde-222222222222",
        name: "Notify Failure",
        type: "n8n-nodes-base.httpRequest",
        version: 4,
        position: [720, 80]
    })
    NotifyFailure = {
        method: "POST",
        url: "http://discord-overlord:3001/webhook",
        sendHeaders: true,
        headerParameters: {
            parameters: [
                {
                    name: "Authorization",
                    value: "=Bearer {{ $env.N8N_WEBHOOK_SECRET }}"
                },
                {
                    name: "Content-Type",
                    value: "application/json"
                }
            ]
        },
        sendBody: true,
        specifyBody: "json",
        jsonBody: `={
  "event": "calendar.reminder.failed",
  "via": "priestess",
  "message": "Failed to create calendar event '{{ $('Prepare Event').item.json.title }}' scheduled for {{ $('Prepare Event').item.json.start }}. Error: {{ $json.error.message ?? $json.message ?? 'Unknown error' }}"
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
        this.WebhookTrigger.out(0).to(this.PrepareEvent.in(0));
        this.PrepareEvent.out(0).to(this.CreateCalendarEvent.in(0));
        this.CreateCalendarEvent.out(0).to(this.NotifySuccess.in(0));
        this.CreateCalendarEvent.error().to(this.NotifyFailure.in(0));
    }
}