const PDFDocument = require('pdfkit')
const fs = require('fs')
const path = require('path')

const generateInvoice = async (student, invoiceNumber) => {
  return new Promise((resolve, reject) => {
    try {
      const invoiceDir = path.join(__dirname, '../../uploads/invoices')
      if (!fs.existsSync(invoiceDir)) {
        fs.mkdirSync(invoiceDir, { recursive: true })
      }

      const fileName = `invoice_${student._id}_${Date.now()}.pdf`
      const filePath = path.join(invoiceDir, fileName)
      const doc = new PDFDocument({ size: 'A4', margin: 30 })
      const stream = fs.createWriteStream(filePath)

      doc.pipe(stream)

      // ===== PROFESSIONAL HEADER WITH LOGO (Issue #7) =====
      const logoPath = path.join(__dirname, '..', 'assets', 'aics-logo.jpg')
      const headerHeight = 90
      const pageWidth = 535

      // Top header background band
      doc
        .rect(30, 20, pageWidth, headerHeight)
        .fillAndStroke('#f0f4ff', '#c7d7fa')

      // Logo on the left
      if (fs.existsSync(logoPath)) {
        doc.image(logoPath, 38, 28, { width: 140, height: 70, fit: [140, 70] })
      }

      // Vertical separator
      doc.moveTo(190, 28).lineTo(190, 102).stroke('#c7d7fa')

      // Institute name + address (center-right of header)
      doc
        .fontSize(12)
        .fillColor('#1e3a8a')
        .font('Helvetica-Bold')
        .text('Academic Institute of Computer Education Society', 200, 32, {
          width: 230,
          align: 'left',
        })
      doc
        .fontSize(8)
        .fillColor('#6b7280')
        .font('Helvetica')
        .text('Empowering Careers Through Quality Education', 200, 60, {
          width: 230,
        })
      doc
        .fontSize(7.5)
        .fillColor('#374151')
        .text('www.aicecomputers.com  |  aicesbjp@gmail.com', 200, 71, {
          width: 230,
        })
      doc.fontSize(7.5).text('Phone: +91 9945470269', 200, 84, { width: 230 })

      // Invoice info box (top-right)
      const invBoxX = 435,
        invBoxY = 22,
        invBoxW = 125,
        invBoxH = 68
      doc
        .rect(invBoxX, invBoxY, invBoxW, invBoxH)
        .fillAndStroke('#1e3a8a', '#1e3a8a')
      doc
        .fontSize(8)
        .fillColor('#93c5fd')
        .font('Helvetica-Bold')
        .text('FEE RECEIPT', invBoxX + 10, invBoxY + 6, {
          width: invBoxW - 20,
          align: 'center',
        })
      doc
        .moveTo(invBoxX + 5, invBoxY + 18)
        .lineTo(invBoxX + invBoxW - 5, invBoxY + 18)
        .stroke('#3b82f6')
      doc
        .fontSize(7)
        .fillColor('#bfdbfe')
        .font('Helvetica')
        .text('Invoice No:', invBoxX + 8, invBoxY + 23)
      doc
        .fontSize(9)
        .fillColor('#ffffff')
        .font('Helvetica-Bold')
        .text(invoiceNumber, invBoxX + 8, invBoxY + 33)
      doc
        .fontSize(7)
        .fillColor('#bfdbfe')
        .font('Helvetica')
        .text('Date:', invBoxX + 8, invBoxY + 48)
      doc
        .fontSize(7.5)
        .fillColor('#e0f2fe')
        .text(
          new Date().toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          }),
          invBoxX + 8,
          invBoxY + 57,
        )

      doc.font('Helvetica')
      doc.moveDown(6)

      // STUDENT DETAILS - Compact 2-column
      const studentY = doc.y
      doc.rect(30, studentY, 535, 55).fillAndStroke('#f3f4f6', '#d1d5db')

      doc
        .fontSize(9)
        .fillColor('#1e40af')
        .text('STUDENT DETAILS', 40, studentY + 8)
      doc.fontSize(8).fillColor('#000000')

      const fullNameUpper =
        `${student.firstName} ${student.fatherName} ${student.lastName}`.toUpperCase()
      doc
        .fillColor('#000000')
        .font('Helvetica-Bold')
        .text(`Name:`, 40, studentY + 22)
      doc
        .fillColor('#374151')
        .font('Helvetica-Bold')
        .text(fullNameUpper, 100, studentY + 22)

      doc.fillColor('#000000').text(`Phone:`, 40, studentY + 34)
      doc
        .fillColor('#374151')
        .font('Helvetica-Bold')
        .text(student.phoneNumber, 100, studentY + 34)

      doc.fillColor('#000000').text(`Course:`, 300, studentY + 22)
      doc
        .fillColor('#1e40af')
        .fontSize(9)
        .font('Helvetica-Bold')
        .text(student.course?.name || 'N/A', 350, studentY + 22)

      doc
        .fillColor('#000000')
        .fontSize(8)
        .text(`Duration:`, 300, studentY + 34)
      doc
        .fillColor('#374151')
        .font('Helvetica-Bold')
        .text(
          `${student.courseDuration || student.course?.duration || 'N/A'} months`,
          350,
          studentY + 34,
        )

      doc.moveDown(4)

      // FEE BREAKDOWN - Compact
      doc.fontSize(11).fillColor('#1e40af').text('FEE BREAKDOWN', 30)
      doc.moveDown(0.5)

      const feeTableY = doc.y

      // Table Header
      doc.rect(30, feeTableY, 535, 20).fillAndStroke('#1e40af', '#1e40af')
      doc.fontSize(9).fillColor('#ffffff')
      doc.text('Description', 40, feeTableY + 6)
      doc.text('Amount (Rs.)', 450, feeTableY + 6, {
        width: 105,
        align: 'right',
      })

      let currentY = feeTableY + 20

      // Course Fee
      doc.rect(30, currentY, 535, 20).stroke('#d1d5db')
      doc.fillColor('#000000')
      doc.fontSize(9).text('Course Fee', 40, currentY + 6)
      doc.text(student.totalFees.toLocaleString('en-IN'), 450, currentY + 6, {
        width: 105,
        align: 'right',
      })
      currentY += 20

      // Discount
      if (student.discount && student.discount.appliedAmount) {
        doc.rect(30, currentY, 535, 20).stroke('#d1d5db')
        doc.fillColor('#059669')
        doc
          .fontSize(9)
          .text(
            'Discount',
            40,
            currentY + 6,
          )
        doc.text(
          `-${student.discount.appliedAmount.toLocaleString('en-IN')}`,
          450,
          currentY + 6,
          { width: 105, align: 'right' },
        )
        currentY += 20
      }

      // Total
      doc.rect(30, currentY, 535, 22).fillAndStroke('#f3f4f6', '#d1d5db')
      doc.fontSize(10).fillColor('#1e40af')
      doc.text('TOTAL PAYABLE', 40, currentY + 6)
      doc.text(
        `Rs.${student.finalFees.toLocaleString('en-IN')}`,
        450,
        currentY + 6,
        { width: 105, align: 'right' },
      )
      currentY += 22

      doc.moveDown(2)

      // PAYMENT DETAILS - Show either full payment or installments
      doc.fontSize(10).fillColor('#1e40af').text('PAYMENT DETAILS', 30)
      doc.moveDown(0.3)

      const payTableY = doc.y

      if (student.installments && student.installments.length > 1) {
        // INSTALLMENT TABLE - Compact
        doc.rect(30, payTableY, 535, 20).fillAndStroke('#1e40af', '#1e40af')
        doc.fontSize(8).fillColor('#ffffff')
        doc.text('#', 45, payTableY + 6)
        doc.text('Amount', 100, payTableY + 6)
        doc.text('Due Date', 210, payTableY + 6)
        doc.text('Paid Date', 310, payTableY + 6)
        doc.text('Method', 415, payTableY + 6)
        doc.text('Status', 480, payTableY + 6)

        let instY = payTableY + 20

        student.installments.forEach((inst, idx) => {
          const rowBg =
            inst.status === 'paid'
              ? '#f0fdf4'
              : inst.status === 'overdue'
                ? '#fef2f2'
                : '#fffbeb'
          doc.rect(30, instY, 535, 22).fillAndStroke(rowBg, '#d1d5db')
          doc.fontSize(8).fillColor('#374151')

          doc.text(`${inst.installmentNumber || idx + 1}`, 45, instY + 7)
          doc.text(`Rs.${inst.amount.toLocaleString('en-IN')}`, 100, instY + 7)

          // Due date
          doc.text(
            inst.dueDate
              ? new Date(inst.dueDate).toLocaleDateString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })
              : '-',
            210,
            instY + 7,
          )

          // Paid date + early payment badge
          if (inst.paidDate) {
            const paidDate = new Date(inst.paidDate)
            const dueDate = inst.dueDate ? new Date(inst.dueDate) : null
            const paidEarly = dueDate && paidDate < dueDate
            const daysEarly = paidEarly
              ? Math.ceil((dueDate - paidDate) / (1000 * 60 * 60 * 24))
              : 0
            doc.fillColor(paidEarly ? '#059669' : '#374151')
            doc.text(
              paidDate.toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              }),
              310,
              instY + 7,
            )
            if (paidEarly) {
              doc
                .roundedRect(368, instY + 5, 44, 12, 2)
                .fillAndStroke('#dcfce7', '#86efac')
              doc
                .fontSize(6)
                .fillColor('#15803d')
                .font('Helvetica-Bold')
                .text(`EARLY -${daysEarly}d`, 370, instY + 8)
              doc.font('Helvetica').fontSize(8)
            }
            doc.fillColor('#374151')
          } else {
            doc.fillColor('#9ca3af').text('-', 310, instY + 7)
          }

          // Payment method
          doc.fillColor('#374151').fontSize(8)
          let paymentMethod = '-'
          if (
            inst.status === 'paid' &&
            student.payments &&
            student.payments.length > 0
          ) {
            let payment = student.payments.find(
              (p) =>
                p.installmentId &&
                inst._id &&
                p.installmentId.toString() === inst._id.toString(),
            )
            if (!payment && idx === 0) payment = student.payments[0]
            if (payment)
              paymentMethod = (payment.paymentMethod || 'CASH').toUpperCase()
          }
          doc.text(paymentMethod, 418, instY + 7)

          // Status badge
          if (inst.status === 'paid') {
            doc
              .roundedRect(472, instY + 5, 34, 12, 2)
              .fillAndStroke('#dcfce7', '#86efac')
            doc
              .fontSize(6.5)
              .fillColor('#15803d')
              .font('Helvetica-Bold')
              .text('PAID', 480, instY + 8)
          } else if (inst.status === 'overdue') {
            doc
              .roundedRect(467, instY + 5, 44, 12, 2)
              .fillAndStroke('#fee2e2', '#fca5a5')
            doc
              .fontSize(6.5)
              .fillColor('#dc2626')
              .font('Helvetica-Bold')
              .text('OVERDUE', 470, instY + 8)
          } else {
            doc
              .roundedRect(467, instY + 5, 44, 12, 2)
              .fillAndStroke('#fef3c7', '#fcd34d')
            doc
              .fontSize(6.5)
              .fillColor('#92400e')
              .font('Helvetica-Bold')
              .text('PENDING', 470, instY + 8)
          }
          doc.font('Helvetica').fillColor('#000000').fontSize(8)
          instY += 22
        })

        // ── NEXT INSTALLMENT DUE — prominent box ──────────────────────
        const nextPending = student.installments.find(
          (i) => i.status === 'pending' || i.status === 'overdue',
        )
        if (nextPending) {
          instY += 6
          const isOverdue = nextPending.status === 'overdue'
          const boxBg = isOverdue ? '#fef2f2' : '#eff6ff'
          const boxBorder = isOverdue ? '#fca5a5' : '#93c5fd'
          const labelClr = isOverdue ? '#dc2626' : '#1e40af'
          doc.rect(30, instY, 535, 32).fillAndStroke(boxBg, boxBorder)
          // Left label
          doc.fontSize(9).fillColor(labelClr).font('Helvetica-Bold')
          doc.text(
            isOverdue ? '⚠  OVERDUE PAYMENT' : '📅  NEXT INSTALLMENT DUE',
            40,
            instY + 5,
          )
          // Sub label
          doc.fontSize(7).font('Helvetica').fillColor(labelClr)
          doc.text(
            isOverdue
              ? 'Please pay immediately to avoid penalties'
              : 'Please ensure payment by the due date below',
            40,
            instY + 17,
          )
          // Right: date bold, amount larger
          const nextDate = nextPending.dueDate
            ? new Date(nextPending.dueDate).toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
              })
            : '-'
          doc.fontSize(9).fillColor(labelClr).font('Helvetica-Bold')
          doc.text(nextDate, 270, instY + 5, { width: 165, align: 'right' })
          doc.fontSize(12).fillColor(labelClr).font('Helvetica-Bold')
          doc.text(
            `Rs.${nextPending.amount.toLocaleString('en-IN')}`,
            270,
            instY + 16,
            { width: 282, align: 'right' },
          )
          doc.font('Helvetica').fillColor('#000000').fontSize(8)
          instY += 32
        }

        // ── EARLY PAYMENT LEGEND ──────────────────────────────────────
        const hasEarlyPayment = student.installments.some((i) => {
          if (!i.paidDate || !i.dueDate) return false
          return new Date(i.paidDate) < new Date(i.dueDate)
        })
        if (hasEarlyPayment) {
          instY += 4
          doc
            .roundedRect(30, instY, 280, 14, 2)
            .fillAndStroke('#dcfce7', '#86efac')
          doc
            .fontSize(7)
            .fillColor('#15803d')
            .font('Helvetica-Bold')
            .text(
              'EARLY badge = Payment received before due date. Keep it up!',
              35,
              instY + 4,
            )
          doc.font('Helvetica').fillColor('#000000')
          instY += 16
        }

        doc.moveDown(2)
      } else {
        // Single payment table header
        doc.rect(30, payTableY, 535, 20).fillAndStroke('#1e40af', '#1e40af')
        doc.fontSize(8).fillColor('#ffffff')
        doc.text('Date', 45, payTableY + 6)
        doc.text('Amount', 180, payTableY + 6)
        doc.text('Method', 320, payTableY + 6)
        doc.text('Status', 450, payTableY + 6)

        let fullPayY = payTableY + 20

        if (student.payments && student.payments.length > 0) {
          // Show all payments
          student.payments.forEach((payment, idx) => {
            const rowBg = idx % 2 === 0 ? '#ffffff' : '#f9fafb'
            doc.rect(30, fullPayY, 535, 18).fillAndStroke(rowBg, '#d1d5db')
            doc.fontSize(8).fillColor('#000000')
            doc.text(
              new Date(payment.date || Date.now()).toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              }),
              45,
              fullPayY + 5,
            )
            doc
              .fillColor('#059669')
              .text(
                `Rs.${payment.amount.toLocaleString('en-IN')}`,
                180,
                fullPayY + 5,
              )
            doc
              .fillColor('#000000')
              .text(
                (payment.paymentMethod || 'CASH').toUpperCase(),
                320,
                fullPayY + 5,
              )
            doc.fillColor('#059669').text('PAID', 450, fullPayY + 5)
            fullPayY += 18
          })
        } else {
          // No payment yet — show pending row
          doc.rect(30, fullPayY, 535, 18).fillAndStroke('#fffbeb', '#d1d5db')
          doc.fontSize(8).fillColor('#b45309')
          doc.text('No payment recorded yet', 45, fullPayY + 5)
          doc.text(
            `Rs.${student.finalFees.toLocaleString('en-IN')}`,
            180,
            fullPayY + 5,
          )
          doc.text('-', 320, fullPayY + 5)
          doc.fillColor('#dc2626').text('PENDING', 450, fullPayY + 5)
        }

        doc.moveDown(3)
      }

      // PAYMENT SUMMARY - Compact
      // Determine if there's a next pending installment for the summary
      const nextInstallment =
        student.installments && student.installments.length > 1
          ? student.installments.find(
              (i) => i.status === 'pending' || i.status === 'overdue',
            )
          : null

      const summaryHeight = nextInstallment ? 75 : 55
      const summaryY = doc.y
      doc
        .roundedRect(300, summaryY, 265, summaryHeight, 3)
        .fillAndStroke('#f0fdf4', '#86efac')

      doc.fontSize(9).fillColor('#000000')
      doc.text('Total Fees:', 315, summaryY + 10)
      doc.text(
        `Rs.${student.finalFees.toLocaleString('en-IN')}`,
        450,
        summaryY + 10,
        { width: 105, align: 'right' },
      )

      doc.fontSize(9).fillColor('#059669')
      doc.text('Paid:', 315, summaryY + 25)
      doc.text(
        `Rs.${student.paidFees.toLocaleString('en-IN')}`,
        450,
        summaryY + 25,
        { width: 105, align: 'right' },
      )

      doc
        .fontSize(10)
        .fillColor(student.pendingFees > 0 ? '#dc2626' : '#059669')
      doc.text('Balance:', 315, summaryY + 40)
      doc.text(
        `Rs.${student.pendingFees.toLocaleString('en-IN')}`,
        450,
        summaryY + 40,
        { width: 105, align: 'right' },
      )

      // Next installment date line inside summary box
      if (nextInstallment) {
        const isOvd = nextInstallment.status === 'overdue'
        const nextDueDateStr = nextInstallment.dueDate
          ? new Date(nextInstallment.dueDate).toLocaleDateString('en-IN', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            })
          : '-'
        doc
          .moveTo(310, summaryY + 57)
          .lineTo(555, summaryY + 57)
          .stroke('#86efac')
        doc
          .fontSize(8)
          .fillColor(isOvd ? '#dc2626' : '#1e40af')
          .font('Helvetica-Bold')
        doc.text(isOvd ? '⚠ Overdue:' : '📅 Next Due:', 315, summaryY + 62)
        doc.text(
          `${nextDueDateStr}  —  Rs.${nextInstallment.amount.toLocaleString('en-IN')}`,
          370,
          summaryY + 62,
          { width: 185, align: 'right' },
        )
        doc.font('Helvetica').fillColor('#000000')
      }

      // TERMS & CONDITIONS + SIGNATURES
      doc.moveDown(2)
      const tcStartY = doc.y

      // T&C header bar
      doc.rect(30, tcStartY, 535, 18).fillAndStroke('#1e3a8a', '#1e3a8a')
      doc
        .fontSize(9)
        .fillColor('#ffffff')
        .font('Helvetica-Bold')
        .text('TERMS & CONDITIONS', 30, tcStartY + 5, {
          width: 535,
          align: 'center',
        })

      const tcBodyY = tcStartY + 20
      doc.rect(30, tcBodyY, 535, 52).fillAndStroke('#f8faff', '#c7d7fa')
      doc
        .fontSize(8)
        .fillColor('#1e293b')
        .font('Helvetica-Bold')
        .text('1.', 38, tcBodyY + 6)
      doc
        .font('Helvetica')
        .fillColor('#1e293b')
        .text(
          'No refund will be issued once admission is confirmed.',
          50,
          tcBodyY + 6,
        )
      doc.font('Helvetica-Bold').text('2.', 38, tcBodyY + 19)
      doc
        .font('Helvetica')
        .text(
          'Student must pay fees within the due date to avoid penalties.',
          50,
          tcBodyY + 19,
        )
      doc.font('Helvetica-Bold').text('3.', 38, tcBodyY + 32)
      doc
        .font('Helvetica')
        .text(
          'The student must strictly adhere to the assigned batch timings and schedule.',
          50,
          tcBodyY + 32,
        )

      // Signature section — left: authority, right: student
      const sigY = tcBodyY + 62

      // Left authority box
      doc.rect(30, sigY, 245, 58).fillAndStroke('#fafafa', '#d1d5db')
      doc
        .fontSize(7.5)
        .fillColor('#6b7280')
        .font('Helvetica')
        .text('Authorised Signatory', 30, sigY + 7, {
          width: 245,
          align: 'center',
        })
      doc
        .moveTo(55, sigY + 42)
        .lineTo(250, sigY + 42)
        .stroke('#9ca3af')
      doc
        .fontSize(8)
        .fillColor('#374151')
        .font('Helvetica-Bold')
        .text('Authority Signature', 30, sigY + 46, {
          width: 245,
          align: 'center',
        })

      // Right student box
      doc.rect(320, sigY, 245, 58).fillAndStroke('#fafafa', '#d1d5db')
      doc
        .fontSize(7)
        .fillColor('#374151')
        .font('Helvetica-Oblique')
        .text(
          '"I have read the Terms & Conditions and understood the same."',
          320,
          sigY + 7,
          { width: 245, align: 'center' },
        )
      doc
        .moveTo(345, sigY + 42)
        .lineTo(540, sigY + 42)
        .stroke('#9ca3af')
      doc
        .fontSize(8)
        .fillColor('#374151')
        .font('Helvetica-Bold')
        .text('Student Signature', 320, sigY + 46, {
          width: 245,
          align: 'center',
        })

      doc.end()

      stream.on('finish', () => {
        resolve({ fileName, filePath: `/uploads/invoices/${fileName}` })
      })

      stream.on('error', reject)
    } catch (error) {
      reject(error)
    }
  })
}

module.exports = { generateInvoice }
