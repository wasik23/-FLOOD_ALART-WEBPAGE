import test from 'node:test'
import assert from 'node:assert/strict'
import { parseFfwcReport } from '../routes/ffwc.js'

const report = (date, labels, data) => `
  <strong>TABLE OF FORECAST WATER LEVELS : ${date}</strong>
  <table><tr><td colspan="3"></td><td colspan="2">WL - Observe (mMSL)</td><td>WL - Forecast</td></tr>
  <tr><td>River Name</td><td>Station</td><td>Danger Level</td>${labels.map((label) => `<td>${label}</td>`).join('')}</tr>
  <tr><td>06:00 AM</td><td>06:00 AM</td></tr>
  <tr><td colspan="6">Meghna Basin</td></tr>${data}
  </table><table><tr><td>Legend</td></tr></table>`
const station = (name, danger, values) => `<tr><td>Surma</td><td>${name}</td><td>${danger}</td>${values.map((value) => `<td>${value}</td>`).join('')}</tr>`

test('FFWC dry-season reports support two observations without a dated forecast', () => {
  const result = parseFfwcReport(report('22-11-2026', ['21-11', '22-11', ''], station('Sylhet', '13.00', ['5.25', '5.20', '1'])))
  assert.equal(result.reportDate, '2026-11-22')
  assert.equal(result.waterLevels.length, 1)
  assert.equal(result.waterLevels[0].basin, 'Meghna')
  assert.deepEqual(result.waterLevels[0].latest, { date: '2026-11-22', value: 5.2 })
  assert.deepEqual(result.waterLevels[0].previous, { date: '2026-11-21', value: 5.25 })
  assert.deepEqual(result.waterLevels[0].forecasts, [])
})

test('missing readings are excluded while an actual zero stays valid', () => {
  const data = station('Empty', '13', ['', '-', '']) + station('No threshold', '', ['4', '5', '']) + station('Valid zero', '13', ['0', '0', ''])
  const result = parseFfwcReport(report('22-11-2026', ['21-11', '22-11', '23-11'], data))
  assert.equal(result.waterLevels.length, 1)
  assert.equal(result.waterLevels[0].station, 'Valid zero')
  assert.equal(result.waterLevels[0].latest.value, 0)
  assert.deepEqual(result.waterLevels[0].forecasts, [{ date: '2026-11-23', value: null }])
})

test('blank forecast dates do not shift the values of subsequent forecasts', () => {
  const result = parseFfwcReport(report('22-11-2026', ['21-11', '22-11', '', '24-11'], station('Sylhet', '13', ['5', '4.9', '1', '4.8'])))
  assert.deepEqual(result.waterLevels[0].forecasts, [{ date: '2026-11-24', value: 4.8 }])
})

test('observation and forecast years roll over at New Year', () => {
  const result = parseFfwcReport(report('01-01-2027', ['31-12', '01-01', '02-01'], station('Sylhet', '13', ['5', '4.9', '4.8'])))
  assert.equal(result.waterLevels[0].previous.date, '2026-12-31')
  assert.equal(result.waterLevels[0].latest.date, '2027-01-01')
  assert.equal(result.waterLevels[0].forecasts[0].date, '2027-01-02')
})

test('empty observations and incomplete date headers fail explicitly', () => {
  assert.throws(() => parseFfwcReport(report('22-11-2026', ['21-11', '22-11', ''], station('Sylhet', '13', ['', '-', '1']))), /no observed water levels/)
  assert.throws(() => parseFfwcReport(report('22-11-2026', ['22-11', '', ''], station('Sylhet', '13', ['4', '5', '1']))), /observation dates/)
})
