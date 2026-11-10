"use client";
export type MailingAddress = {
  line1?: string;
  line2?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  country?: string;
};
export default function MailingAddressFields({
  value,
  onChange,
}: {
  value: MailingAddress;
  onChange: (v: MailingAddress) => void;
}) {
  const fields = [
    ["line1", "Street address", "address-line1", 150],
    ["line2", "Apartment / suite", "address-line2", 150],
    ["city", "City", "address-level2", 100],
    ["region", "State / province", "address-level1", 100],
    ["postalCode", "ZIP / postal code", "postal-code", 30],
    ["country", "Country", "country-name", 100],
  ] as const;
  return (
    <fieldset>
      <legend>Mailing address (optional)</legend>
      <p className="fine">
        Event admins can request this address for physical mail after you
        confirm your place in their event. It is not shown in member searches or
        event results.
      </p>
      {fields.map(([key, label, autoComplete, maxLength]) => (
        <label key={key}>
          {label}
          <input
            autoComplete={autoComplete}
            maxLength={maxLength}
            value={value[key] ?? ""}
            onChange={(e) => onChange({ ...value, [key]: e.target.value })}
          />
        </label>
      ))}
    </fieldset>
  );
}
