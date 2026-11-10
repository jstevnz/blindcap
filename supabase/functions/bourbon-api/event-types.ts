export const EVENT_TYPES = [{id:'bourbon-tasting',label:'Bourbon Tasting'}] as const;
export type EventType = typeof EVENT_TYPES[number]['id'];
export function requireEventType(value:unknown = 'bourbon-tasting'):EventType {
 if(value!=='bourbon-tasting')throw new Error('Choose an available event type. Bourbon Tasting is currently the only option.');
 return value;
}
export function eventTypeFor(event:{eventType?:unknown}):EventType{return requireEventType(event.eventType);}
