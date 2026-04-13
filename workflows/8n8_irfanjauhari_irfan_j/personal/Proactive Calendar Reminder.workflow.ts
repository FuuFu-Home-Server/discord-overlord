import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Proactive Calendar Reminder
// Nodes   : 4  |  Connections: 3
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// ScheduleTrigger                    scheduleTrigger            
// GetUpcomingEvents                  googleCalendar             [creds]
// FilterAndDedup                     code                       
// NotifyEvent                        httpRequest                
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// ScheduleTrigger
//    → GetUpcomingEvents
//      → FilterAndDedup
//        → NotifyEvent
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: "Xo6DHI1tD7DH7hNd",
    name: "Proactive Calendar Reminder",
    active: true,
    settings: { executionOrder: "v1", callerPolicy: "workflowsFromSameOwner", availableInMCP: false }
})
export class ProactiveCalendarReminderWorkflow {

    // =====================================================================
// CONFIGURATION DES NOEUDS
// =====================================================================

    @node({
        id: "a1000001-0000-0000-0000-000000000001",
        name: "Schedule Trigger",
        type: "n8n-nodes-base.scheduleTrigger",
        version: 1,
        position: [0, 0]
    })
    ScheduleTrigger = {
        rule: {
            interval: [
                {
                    field: "minutes",
                    minutesInterval: 5
                }
            ]
        }
    };

    @node({
        id: "a1000002-0000-0000-0000-000000000002",
        name: "Get Upcoming Events",
        type: "n8n-nodes-base.googleCalendar",
        version: 1,
        position: [240, 0],
        credentials: {googleCalendarOAuth2Api:{id:"sjkY1KJUq4GeoDH6",name:"Google Calendar account"}}
    })
    GetUpcomingEvents = {
        operation: "getAll",
        calendar: {
            __rl: true,
            value: "primary",
            mode: "list",
            cachedResultName: "Primary"
        },
        returnAll: false,
        limit: 20,
        options: {
            timeMin: "={{ new Date().toISOString() }}",
            timeMax: "={{ new Date(Date.now() + 15 * 60 * 1000).toISOString() }}",
            singleEvents: true,
            orderBy: "startTime"
        }
    };

    @node({
        id: "a1000003-0000-0000-0000-000000000003",
        name: "Filter And Dedup",
        type: "n8n-nodes-base.code",
        version: 2,
        position: [480, 0]
    })
    FilterAndDedup = {
        jsCode: `const staticData = $getWorkflowStaticData('global');
const notified = staticData.notifiedIds ?? {};
const now = Date.now();

// Clean up entries older than 2 hours
for (const id of Object.keys(notified)) {
  if (notified[id] < now - 7200000) delete notified[id];
}

const items = $input.all();
const toNotify = items.filter(item => {
  const id = item.json.id;
  return !(!id || notified[id]);
});

for (const item of toNotify) {
  notified[item.json.id] = now;
}
staticData.notifiedIds = notified;

if (toNotify.length === 0) return [];

return toNotify.map(item => {
  const startMs = new Date(item.json.start?.dateTime ?? item.json.start?.date).getTime();
  const minutesUntil = Math.round((startMs - now) / 60000);
  const title = item.json.summary ?? 'Event';
  const loc = item.json.location ? \` at \${item.json.location}\` : '';
  const link = item.json.htmlLink ? \` Google Calendar link: \${item.json.htmlLink}\` : '';
  const timing = minutesUntil <= 0 ? 'is happening now' : \`starts in \${minutesUntil} minute\${minutesUntil !== 1 ? 's' : ''}\`;
  return {
    json: {
      event: 'calendar.reminder.upcoming',
      via: 'priestess',
      message: \`"\${title}" \${timing}\${loc}.\${link}\`
    }
  };
});`
    };

    @node({
        id: "a1000004-0000-0000-0000-000000000004",
        name: "Notify Event",
        type: "n8n-nodes-base.httpRequest",
        version: 4,
        position: [720, 0]
    })
    NotifyEvent = {
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
                {
                    name: "event",
                    value: "={{ $json.event }}"
                },
                {
                    name: "via",
                    value: "={{ $json.via }}"
                },
                {
                    name: "message",
                    value: "={{ $json.message }}"
                }
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
        this.ScheduleTrigger.out(0).to(this.GetUpcomingEvents.in(0));
        this.GetUpcomingEvents.out(0).to(this.FilterAndDedup.in(0));
        this.FilterAndDedup.out(0).to(this.NotifyEvent.in(0));
    }
}