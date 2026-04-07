---
type: obsidian-note
topic: order-detail-audit
orderNumber: 64524
customerName: Pribusin PO23402
status: SHIPPED
source: archive.xlsx row 623
updated: 2026-04-07
---

# 64524 - Pribusin PO23402

This note is a living map of the Order Details page: what the UI asks for, where it comes from, and what the current `64524` record actually has.

## UI And Data Piping

| Page area | Component | Query / route | Main variables | 64524 status |
| --- | --- | --- | --- | --- |
| Header, buttons, title | `OrderDetailPage` | `GET /orders/:id` | `orderNumber`, `customerName`, `status`, `priority`, `companyBrand`, edit / duplicate / print / complete actions | `#64524`, `Pribusin PO23402`, `SHIPPED`, `Medium` |
| Details card | `OrderDetailPage` | `GET /orders/:id` | `description`, `notes` | `Decals (140)(MM/ZUND)` plus archive backfill notes |
| Order info card | `OrderDetailPage` | `GET /orders/:id` | `dueDate`, `createdAt`, `createdBy`, `priority` | Due `Apr 6, 2026`, created `Mar 27, 2026`, created by `System Admin` |
| Linked data card | `OrderLinkedDataCard` | `GET /orders/:id/linked-data` | `shipmentCount`, `attachmentCount`, `reprintRequestCount`, `timeEntryCount`, `proofApprovalCount`, `completedStationCount`, `routingCount`, `latestShipments`, `latestAttachments`, `fileChainSummary`, `latestFileChainLinks` | 1 shipment, 3 file-chain rows, 0 linked file chains, chain `READY_TO_PRINT` |
| Activity timeline | `HorizontalActivityTimeline` | `GET /equipment/workorder/:orderNumber/activity` plus `order.events` from `GET /orders/:id` | order events, Thrive print queue activity, Zund completion, ERP shipping / file events | 3 order events, no ERP print/cut completion yet |
| Print jobs card | `PrinterInfoCard` | `GET /equipment/thrive/workorder/:orderNumber` and unlinked print jobs | `matchingPrintJobs`, `unlinkedData`, link / dismiss actions | Thrive print-history evidence exists, but ERP print-job links are still incomplete |
| Cut files card | `ZundInfoCard` | `GET /equipment/thrive/workorder/:orderNumber` and unlinked cut jobs | `matchingCutJobs`, `unlinkedData`, link / dismiss actions | File-chain rows exist, but they are still `READY_TO_PRINT` and not cut-complete |
| Routing card | `RoutingRecommendationCard` | `POST /routing/preview` | `currentRoute`, `description`, `priority`, `dueDate`, `notes` | 15-step route, only 1 station complete in ERP |
| Shipping card | `ShippingPanel` | `GET /shipments/order/:workOrderId` | `shipments`, create / update / label actions | 1 shipment placeholder, carrier `OTHER`, tracking missing |
| Station progress | inline order data | `GET /orders/:id` | `stationProgress`, `SUB_STATION_PARENTS`, `PARENT_SUB_STATIONS` | 12 station rows; only `ORDER_ENTRY` is complete |
| File chain timeline | `FileChainTimeline` | `GET /file-chain/orders/:orderId` | `printFileName`, `cutFileName`, `cutId`, `printStartedAt`, `printCompletedAt`, `cutStartedAt`, `cutCompletedAt`, confirm / dismiss actions | 3 linked rows, same cut ID, all still `READY_TO_PRINT` |
| Network files | `NetworkFileBrowser` | `GET /file-browser/orders/:orderId/files`, `GET /file-browser/orders/:orderId/folder-path`, `GET /file-browser/categories` | folder path, files, categories, upload / create-folder / link-folder actions | No manual `networkFolderPath` override on the order |

## 64524 Snapshot

| Field | Value |
| --- | --- |
| Order | `64524` |
| Customer | `Pribusin PO23402` |
| Description | `Decals (140)(MM/ZUND)` |
| Status | `SHIPPED` |
| Priority | `Medium` |
| Due date | `Apr 6, 2026` |
| Created | `Mar 27, 2026 8:48 PM` |
| Updated | `Apr 7, 2026 11:38 AM` |
| Routing steps | `15` |
| Station progress rows | `12` |
| Completed stations | `1/15` |
| Shipments | `1` |
| File-chain rows | `3` |
| File-chain linked rows | `0` |
| Print complete count | `0` |
| Cut complete count | `0` |
| Attachments | `0` |
| Time entries | `0` |
| Reprint requests | `0` |
| Proof approvals | `0` |
| Print jobs in ERP | `0` |
| Rip jobs in ERP | `0` |

## Event Trail

1. `CREATED` - Imported from Production List `(DESIGN_PRODUCTION, Row 93)`
2. `NOTE_ADDED` - Synced from Production List: `status -> IN_PROGRESS`
3. `STATUS_CHANGED` - Archive backfill set order to `SHIPPED` from `archive.xlsx`

## File Chain Detail

All three file-chain rows share the same Cut ID, which is the bridge between the print file and the Zund cut file:

- `RCI-CEL_Label_Rev_B_Cellular_Telemetry_System_2UP_PRINTANDCUT`
- `3.375x4.875_LDA-1C_Front_Decal_PRINTANDCUT`
- `2.2x2_LDA-1C_Inside_Decal_PRINTANDCUT`

Current ERP state:

- `status = READY_TO_PRINT`
- `printStartedAt = null`
- `printCompletedAt = null`
- `cutStartedAt = null`
- `cutCompletedAt = null`
- `confirmed = false`

## Thrive Print Evidence

The real print-history evidence for this batch is in Thrive JobLog, not the RIP queue:

- `Cut ID`: `1YKWVQ82641`
- `printedTime`: `04/01/2026 13:52`
- `printTime`: `00:00:59`
- `printer`: `HP Latex 800 W`
- `media`: `GF 201 Scratch Resist Laminate [Self-Adhesive Vinyl]`
- `sourceFilePath`: `S:\PRIBUSIN\2026\WO64524_PO23402_RCI-CEL_LDA-1C PRIBUSIN FRONT_ LDA-1C PRIBUSIN INSIDE\PRINT\2.2x2_LDA-1C Inside Decal_PRINTANDCUT.pdf`

That makes this a good validation order for print-time mapping, but the ERP still needs the file-chain / print-completion linkage to surface it automatically in the page.

## What Looks Wrong Or Still Needs Wiring

- The order is shipped, but `stationProgress` still only marks `ORDER_ENTRY` complete.
- The shipment exists, but tracking is still blank.
- The file-chain rows are present, but they are still `READY_TO_PRINT` instead of carrying the print completion time from Thrive.
- No attachments, time entries, proofs, or reprints are linked yet.
- No direct ERP `printJobs` or `ripJobs` are attached to the order yet.

## Order Detail Page Checklist

- `OrderDetailPage` header and detail cards are wired.
- `Linked Data` is wired.
- `Activity Timeline` is wired.
- `Printer` and `Zund` cards are wired, but this order still shows the missing linkage gap.
- `Routing` is wired.
- `Shipping` is wired, but tracking needs cleanup.
- `File Chain` is wired, but the completion state is not yet derived from the print history.
- `Network Files` is wired.

## Reminder

We still need a quick tracking cleanup so every order has the correct designation, and the Design page on the shop-floor app still needs to be finished. Printing and Production are already the stronger pieces. Shipping and Design are the next two to lock down before pre-alpha testing.
