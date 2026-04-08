---
type: obsidian-note
topic: fedex-erp-field-map
updated: 2026-04-08
---

# FedEx -> ERP Field Map

This note shows how FedEx shipment data flows into the ERP, what each field means, and which source should win when values disagree.

## Data Source Priority

1. FedEx Track API is the source of truth for live shipment status, scan history, and the canonical shipment snapshot now that production API access is live.
2. ERP shipment rows cache that API snapshot for fast reads in the UI.
3. Shipment label / Ship Manager import rows are legacy fallback evidence only, used when API data is temporarily unavailable or a shipment has not yet been refreshed.

## Live Tracking Snapshot -> ERP

| FedEx field | Meaning | ERP use |
| --- | --- | --- |
| `trackingNumber` | The FedEx tracking ID | Stored on `Shipment.trackingNumber`, `TrackingEvent`, and `FedExShipmentRecord` |
| `latestStatus` | Current status text, like Delivered or In transit | Drives shipment badges, detail panels, and ERP status mapping |
| `latestStatusCode` | FedEx status shorthand, like `DL`, `IT`, `HL` | Used for event/status derivation and debug display |
| `latestDescription` | Human-readable status detail | Displayed in shipment detail UI and raw API previews |
| `latestEventTimestamp` | Most recent scan time returned by FedEx | Used for latest status time and event ordering |
| `latestLocation` | Last scan location | Mapped into ERP tracking events and location labels |
| `serviceDescription` | FedEx service, like Ground or 2Day | Stored on FedEx import rows and shown in the FedEx shipments browser |
| `recipient` | Recipient city/state/country from FedEx | Helpful for verification, but not the primary destination source |
| `events` | Full FedEx scan history | One row per scan event in `TrackingEvent` and detail views |
| `fetchedAt` | When the API call was made | Freshness metadata for the live snapshot |
| `sourceBaseUrl` | Sandbox or production endpoint used | Labels the origin of the live response |
| `rawResponse` | Full carrier JSON payload | Stored in raw payload fields for troubleshooting and repair |

## ERP Models

### `Shipment`

Fast order-level shipping cache used by the order details page and shipment panels.

| Field | Meaning |
| --- | --- |
| `workOrderId` | Links the shipment back to the order |
| `carrier` | Carrier type, e.g. `FEDEX` |
| `trackingNumber` | Primary tracking ID used for live lookups |
| `shipDate` | When the order was shipped |
| `estimatedDelivery` | Expected delivery date when known |
| `actualDelivery` | Confirmed delivered date when known |
| `status` | ERP shipment status, e.g. `PENDING`, `IN_TRANSIT`, `DELIVERED` |
| `weight` / `dimensions` | Physical shipment details |
| `signedBy` | Delivery signature recipient |
| `proofOfDelivery` | Signature or photo evidence |
| `notes` | Manual shipping notes |
| `trackingEvents` | Carrier scan history cached in the ERP |
| `labelScans` | Shop-floor shipping label scans |

### `TrackingEvent`

Individual scan event rows cached in the ERP.

| Field | Meaning |
| --- | --- |
| `eventType` | Scan category, like `DELIVERED`, `IN_TRANSIT`, or `EXCEPTION` |
| `eventDate` / `eventTime` | Event timestamp split for storage |
| `city` / `state` / `zip` / `country` | Scan location fields |
| `description` | Human-readable scan description |
| `signedBy` | Who signed for delivery when available |
| `exceptionCode` / `exceptionReason` | Carrier exception details |
| `sourceSystem` | Source of the event, such as `carrier_api` |
| `rawData` | Raw carrier response for the event |

### `FedExShipmentRecord`

Import row used by the FedEx shipments browser and reconciliation tools.

| Field | Meaning |
| --- | --- |
| `sourceFileName` | The FedEx log or export file name |
| `sourceFilePath` | Where the import row came from |
| `sourceFileDate` | File timestamp used for sorting and grouping |
| `eventTimestamp` | Timestamp from the source row |
| `trackingNumber` | Tracking number extracted from the source row |
| `service` | FedEx service label after normalization |
| `recipientCompanyName` / `recipientContactName` | Recipient information from the label or log |
| `destinationAddressLine1` / `destinationCity` / `destinationState` / `destinationPostalCode` / `destinationCountry` | Destination fields from the label or log |
| `workOrderId` | ERP work order linked to the FedEx record |
| `sourceKey` | Unique key for deduping and backfill |
| `rawPayload` | Raw text payload for troubleshooting |
| `rawData` | Parsed JSON copy of the source row |
| `importedAt` / `updatedAt` | When ERP imported or last touched the row |

## Field Meaning On The UI

| UI value | What it should mean |
| --- | --- |
| `recordCount` | Number of stored FedEx rows grouped under the same tracking number |
| `linkedWorkOrderCount` | Number of ERP orders tied to that tracking number |
| `eventCount` | Number of FedEx scan events in the live tracking snapshot |
| `latestStatus` | Current carrier status, not the destination address |
| `latestLocation` | Last scan location, not the recipient destination |
| `recipient` | FedEx recipient record, helpful for verification only |

## Trust Rules

- If tracking number exists, use it first.
- If the FedEx Track API has live status, use it for the current shipment state and preferred location/status fields.
- If API data and legacy import rows disagree, prefer the API snapshot for the shipment summary and detail panels.
- Keep label / Ship Manager import rows as reconciliation evidence, not the visible truth, unless no API data exists yet.
- If the shipments browser shows sandbox data, label it clearly as sandbox so it is not mistaken for live shipment truth.
- If a service code is numeric or shorthand, normalize it before display.

## Notes

- `eventCount` is just `events.length`.
- It does not mean number of orders.
- It does not mean number of packages.
- It only means how many scan events FedEx returned for that tracking number.
