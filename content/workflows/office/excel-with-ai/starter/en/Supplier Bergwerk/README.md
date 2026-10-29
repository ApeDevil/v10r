# Supplier Bergwerk: product sheet for the shop import

Read this file first and follow it.

## Goal
Turn Bergwerk's monthly product export into the sheet our shop imports.

## Sources (input/)
- `bergwerk-products.xlsx`, sheet `Export`, headers in row 1, one row per product.
  `Artikelnr` is the supplier's unique product number.

### Columns
| Column | Meaning | Notes |
|---|---|---|
| Artikelnr | Supplier article number | Unique; becomes our `sku` |
| EAN | Barcode (GTIN-13) | Excel sometimes shows it as 4.01235E+12 |
| Bezeichnung | Product name, German | Can be longer than 80 characters |
| Farbe | Colour, German, free text | "schwarz", "Schwarz", "sw" all mean black |
| Gewicht | Weight | Mixed: "1,2 kg", "850g", "1200" (no unit) |
| Maße cm (BxHxT) | Width x height x depth in cm | One text value, e.g. "30 x 45 x 15" |
| Hersteller | Brand | Sometimes empty |
| Kategorie | Product category, German | Not imported |

## Target (output/<date>/shop-import.xlsx, sheet `products`)
| Column | Format | Required |
|---|---|---|
| sku | Text, from Artikelnr | yes |
| gtin | 13 digits, valid check digit, stored as text | yes |
| title | Text, at most 80 characters | yes |
| color | One of: Black, Red, Blue, White | no |
| weight_kg | Number in kg, decimal point | yes |
| width_cm, height_cm, depth_cm | Numbers | no |
| brand | Text, from Hersteller | yes |

## Result (output/<date>/)
- `shop-import.xlsx` with three sheets: `products` (the target above), `issues` (every value
  that could not be converted, with its source row and the reason) and `changes` (every cell
  that was changed, before and after).

## Rules
- Never change the files in input/.
- Do counting and converting with a Python script in tools/, not by reading the rows.
- Never guess. A value you cannot convert stays as it is and goes on the issues sheet.
- Store every cell as text, so barcodes keep their leading zeros.
- Ask me before you drop a column or a row.

## Done when
- Every product row from the source is in products or issues (same count).
- Every value in products matches the target format.

## Decisions
- (none yet)
