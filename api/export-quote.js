// api/export-quote.js — Vercel Serverless Function
// Generates BYN-format Excel quote using ExcelJS

import ExcelJS from 'exceljs'
import { LOGO_BASE64 } from './logo.js'

const NAVY = 'FF0D1F31'
const WHITE = 'FFFFFFFF'
const GOLD  = 'FFC9A84C'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { quote, items } = req.body

  if (!quote || !items) {
    return res.status(400).json({ error: 'Missing quote or items' })
  }

  try {
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('QUOTE')

    // ── Column widths ───────────────────────────────────────────────
    ws.columns = [
      { key: 'A', width: 48 },
      { key: 'B', width: 20 },
      { key: 'C', width: 14 },
      { key: 'D', width: 14 },
      { key: 'E', width: 16 },
      { key: 'F', width: 20 },
      { key: 'G', width: 14 },
    ]

    // ── Row heights ─────────────────────────────────────────────────
    ws.getRow(1).height  = 80
    ws.getRow(16).height = 8
    ws.getRow(18).height = 20

    // ── Logo (floating, exact anchor from template) ─────────────────
    const logoBuffer = Buffer.from(LOGO_BASE64, 'base64')
    const imageId = wb.addImage({ buffer: logoBuffer, extension: 'png' })
    ws.addImage(imageId, {
      tl: { nativeCol: 0, nativeColOff: 711200, nativeRow: 0, nativeRowOff: 736600 },
      ext: { width: 212, height: 210 },
      editAs: 'oneCell',
    })

    // ── Helper styles ───────────────────────────────────────────────
    const navyFont  = (size=9, bold=false) => ({ name: 'Arial', size, bold, color: { argb: NAVY } })
    const grayFont  = (size=9) => ({ name: 'Arial', size, color: { argb: 'FF555555' } })
    const whiteFont = (size=9, bold=false) => ({ name: 'Arial', size, bold, color: { argb: WHITE } })
    const goldFont  = (size=9, bold=false) => ({ name: 'Arial', size, bold, color: { argb: GOLD } })

    const cell = (coord, value, font, alignment) => {
      const c = ws.getCell(coord)
      c.value = value
      if (font) c.font = font
      if (alignment) c.alignment = alignment
      return c
    }

    // ── PAY TO ───────────────────────────────────────────────────────
    cell('E1', 'PAY TO:', navyFont(9, true))
    cell('E2', 'JPMORGAN CHASE BANK, N.A. – NEW YORK', grayFont())
    cell('E3', 'SWIFT CHASUS33', grayFont())
    cell('E4', 'ABA 021000021', grayFont())
    cell('E6', 'BENEFICIARY BANK', navyFont(9, true))
    cell('E7', 'BANCO GENERAL, S.A. – PANAMA', grayFont())
    cell('E8', 'SWIFT BAGEPAPA', grayFont())
    cell('E9', 'Blue Yacht Nautica SA', grayFont())
    cell('E10', '03-29-00-000050-5', grayFont())

    // ── BILLED TO ────────────────────────────────────────────────────
    cell('C1', 'BILLED TO:', navyFont(9, true))
    cell('C2', quote.client, navyFont(11, true))

    // ── Quote number ─────────────────────────────────────────────────
    const docLabel = quote.is_invoice ? 'INVOICE' : 'QUOTE'
    cell('C12', `${docLabel} ${quote.quote_number}`, navyFont(14, true))

    // ── CLIENT / DATE / MARINA ───────────────────────────────────────
    cell('A14', 'CLIENT',        { name: 'Arial', size: 8, color: { argb: 'FF888888' } })
    cell('C14', 'DELIVERY DATE', { name: 'Arial', size: 8, color: { argb: 'FF888888' } })
    cell('E14', 'MARINA',        { name: 'Arial', size: 8, color: { argb: 'FF888888' } })
    cell('A15', quote.client,    navyFont(10, true))
    cell('C15', quote.date,      navyFont(10))
    cell('E15', quote.marina || '', navyFont(10))

    // ── Navy divider row 16 ──────────────────────────────────────────
    for (let col = 1; col <= 7; col++) {
      ws.getRow(16).getCell(col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }
    }

    // ── Column headers row 18 ────────────────────────────────────────
    const headers = ['DESCRIPTION','FORMAT','QUANTITY','UNIT PRICE','TOTAL','PROVEEDOR','STATUS']
    const hAligns = ['left','left','center','right','right','left','center']
    headers.forEach((hdr, i) => {
      const c = ws.getRow(18).getCell(i + 1)
      c.value = hdr
      c.font  = navyFont(9, true)
      c.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EDF2' } }
      c.alignment = { horizontal: hAligns[i], vertical: 'middle' }
      c.border = { bottom: { style: 'medium', color: { argb: NAVY } } }
    })

    // ── Item rows ────────────────────────────────────────────────────
    const ROW_START = 19
    const hairBorder = { bottom: { style: 'hair', color: { argb: 'FFDDDDDD' } } }

    items.forEach((item, idx) => {
      const r = ROW_START + idx
      ws.getRow(r).height = 18
      const fgColor = { argb: idx % 2 === 0 ? 'FFF7F9FC' : WHITE }
      const fill = { type: 'pattern', pattern: 'solid', fgColor }

      const setCell = (col, value, font, align, numFmt) => {
        const c = ws.getRow(r).getCell(col)
        c.value = value
        c.font  = font
        c.alignment = { horizontal: align, vertical: 'middle', wrapText: col === 1 }
        c.fill  = fill
        c.border = hairBorder
        if (numFmt) c.numFmt = numFmt
      }

      setCell(1, item.product_name,        navyFont(9),              'left')
      setCell(2, item.format || '',         { name:'Arial', size:9, color:{argb:'FF666666'} }, 'left')
      setCell(3, parseFloat(item.qty),      { name:'Arial', size:9, color:{argb:'FF222222'} }, 'center', '#,##0.##')
      setCell(4, parseFloat(item.unit_price),{ name:'Arial', size:9, color:{argb:'FF222222'} }, 'right',  '"$"#,##0.00')
      setCell(5, { formula: `C${r}*D${r}` }, navyFont(9, true),      'right',  '"$"#,##0.00')
      setCell(6, item.supplier || '',       { name:'Arial', size:9, color:{argb:'FF888888'} }, 'left')
      setCell(7, '',                        { name:'Arial', size:9 }, 'center')
    })

    // ── Totals ────────────────────────────────────────────────────────
    const lastRow  = ROW_START + items.length - 1
    const sepRow   = lastRow + 1
    const subRow   = lastRow + 2

    ws.getRow(sepRow).height = 6
    for (let col = 1; col <= 7; col++) {
      ws.getRow(sepRow).getCell(col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }
    }

    const subtotalCell = ws.getRow(subRow).getCell(4)
    subtotalCell.value = 'SUBTOTAL'
    subtotalCell.font  = navyFont(9, true)
    subtotalCell.alignment = { horizontal: 'right' }

    const subtotalVal = ws.getRow(subRow).getCell(5)
    subtotalVal.value  = { formula: `SUM(E${ROW_START}:E${lastRow})` }
    subtotalVal.font   = navyFont(9, true)
    subtotalVal.numFmt = '"$"#,##0.00'
    subtotalVal.alignment = { horizontal: 'right' }

    const discount = parseFloat(quote.discount_pct || 0)
    const transFee = parseFloat(quote.transportation_fee || 0)
    let nextRow = subRow + 1

    if (discount > 0) {
      const dLabel = ws.getRow(nextRow).getCell(4)
      dLabel.value = `DISCOUNT (${discount.toFixed(1)}%)`
      dLabel.font  = { name: 'Arial', size: 9, color: { argb: 'FF888888' } }
      dLabel.alignment = { horizontal: 'right' }
      const dVal = ws.getRow(nextRow).getCell(5)
      dVal.value  = { formula: `-E${subRow}*${discount/100}` }
      dVal.font   = { name: 'Arial', size: 9, color: { argb: 'FF888888' } }
      dVal.numFmt = '"$"#,##0.00'
      dVal.alignment = { horizontal: 'right' }
      nextRow++
    }

    if (transFee > 0) {
      const tfLabel = ws.getRow(nextRow).getCell(4)
      tfLabel.value = 'Transportation Fee'
      tfLabel.font  = { name: 'Arial', size: 9, color: { argb: 'FF444444' } }
      tfLabel.alignment = { horizontal: 'right' }
      const tfVal = ws.getRow(nextRow).getCell(5)
      tfVal.value  = transFee
      tfVal.font   = { name: 'Arial', size: 9, color: { argb: 'FF444444' } }
      tfVal.numFmt = '"$"#,##0.00'
      tfVal.alignment = { horizontal: 'right' }
      nextRow++
    }

    let grandRow = nextRow

    ws.getRow(grandRow).height = 26
    for (let col = 1; col <= 7; col++) {
      ws.getRow(grandRow).getCell(col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }
    }

    const totalLabel = ws.getRow(grandRow).getCell(4)
    totalLabel.value = 'TOTAL'
    totalLabel.font  = whiteFont(11, true)
    totalLabel.alignment = { horizontal: 'right', vertical: 'middle' }
    totalLabel.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }

    const totalVal = ws.getRow(grandRow).getCell(5)
    // Sum subtotal + all adjustment rows (discount, transport fee, etc.)
    if (grandRow > subRow + 1) {
      totalVal.value = { formula: `SUM(E${subRow}:E${grandRow-1})` }
    } else {
      totalVal.value = { formula: `E${subRow}` }
    }
    totalVal.numFmt = '"$"#,##0.00'
    totalVal.font   = goldFont(13, true)
    totalVal.alignment = { horizontal: 'right', vertical: 'middle' }
    totalVal.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }

    // ── Notes ─────────────────────────────────────────────────────────
    let disclaimerRow = grandRow + 2
    if (quote.notes) {
      ws.getRow(disclaimerRow).getCell(1).value = 'Notes:'
      ws.getRow(disclaimerRow).getCell(1).font  = { name: 'Arial', size: 8, bold: true, color: { argb: 'FF888888' } }
      ws.getRow(disclaimerRow + 1).getCell(1).value = quote.notes
      ws.getRow(disclaimerRow + 1).getCell(1).font  = { name: 'Arial', size: 8, color: { argb: 'FF666666' } }
      disclaimerRow = disclaimerRow + 3
    }

    // ── Disclaimer ────────────────────────────────────────────────────
    ws.getRow(disclaimerRow).height = 6
    for (let col = 1; col <= 7; col++) {
      ws.getRow(disclaimerRow).getCell(col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }
    }

    ws.getRow(disclaimerRow + 1).height = 20
    const discCell = ws.getRow(disclaimerRow + 1).getCell(1)
    discCell.value = 'Disclosure: Prices are subject to variation, any variation will be previously notified.'
    discCell.font  = { name: 'Arial', size: 8, italic: true, color: { argb: 'FF888888' } }
    discCell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true }

    // ── Stream response ───────────────────────────────────────────────
    const prefix = quote.is_invoice ? 'INV' : 'COT'
    const filename = `BYN_${prefix}_${quote.quote_number}_${quote.client.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)

    await wb.xlsx.write(res)
    res.end()

  } catch (err) {
    console.error('Export error:', err)
    res.status(500).json({ error: err.message })
  }
}
