const events = (n: number) => (n === 1 ? "1 event" : `${n} events`);

export const plotLineDeleteText = (eventCount: number) =>
  eventCount === 0
    ? "This plot line has no events. This can't be undone."
    : `This also deletes its ${events(eventCount)}. This can't be undone.`;

export const plotLineDeleteLabel = (eventCount: number) =>
  eventCount === 0
    ? "Delete plot line"
    : `Delete plot line and ${events(eventCount)}`;

export const chapterDeleteText = (plannedEvents: number) =>
  "Are you sure you want to delete this chapter? This action cannot be undone." +
  (plannedEvents === 0
    ? ""
    : plannedEvents === 1
      ? " Its 1 planned event will move to Unassigned."
      : ` Its ${plannedEvents} planned events will move to Unassigned.`);
