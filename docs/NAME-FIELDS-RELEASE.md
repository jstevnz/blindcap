# Separate profile name fields

Profile and signup replace Full name with First name and Last name. Separate private columns preserve compound first names and multiword surnames. The existing full_name stays available for mailing labels, pending signup review and notifications, and is updated from the two submitted fields. Searchable display names are unchanged; first and last names are not exposed in searches.

The additive migration adds nullable first_name and last_name columns, without overwriting existing names or events. Existing full_name values are shown in the new fields using the first word/rest as an initial editable split; the joined name remains unchanged. Legacy requests using fullName remain accepted.

Validation: full test suite, name normalization/compound-name checks, legacy compatibility, privacy, migration rehearsal and production build. No membership, event-admin or mailing permissions change. Deploy additive columns, updated authenticated backend and exact tested GitHub commit to Blindcap production.
