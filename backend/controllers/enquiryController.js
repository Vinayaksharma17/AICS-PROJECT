const path = require('path');
const fs   = require('fs');
const PDFDocument = require('pdfkit');
const Enquiry = require('../models/Enquiry');
const Student = require('../models/Student');

exports.addEnquiry = async (req, res) => {
  try {
    const { firstName, fatherName, lastName, phoneNumber, email, address, qualification, interestedCourse, expectedAdmissionDate, followUpDate, notes } = req.body;
    const enquiry = await Enquiry.create({ firstName, fatherName, lastName, phoneNumber, email, address, qualification, interestedCourse, expectedAdmissionDate, followUpDate, notes, createdBy: req.user._id });
    const populated = await Enquiry.findById(enquiry._id).populate('interestedCourse', 'name');
    res.status(201).json(populated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getAllEnquiries = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = {};
    if (status) filter.status = status;
    const enquiries = await Enquiry.find(filter).populate('interestedCourse', 'name').populate('createdBy', 'name').sort('-createdAt');
    res.json(enquiries);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateEnquiry = async (req, res) => {
  try {
    const existing = await Enquiry.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Enquiry not found' });

    const updates = { ...req.body };

    // If a date field changed and the enquiry was 'contacted', reset back to 'new'
    // (unless explicitly setting status, or already converted/closed)
    const dateChanged =
      (updates.expectedAdmissionDate && updates.expectedAdmissionDate !== (existing.expectedAdmissionDate?.toISOString().split('T')[0])) ||
      (updates.followUpDate && updates.followUpDate !== (existing.followUpDate?.toISOString().split('T')[0]));

    if (dateChanged && !updates.status && existing.status === 'contacted') {
      updates.status = 'new';
    }

    const enquiry = await Enquiry.findByIdAndUpdate(req.params.id, updates, { new: true }).populate('interestedCourse', 'name');
    res.json(enquiry);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteEnquiry = async (req, res) => {
  try {
    const enquiry = await Enquiry.findById(req.params.id);
    if (!enquiry) return res.status(404).json({ message: 'Enquiry not found' });
    await enquiry.deleteOne();
    res.json({ message: 'Enquiry deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /enquiries/:id/pdf
exports.downloadEnquiryPdf = async (req, res) => {
  try {
    const enquiry = await Enquiry.findById(req.params.id)
      .populate('interestedCourse', 'name duration fees subjects description')
      .populate('createdBy', 'name');
    if (!enquiry) return res.status(404).json({ message: 'Enquiry not found' });

    const fmt = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A';
    const course = enquiry.interestedCourse || {};
    const statusLabel = { new: 'New', contacted: 'Contacted', converted: 'Converted', closed: 'Closed' }[enquiry.status] || enquiry.status;

    const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true });
    const safeName = `Enquiry_${enquiry.firstName}_${enquiry.lastName}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
    doc.pipe(res);

    const PW = 515; // usable page width (595 - 2*40)

    // ── HEADER BAND ────────────────────────────────────────────────────────
    doc.rect(40, 30, PW, 80).fillAndStroke('#f0f4ff', '#c7d7fa');

    const logoPath = path.join(__dirname, '..', 'assets', 'aics-logo.jpg');
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, 48, 38, { fit: [120, 60] });
    }

    // Vertical divider
    doc.moveTo(178, 38).lineTo(178, 102).stroke('#c7d7fa');

    // Institute name block
    doc.fontSize(11).fillColor('#1e3a8a').font('Helvetica-Bold')
       .text('Academic Institute of Computer Education Society', 188, 42, { width: 220 });
    doc.fontSize(7.5).fillColor('#6b7280').font('Helvetica')
       .text('Empowering Careers Through Quality Education', 188, 64, { width: 220 });
    doc.fontSize(7).fillColor('#374151')
       .text('www.aicecomputers.com  |  aicesbjp@gmail.com  |  +91 9945470269', 188, 75, { width: 220 });

    // "ENQUIRY RECORD" badge top-right
    const badgeX = 430, badgeY = 38;
    doc.rect(badgeX, badgeY, 125, 36).fillAndStroke('#1e3a8a', '#1e3a8a');
    doc.fontSize(9).fillColor('#ffffff').font('Helvetica-Bold')
       .text('ENQUIRY RECORD', badgeX, badgeY + 5, { width: 125, align: 'center' });
    doc.fontSize(7.5).fillColor('#93c5fd').font('Helvetica')
       .text(`Date: ${fmt(new Date())}`, badgeX, badgeY + 22, { width: 125, align: 'center' });

    doc.moveDown(0);
    let y = 125;

    // ── SECTION HELPER ─────────────────────────────────────────────────────
    const sectionTitle = (title, startY) => {
      doc.rect(40, startY, PW, 18).fillAndStroke('#1e3a8a', '#1e3a8a');
      doc.fontSize(8.5).fillColor('#ffffff').font('Helvetica-Bold')
         .text(title, 48, startY + 5);
      return startY + 18;
    };

    const row = (label, value, x, rowY, w = 200) => {
      doc.fontSize(7.5).fillColor('#6b7280').font('Helvetica')
         .text(label.toUpperCase(), x, rowY);
      doc.fontSize(9).fillColor('#1e293b').font('Helvetica-Bold')
         .text(value || 'N/A', x, rowY + 10, { width: w });
    };

    // ── PERSONAL INFORMATION ───────────────────────────────────────────────
    y = sectionTitle('PERSONAL INFORMATION', y);

    // Pre-measure every dynamic value so box height is exact
    const fullName   = `${enquiry.firstName} ${enquiry.fatherName} ${enquiry.lastName}`;
    const addressText = enquiry.address || 'N/A';
    const LBL = 11;   // label line height (7.5pt)
    const VAL = 13;   // value line height (9pt, single line)
    const PAD = 10;   // vertical gap between rows
    const nameH = doc.fontSize(9).font('Helvetica-Bold').heightOfString(fullName,          { width: 230 });
    const addrH = doc.fontSize(9).font('Helvetica')     .heightOfString(addressText,       { width: PW - 20 });

    const personalBoxHeight = 10                    // top padding
      + LBL + nameH + PAD                           // row 1 (name / phone)
      + LBL + VAL   + PAD                           // row 2 (email / qual)
      + LBL + addrH                                 // address label + text
      + 14;                                         // bottom padding

    doc.rect(40, y, PW, personalBoxHeight).fillAndStroke('#f8fafc', '#e2e8f0');
    y += 10;

    // Row 1 — Full Name + Mobile
    doc.fontSize(7.5).fillColor('#6b7280').font('Helvetica')
       .text('FULL NAME', 50, y, { lineBreak: false });
    doc.fontSize(7.5).fillColor('#6b7280').font('Helvetica')
       .text('MOBILE', 310, y, { lineBreak: false });
    y += LBL;
    doc.fontSize(9).fillColor('#1e293b').font('Helvetica-Bold')
       .text(fullName, 50, y, { width: 230 });
    doc.fontSize(9).fillColor('#1e293b').font('Helvetica-Bold')
       .text(enquiry.phoneNumber || 'N/A', 310, y, { width: 200, lineBreak: false });
    y += nameH + PAD;

    // Row 2 — Email + Qualification
    doc.fontSize(7.5).fillColor('#6b7280').font('Helvetica')
       .text('EMAIL', 50, y, { lineBreak: false });
    doc.fontSize(7.5).fillColor('#6b7280').font('Helvetica')
       .text('QUALIFICATION', 310, y, { lineBreak: false });
    y += LBL;
    doc.fontSize(9).fillColor('#1e293b').font('Helvetica-Bold')
       .text(enquiry.email || 'N/A', 50, y, { width: 230, lineBreak: false });
    doc.fontSize(9).fillColor('#1e293b').font('Helvetica-Bold')
       .text(enquiry.qualification || 'N/A', 310, y, { width: 200, lineBreak: false });
    y += VAL + PAD;

    // Row 3 — Address (can wrap)
    doc.fontSize(7.5).fillColor('#6b7280').font('Helvetica')
       .text('ADDRESS', 50, y, { lineBreak: false });
    y += LBL;
    doc.fontSize(9).fillColor('#1e293b').font('Helvetica')
       .text(addressText, 50, y, { width: PW - 20, lineGap: 2 });
    y += addrH + 14;

    // ── COURSE INTEREST ────────────────────────────────────────────────────
    y = sectionTitle('COURSE INTEREST', y);
    doc.rect(40, y, PW, 52).fillAndStroke('#f8fafc', '#e2e8f0');
    y += 8;
    row('Course Name', course.name || 'N/A', 50, y, 200);
    row('Duration', course.duration ? `${course.duration} Month${course.duration > 1 ? 's' : ''}` : 'N/A', 230, y, 140);
    row('Fees', course.fees ? `Rs.${Number(course.fees).toLocaleString('en-IN')}` : 'N/A', 390, y, 140);
    y += 28;
    const subjects = (course.subjects || []).filter(Boolean);
    if (subjects.length) {
      doc.fontSize(7.5).fillColor('#6b7280').font('Helvetica').text('SUBJECTS / MODULES', 50, y);
      doc.fontSize(8).fillColor('#1e40af').font('Helvetica-Bold')
         .text(subjects.join('  |  '), 50, y + 10, { width: PW - 20 });
    }
    y += 28;

    // ── FOLLOW-UP DETAILS ──────────────────────────────────────────────────
    y = sectionTitle('FOLLOW-UP DETAILS', y);
    doc.rect(40, y, PW, 38).fillAndStroke('#f8fafc', '#e2e8f0');
    y += 8;
    row('Status', statusLabel, 50, y, 140);
    row('Expected Admission', fmt(enquiry.expectedAdmissionDate), 220, y, 140);
    row('Follow-Up Date', fmt(enquiry.followUpDate), 390, y, 140);
    y += 38;

    // ── NOTES ──────────────────────────────────────────────────────────────
    y = sectionTitle('NOTES', y);
    const notesText   = enquiry.notes || 'No notes added for this enquiry.';
    const notesMeasH  = doc.fontSize(9).font('Helvetica').heightOfString(notesText, { width: PW - 20, lineGap: 3 });
    const notesHeight = Math.max(38, notesMeasH + 18);  // min 38, else measured + top+bottom pad
    doc.rect(40, y, PW, notesHeight).fillAndStroke('#fffbeb', '#fde68a');
    doc.fontSize(9).fillColor('#78350f').font('Helvetica')
       .text(notesText, 50, y + 9, { width: PW - 20, lineGap: 3 });
    y += notesHeight + 10;

    // ── FOOTER ─────────────────────────────────────────────────────────────
    doc.moveTo(40, y).lineTo(555, y).stroke('#e2e8f0');
    doc.fontSize(7.5).fillColor('#94a3b8').font('Helvetica')
       .text(
         `Generated by AICS Admin Panel  |  ${new Date().toLocaleString('en-IN')}  |  Confidential`,
         40, y + 6, { width: PW, align: 'center' }
       );

    doc.end();
  } catch (error) {
    if (!res.headersSent) res.status(500).json({ message: error.message });
  }
};
