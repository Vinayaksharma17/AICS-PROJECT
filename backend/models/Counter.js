const mongoose = require('mongoose')

const counterSchema = new mongoose.Schema({
  name: { type: String, required: true },
  sequence: { type: Number, default: 0 },
  year: { type: Number, default: new Date().getFullYear() },
})
counterSchema.index({ name: 1, year: 1 }, { unique: true })

// Invoice: YYYYAICS001
counterSchema.statics.getNextInvoiceNumber = async function () {
  const y = new Date().getFullYear()
  const counter = await this.findOneAndUpdate(
    { name: 'invoice', year: y },
    { $inc: { sequence: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  )
  return `${y}AICES${String(counter.sequence).padStart(3, '0')}`
}

// Certificate: yyAICES001  e.g. 26AICES001
// Accepts optional yearFromDate to use admission date year instead of current year
counterSchema.statics.getNextCertificateNumber = async function (yearFromDate) {
  const now = new Date()
  const y = yearFromDate ? new Date(yearFromDate).getFullYear() : now.getFullYear()
  const yy = String(y).slice(-2)
  const counter = await this.findOneAndUpdate(
    { name: 'certificate', year: y },
    { $inc: { sequence: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  )
  return `${yy}AICES${String(counter.sequence).padStart(3, '0')}`
}

module.exports = mongoose.model('Counter', counterSchema)
