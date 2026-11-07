/* eslint-env node */
import { Router } from 'express'
import { QueryTypes } from 'sequelize'
import { sequelize } from '../models/index.js'

const router = Router()
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char])

router.get('/', async (req, res, next) => {
  try {
    const [versionRows] = await sequelize.query('SELECT VERSION() AS version, DATABASE() AS databaseName')
    const [tableRows] = await sequelize.query('SHOW TABLES')
    const tables = tableRows.map((row) => Object.values(row)[0]).sort()
    const selectedTable = tables.includes(req.query.table) ? req.query.table : null
    let columns = []
    let rows = []
    if (selectedTable) {
      columns = await sequelize.query(`DESCRIBE \`${selectedTable}\``, { type: QueryTypes.SELECT })
      rows = await sequelize.query(`SELECT * FROM \`${selectedTable}\` ORDER BY 1 DESC LIMIT 100`, {
        type: QueryTypes.SELECT,
      })
    }
    const tableLinks = tables.map((table) =>
      `<a class="table-link${table === selectedTable ? ' active' : ''}" href="/db-viewer?table=${encodeURIComponent(table)}">${escapeHtml(table)}</a>`,
    ).join('')
    const headers = rows.length ? Object.keys(rows[0]) : columns.map((column) => column.Field)
    const dataTable = selectedTable ? `
      <h2>${escapeHtml(selectedTable)} <span>${rows.length} row(s)</span></h2>
      <div class="scroll"><table><thead><tr>${headers.map((key) => `<th>${escapeHtml(key)}</th>`).join('')}</tr></thead>
      <tbody>${rows.map((row) => `<tr>${headers.map((key) => `<td>${escapeHtml(row[key])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` :
      '<div class="empty">Select a table to inspect its stored rows.</div>'
    res.type('html').send(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>ReliefOps MySQL Database</title><style>
      body{margin:0;font:14px system-ui;background:#f4f7fb;color:#172033}header{padding:22px 28px;background:#082f49;color:white}header h1{margin:0 0 6px;font-size:24px}header p{margin:0;color:#bae6fd}.badge{display:inline-block;margin-left:8px;padding:3px 9px;border-radius:99px;background:#16a34a;color:white;font-size:12px}.layout{display:grid;grid-template-columns:240px 1fr;min-height:calc(100vh - 93px)}aside{padding:18px;background:white;border-right:1px solid #dbe3ef}.table-link{display:block;padding:9px 11px;border-radius:7px;color:#334155;text-decoration:none}.table-link:hover,.table-link.active{background:#e0f2fe;color:#075985;font-weight:700}main{padding:24px;min-width:0}h2{margin-top:0}h2 span{font-size:13px;color:#64748b;font-weight:500}.scroll{overflow:auto;background:white;border:1px solid #dbe3ef;border-radius:9px}table{border-collapse:collapse;min-width:100%;white-space:nowrap}th,td{padding:10px 12px;border-bottom:1px solid #e5eaf1;text-align:left;max-width:440px;overflow:hidden;text-overflow:ellipsis}th{position:sticky;top:0;background:#eaf5fb;color:#0c4a6e}.empty{padding:50px;background:white;border:1px dashed #94a3b8;border-radius:9px;text-align:center;color:#64748b}@media(max-width:700px){.layout{grid-template-columns:1fr}aside{border-right:0;border-bottom:1px solid #ddd}}
    </style></head><body><header><h1>ReliefOps MySQL Database <span class="badge">CONNECTED</span></h1><p>MySQL ${escapeHtml(versionRows[0].version)} · Database: ${escapeHtml(versionRows[0].databaseName)} · ${tables.length} tables · Read-only viewer</p></header><div class="layout"><aside>${tableLinks}</aside><main>${dataTable}</main></div></body></html>`)
  } catch (error) {
    next(error)
  }
})

export default router
