import { EVENT_TYPES } from "@/lib/event-types";
export default function EventTypePicker() {
  return (
    <label>
      Event type
      <select name="eventType" defaultValue="bourbon-tasting" required>
        {EVENT_TYPES.map((type) => (
          <option key={type.id} value={type.id}>
            {type.label}
          </option>
        ))}
      </select>
    </label>
  );
}
