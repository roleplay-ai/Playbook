## Plan

1. **Make AI Application Opportunities open the activity-mapping page directly**
   - Ensure every “Find My AI Opportunities” / “AI Application Opportunities” entry link routes to `/activities`, not `/results`.
   - Keep `/results` only for viewing already-generated results after submission.

2. **Remove the blank “No activities yet” dead-end behavior for this flow**
   - If a user reaches `/results` with no activities, redirect them to `/activities` instead of showing the empty-state page asking them to add an activity.
   - This will show the full table immediately with activity rows, categories, AI capability columns, weekly hours, and AI-doable choices.

3. **Enable submit as soon as one activity is entered**
   - Keep the activity rows pre-created.
   - Treat a row as ready once the activity name is entered, using the existing default weekly hours and default AI classification.
   - Update any remaining validation/error copy so it does not incorrectly require chips or manual Yes/Partly/No selection.

## Files to update

- `src/routes/results.tsx`
- `src/routes/activities.tsx`
- If needed after checking all entry points: `src/routes/hub.tsx` / navigation links