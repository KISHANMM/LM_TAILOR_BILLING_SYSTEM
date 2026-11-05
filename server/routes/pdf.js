const express = require('express');
const router = express.Router();
const PDFDocument = require('pdfkit');
const { db } = require('../db');

// Render a recycle-bin snapshot with the same bill PDF layout as active orders.
router.get('/deleted/:id', async (req, res, next) => {
    try {
        const rs = await db.execute({ sql: "SELECT snapshot FROM deleted_orders WHERE id=? AND deleted_at > datetime('now', '-10 days', 'localtime')", args: [req.params.id] });
        if (!rs.rows.length) return res.status(404).json({ error: 'Deleted bill not found or retention period expired' });
        const snapshot = JSON.parse(rs.rows[0].snapshot);
        const order = snapshot.order;
        const services = snapshot.services || [];
        const pageWidth = 419.53, margin = 40, contentW = pageWidth - margin * 2;
        const height = Math.max(595.28, 400 + services.length * 20);
        const doc = new PDFDocument({ margin, size: [pageWidth, height] });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="LM-Bill-${order.order_id}.pdf"`);
        doc.pipe(res);
        doc.fillColor('#4A1020').font('Helvetica-Bold').fontSize(18).text('L.M. LADIES TAILOR', margin, 42, { align: 'center', width: contentW });
        doc.fillColor('#555').font('Helvetica').fontSize(9).text('BILL / ORDER RECEIPT', margin, 68, { align: 'center', width: contentW });
        let y = 105;
        const line = (label, value) => { doc.fillColor('#555').font('Helvetica').fontSize(9).text(label, margin, y); doc.fillColor('#222').font('Helvetica-Bold').text(String(value ?? '-'), margin + 115, y, { width: contentW - 115 }); y += 17; };
        line('Bill No.', `#${String(order.order_id).padStart(4, '0')}`);
        line('Customer', order.customer_name);
        line('Phone', order.phone_number);
        line('Booking Date', fmtDate(order.booking_date));
        line('Delivery Date', fmtDate(order.delivery_date));
        line('Status', order.status);
        y += 8;
        doc.rect(margin, y, contentW, 20).fill('#4A1020');
        doc.fillColor('#fff').font('Helvetica-Bold').fontSize(8).text('SERVICE', margin + 7, y + 6).text('QTY', margin + 215, y + 6).text('PRICE', margin + 270, y + 6).text('AMOUNT', margin + 320, y + 6);
        y += 24;
        services.forEach(s => { const amount = Number(s.price || 0) * Number(s.quantity || 0); doc.fillColor('#222').font('Helvetica').fontSize(8).text(s.service_type, margin + 7, y, { width: 195 }).text(String(s.quantity), margin + 215, y).text(`Rs.${Number(s.price || 0).toFixed(2)}`, margin + 270, y).text(`Rs.${amount.toFixed(2)}`, margin + 320, y); y += 18; });
        y += 12;
        [['Total', order.total_amount], ['Advance Paid', order.advance_paid], ['Balance Due', order.balance_amount]].forEach(([label, amount]) => { doc.fillColor('#333').font('Helvetica-Bold').fontSize(9).text(label, margin + 205, y).text(`Rs.${Number(amount || 0).toFixed(2)}`, margin + 275, y, { width: 60, align: 'right' }); y += 18; });
        if (order.notes) { y += 8; doc.fillColor('#555').font('Helvetica').fontSize(8).text(`Notes: ${order.notes}`, margin, y, { width: contentW }); }
        doc.end();
    } catch (err) { next(err); }
});

// GET /api/pdf/:orderId
router.get('/:orderId', async (req, res, next) => {
    try {
        const orderRs = await db.execute({
            sql: `SELECT o.*, c.name as customer_name, c.phone_number
            FROM orders o JOIN customers c ON c.id = o.customer_id
            WHERE o.order_id = ?`,
            args: [req.params.orderId]
        });

        if (orderRs.rows.length === 0) return res.status(404).json({ error: 'Order not found' });
        const order = orderRs.rows[0];

        const servicesRs = await db.execute({
            sql: 'SELECT * FROM services WHERE order_id = ?',
            args: [req.params.orderId]
        });
        const services = servicesRs.rows;

        const baseHeight = 400 + (services.length * 20); // Extra buffer
        const finalHeight = Math.max(595.28, baseHeight); // Min height of A5
        const doc = new PDFDocument({ margin: 40, size: [419.53, finalHeight] });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="LM-Bill-${req.params.orderId}.pdf"`);
        doc.pipe(res);

        const MAROON = '#6A1E2E', GOLD = '#C6A75E', DARK = '#1A0A10';
        const GRAY = '#555555', LIGHT = '#F5F0E8';
        const pageWidth = doc.page.width, margin = 40, contentW = pageWidth - margin * 2;

        // Header background
        doc.rect(0, 0, pageWidth, 115).fill(DARK);
        doc.rect(0, 0, pageWidth, 3).fill(GOLD);

        // Shop Name & Details
        doc.font('Helvetica-Bold').fontSize(20).fillColor(GOLD)
            .text('LM LADIES TAILOR', margin, 18, { align: 'center', width: contentW });
        doc.font('Helvetica').fontSize(8).fillColor('#C6A75E')
            .text('Luxury in Every Stitch', margin, 42, { align: 'center', width: contentW });
        doc.fontSize(8).fillColor('#D4C4A0')
            .text('DAJIBANPETH, BESIDE GANESH TEMPLE, HUBLI', margin, 56, { align: 'center', width: contentW });
        doc.fontSize(8).fillColor('#D4C4A0')
            .text('Phone: 9916562127', margin, 70, { align: 'center', width: contentW });

        doc.rect(margin, 88, contentW, 1).fill(GOLD);
        doc.font('Helvetica').fontSize(7.5).fillColor('#A8C8A0')
            .text(`Bill No: #${String(order.order_id).padStart(4, '0')}`, margin, 96)
            .text(`Date: ${new Date().toLocaleDateString('en-IN')}`, margin, 96, { align: 'right', width: contentW });

        let y = 130;

        // Customer Details box
        doc.rect(margin, y, contentW, 68).fill(LIGHT).stroke('#E5DDD0');
        doc.rect(margin, y, contentW, 20).fill('#EDE8DC');
        doc.font('Helvetica-Bold').fontSize(8).fillColor(MAROON)
            .text('CUSTOMER DETAILS', margin + 8, y + 6);
        y += 24;

        const info = [
            ['Customer Name', order.customer_name],
            ['Phone Number', order.phone_number],
            ['Fittings Ref.', order.measurement_type === 'Sample' ? 'Sample Piece Provided' : 'Body Measurements'],
            ['Order Date', fmtDate(order.booking_date)],
            ['Delivery Date', fmtDate(order.delivery_date)],
        ];
        info.forEach(([label, value], i) => {
            const col = i % 2 === 0 ? margin + 8 : margin + contentW / 2;
            const row = y + Math.floor(i / 2) * 12;
            doc.font('Helvetica').fontSize(7).fillColor(GRAY).text(`${label}:`, col, row);
            doc.font('Helvetica-Bold').fontSize(7).fillColor(DARK).text(value || '-', col + 65, row);
        });

        // Status badge
        const sc = order.status === 'Delivered' ? '#2E7D32' : order.status === 'Ready' ? '#1565C0' : '#E65100';
        doc.rect(margin + contentW - 65, y - 24 + 6, 60, 14).fill(sc + '22').stroke(sc);
        doc.font('Helvetica-Bold').fontSize(7).fillColor(sc)
            .text(order.status.toUpperCase(), margin + contentW - 63, y - 24 + 9, { width: 56, align: 'center' });

        y = 130 + 68 + 12;

        // Services table header
        doc.rect(margin, y, contentW, 18).fill(MAROON);
        doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#FFFFFF');
        const c1 = margin + 6, cW = contentW - 12;
        doc.text('SERVICE', c1, y + 5, { width: cW * 0.45 });
        doc.text('QTY', c1 + cW * 0.48, y + 5, { width: 35, align: 'center' });
        doc.text('PRICE', c1 + cW * 0.62, y + 5, { width: 50, align: 'right' });
        doc.text('SUBTOTAL', c1 + cW * 0.74, y + 5, { width: cW * 0.26, align: 'right' });
        y += 18;

        (services || []).forEach((svc, idx) => {
            doc.rect(margin, y, contentW, 16).fill(idx % 2 === 0 ? '#FFFFFF' : '#FAF7F0');
            const sub = (parseFloat(svc.price) * parseInt(svc.quantity)).toFixed(2);
            doc.font('Helvetica').fontSize(7.5).fillColor(DARK);
            doc.text(svc.service_type, c1, y + 4, { width: cW * 0.45 });
            doc.text(String(svc.quantity), c1 + cW * 0.48, y + 4, { width: 35, align: 'center' });
            doc.text(`Rs.${parseFloat(svc.price).toFixed(2)}`, c1 + cW * 0.62, y + 4, { width: 50, align: 'right' });
            doc.text(`Rs.${sub}`, c1 + cW * 0.74, y + 4, { width: cW * 0.26, align: 'right' });
            doc.moveTo(margin, y + 16).lineTo(margin + contentW, y + 16).strokeColor('#E5DDD0').lineWidth(0.5).stroke();
            y += 16;
        });

        y += 10;

        // Payment summary
        const sx = margin + contentW * 0.52, sw = contentW * 0.48;
        [
            ['Total Amount', `Rs.${parseFloat(order.total_amount).toFixed(2)}`, false],
            ['Advance Paid', `Rs.${parseFloat(order.advance_paid).toFixed(2)}`, false],
            ['Balance Due', `Rs.${parseFloat(order.balance_amount).toFixed(2)}`, true],
        ].forEach(([label, value, hl]) => {
            if (hl) {
                doc.rect(sx, y, sw, 18).fill(MAROON);
                doc.font('Helvetica-Bold').fontSize(8).fillColor('#FFFFFF')
                    .text(label, sx + 6, y + 5)
                    .text(value, sx, y + 5, { width: sw - 6, align: 'right' });
                y += 18;
            } else {
                doc.rect(sx, y, sw, 15).fill(LIGHT);
                doc.font('Helvetica').fontSize(7.5).fillColor(GRAY).text(label, sx + 6, y + 4);
                doc.font('Helvetica-Bold').fontSize(7.5).fillColor(DARK).text(value, sx, y + 4, { width: sw - 6, align: 'right' });
                doc.moveTo(sx, y + 15).lineTo(sx + sw, y + 15).strokeColor('#E5DDD0').lineWidth(0.5).stroke();
                y += 15;
            }
        });

        // Footer
        const fY = doc.page.height - 58;
        doc.rect(0, fY, pageWidth, 58).fill(DARK);
        doc.rect(0, fY, pageWidth, 2).fill(GOLD);
        doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#C6A75E')
            .text('Note: We are not responsible for clothes left over 3 months.', margin, fY + 8, { align: 'center', width: contentW });
        doc.font('Helvetica').fontSize(7).fillColor('#9A9090')
            .text('Thank you for choosing LM Ladies Tailor!', margin, fY + 22, { align: 'center', width: contentW });
        doc.fontSize(6.5).fillColor('#6A6060')
            .text('Computer-generated bill. No signature required.', margin, fY + 34, { align: 'center', width: contentW });

        doc.end();
    } catch (err) {
        console.error('PDF error:', err);
        if (!res.headersSent) next(err);
    }
});

function fmtDate(d) {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

module.exports = router;
