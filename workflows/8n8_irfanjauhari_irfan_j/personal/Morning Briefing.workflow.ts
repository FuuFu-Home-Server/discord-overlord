import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Morning Briefing
// Nodes   : 4  |  Connections: 3
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// ScheduleTrigger                    scheduleTrigger            
// GetTodayEvents                     googleCalendar             [creds]
// FormatBriefing                     code                       
// NotifyBriefing                     httpRequest                
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// ScheduleTrigger
//    → GetTodayEvents
//      → FormatBriefing
//        → NotifyBriefing
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: "av4AdN1lDlXofoJj",
    name: "Morning Briefing",
    active: false,
    settings: { executionOrder: "v1", callerPolicy: "workflowsFromSameOwner", availableInMCP: false }
})
export class MorningBriefingWorkflow {

    // =====================================================================
// CONFIGURATION DES NOEUDS
// =====================================================================

    @node({
        id: "b2000001-0000-0000-0000-000000000001",
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
                    expression: "0 1 * * *"
                }
            ]
        }
    };

    @node({
        id: "b2000002-0000-0000-0000-000000000002",
        name: "Get Today Events",
        type: "n8n-nodes-base.googleCalendar",
        version: 1,
        position: [240, 0],
        credentials: {googleCalendarOAuth2Api:{id:"sjkY1KJUq4GeoDH6",name:"Google Calendar account"}}
    })
    GetTodayEvents = {
        operation: "getAll",
        calendar: {
            __rl: true,
            value: "primary",
            mode: "list",
            cachedResultName: "Primary"
        },
        returnAll: true,
        options: {
            timeMin: "={{ (() => { const d = new Date(); d.setUTCHours(d.getUTCHours() - (d.getUTCHours() + 7) % 24 - (d.getUTCHours() < 17 ? 24 : 0)); d.setUTCHours(17,0,0,0); const prev = new Date(d); prev.setUTCDate(prev.getUTCDate()-1); return prev.toISOString(); })() }}",
            timeMax: "={{ (() => { const d = new Date(); d.setUTCHours(17,0,0,0); if (d < new Date()) d.setUTCDate(d.getUTCDate()+1); return d.toISOString(); })() }}",
            singleEvents: true,
            orderBy: "startTime"
        }
    };

    @node({
        id: "b2000003-0000-0000-0000-000000000003",
        name: "Format Briefing",
        type: "n8n-nodes-base.code",
        version: 2,
        position: [480, 0]
    })
    FormatBriefing = {
        jsCode: `const items = $input.all();
const validEvents = items.filter(i => i.json.id);

if (validEvents.length === 0) {
  return [{
    json: {
      event: 'calendar.morning.briefing',
      via: 'priestess',
      message: 'No events on the calendar today.'
    }
  }];
}

const lines = validEvents.map(item => {
  const startRaw = item.json.start?.dateTime ?? item.json.start?.date;
  const start = item.json.start?.dateTime
    ? new Date(startRaw).toLocaleTimeString('en-GB', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' })
    : 'All day';
  const title = item.json.summary ?? 'Untitled';
  const loc = item.json.location ? \` @ \${item.json.location}\` : '';
  return \`- \${start}: \${title}\${loc}\`;
});

return [{
  json: {
    event: 'calendar.morning.briefing',
    via: 'priestess',
    message: \`Today's schedule (\${validEvents.length} event\${validEvents.length !== 1 ? 's' : ''}):\\n\${lines.join('\\n')}\`
  }
}];`
    };

    @node({
        id: "b2000004-0000-0000-0000-000000000004",
        name: "Notify Briefing",
        type: "n8n-nodes-base.httpRequest",
        version: 4,
        position: [720, 0]
    })
    NotifyBriefing = {
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
        specifyBody: "keypair",
        bodyParameters: {
            parameters: [
                { name: "event", value: "={{ $json.event }}" },
                { name: "via", value: "={{ $json.via }}" },
                { name: "message", value: "={{ $json.message }}" }
            ]
        },
        options: {
            timeout: 8000
        }
    };


    // =====================================================================
// ROUTAGE ET CONNEXIONS
// =====================================================================

    @links()
    defineRouting() {
        this.ScheduleTrigger.out(0).to(this.GetTodayEvents.in(0));
        this.GetTodayEvents.out(0).to(this.FormatBriefing.in(0));
        this.FormatBriefing.out(0).to(this.NotifyBriefing.in(0));
    }
}